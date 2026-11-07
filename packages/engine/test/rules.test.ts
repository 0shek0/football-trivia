import { describe, expect, it } from 'vitest';
import { awards, costForWaves, leaderboard, type GamePlayerView } from '@tb/shared';
import { applyWaveResults } from '../src/capture';
import {
  advanceBattle, allTeamsNamed, buyItem, closeQuestion, costForWave, createGame, finishBattle, finishNaming, markLeft,
  openQuestion, resolveWave, setTeamName, setWatching, startWave, submitAnswer, wavesToNextCost,
} from '../src/game';
import { addPlayer, createLobby, mapSize, nameError, setColor, setTeam, startError, updateSettings } from '../src/lobby';
import { hexDistance, strandedPatches } from '../src/map';
import { seededRng } from '../src/rng';
import { scheduleWave, type SchedulerPlayer } from '../src/scheduler';
import type { Battle, GameState } from '../src/types';
import { makeBank, makeLobby } from './helpers';

const answerAll = (game: GameState, battle: Battle, a: boolean, b: boolean) => {
  submitAnswer(battle, battle.a, a ? battle.current!.correct : (battle.current!.correct + 1) % 4);
  submitAnswer(battle, battle.b, b ? battle.current!.correct : (battle.current!.correct + 1) % 4);
  closeQuestion(game, battle);
};

const tilesOf = (game: GameState, sideId: string) => game.tiles.filter((t) => t.owner === sideId).length;

describe('lobby', () => {
  it('rule 1: map size defaults to players x starting tiles', () => {
    expect(mapSize(makeLobby(4))).toBe(12);
    expect(mapSize(makeLobby(4, { startingTiles: 5 }))).toBe(20);
  });

  it('the break between waves is 30 seconds or 5 minutes only', () => {
    const lobby = makeLobby(2);
    expect(lobby.settings.waveBreakSec).toBe(30);
    updateSettings(lobby, { waveBreakSec: 300 });
    expect(lobby.settings.waveBreakSec).toBe(300);
    updateSettings(lobby, { waveBreakSec: 5 });
    expect(lobby.settings.waveBreakSec).toBe(300);
  });

  it('clamps host settings to their minimums', () => {
    const lobby = makeLobby(2, { startingTiles: 1, questionTimeSec: 2, roundsPerCostIncrease: 0 });
    expect(lobby.settings.startingTiles).toBe(3);
    expect(lobby.settings.questionTimeSec).toBe(10);
    expect(lobby.settings.roundsPerCostIncrease).toBe(1);
  });

  it('rule 5: every team needs 2-4 players', () => {
    const ready = (lobby: ReturnType<typeof makeLobby>) => lobby.players.forEach((p) => (p.ready = true));
    const bad = makeLobby(5, { mode: 'teams', teamCount: 2 }, [4, 1]);
    ready(bad);
    expect(startError(bad)).toMatch(/at least 2/);
    const tooFew = makeLobby(4, { mode: 'teams', teamCount: 3 }, [2, 2, 0]);
    ready(tooFew);
    expect(startError(tooFew)).toMatch(/at least 2/);
    const good = makeLobby(8, { mode: 'teams', teamCount: 4 }, [2, 2, 2, 2]);
    ready(good);
    expect(startError(good)).toBeNull();
  });

  it('rule 2: a full team blocks switching in', () => {
    const lobby = makeLobby(8, { mode: 'teams', teamCount: 2 }, [4, 4]);
    expect(setTeam(lobby, 'p0', 1)).toBe(false);
    const roomLeft = makeLobby(7, { mode: 'teams', teamCount: 2 }, [4, 3]);
    expect(setTeam(roomLeft, 'p0', 1)).toBe(true);
    expect(roomLeft.players[0].team).toBe(1);
  });

  it('rule 5: changing the team count rebalances teams that fall below the minimum', () => {
    const sizes = (lobby: ReturnType<typeof makeLobby>) =>
      Array.from({ length: lobby.settings.teamCount }, (_, t) => lobby.players.filter((p) => p.team === t).length);
    const six = makeLobby(6, { mode: 'teams', teamCount: 2 });
    updateSettings(six, { teamCount: 3 });
    expect(sizes(six)).toEqual([2, 2, 2]);
    const eight = makeLobby(8, { mode: 'teams', teamCount: 2 });
    updateSettings(eight, { teamCount: 4 });
    expect(sizes(eight)).toEqual([2, 2, 2, 2]);
    // Not enough players: stays blocked with a clear message rather than looping forever.
    const three = makeLobby(3, { mode: 'teams', teamCount: 2 });
    updateSettings(three, { teamCount: 4 });
    expect(startError(three)).toMatch(/at least 2/);
  });

  it('rule 8: colors are unique', () => {
    const lobby = makeLobby(2);
    expect(setColor(lobby, 'p0', lobby.players[1].color)).toBe(false);
    expect(setColor(lobby, 'p0', 'pink')).toBe(true);
    const seen = new Set(makeLobby(8).players.map((p) => p.color));
    expect(seen.size).toBe(8);
  });

  it('team colors stay unique when the team count changes', () => {
    const lobby = makeLobby(8, { mode: 'teams', teamCount: 4 });
    expect(new Set(lobby.teamColors).size).toBe(4);
    updateSettings(lobby, { teamCount: 2 });
    expect(lobby.teamColors.length).toBe(2);
    expect(lobby.players.every((p) => p.team < 2)).toBe(true);
  });

  it('needs every non-host ready, and settings changes clear votes', () => {
    const lobby = makeLobby(3);
    expect(startError(lobby)).toMatch(/ready/);
    lobby.players.forEach((p) => (p.ready = true));
    expect(startError(lobby)).toBeNull();
    updateSettings(lobby, { startingTiles: 4 });
    expect(lobby.players.some((p) => p.ready)).toBe(false);
  });

  it('rejects duplicate and invalid names', () => {
    const lobby = createLobby('p0');
    addPlayer(lobby, 'p0', 'Messi');
    expect(nameError('messi', lobby.players)).toBe('name_taken');
    expect(nameError('x', lobby.players)).toBe('name_invalid');
    expect(nameError('Ronaldo', lobby.players)).toBeNull();
  });
});

describe('map', () => {
  it('gives each side its quota on one connected island', () => {
    for (let seed = 0; seed < 50; seed++) {
      const players = 2 + (seed % 7);
      const game = createGame(makeLobby(players, { startingTiles: 3 + (seed % 6) }), seededRng(seed));
      expect(game.tiles.length).toBe(players * (3 + (seed % 6)));
      for (const side of game.sides) expect(tilesOf(game, side.id)).toBe(3 + (seed % 6));
      const seen = new Set([game.tiles[0].id]);
      const queue = [game.tiles[0]];
      while (queue.length) {
        const t = queue.pop()!;
        for (const n of game.tiles) {
          if (!seen.has(n.id) && hexDistance(t, n) === 1) {
            seen.add(n.id);
            queue.push(n);
          }
        }
      }
      expect(seen.size).toBe(game.tiles.length);
    }
  });

  it('starting land is grouped: every side in one piece', () => {
    let stranded = 0;
    let maps = 0;
    for (let seed = 0; seed < 300; seed++) {
      const players = 2 + (seed % 7);
      const tiles = 3 + (seed % 6);
      stranded += strandedPatches(createGame(makeLobby(players, { startingTiles: tiles }), seededRng(seed)).tiles);
      maps++;
    }
    for (const sizes of [[2, 2], [3, 2], [4, 4], [2, 2, 2], [3, 3, 2], [2, 2, 2, 2]]) {
      for (let seed = 0; seed < 50; seed++) {
        const lobby = makeLobby(sizes.reduce((a, b) => a + b, 0), { mode: 'teams', teamCount: sizes.length }, sizes);
        stranded += strandedPatches(createGame(lobby, seededRng(seed)).tiles);
        maps++;
      }
    }
    expect(stranded).toBe(0);
    expect(maps).toBe(600);
  });

  it('rule 2: team land is members x the per-player setting', () => {
    const game = createGame(makeLobby(5, { mode: 'teams', teamCount: 2 }, [3, 2]), seededRng(1));
    expect(tilesOf(game, 't-0')).toBe(9);
    expect(tilesOf(game, 't-1')).toBe(6);
  });
});

describe('scheduler', () => {
  const run = (players: SchedulerPlayer[], waves: number, seed: number, check: (pairs: [string, string][], sitOut: string[], before: Map<string, string[]>) => void) => {
    const rng = seededRng(seed);
    for (let w = 0; w < waves; w++) {
      const plan = scheduleWave(players, rng);
      const before = new Map(Object.entries(plan.played).map(([id, p]) => [id, [...p]]));
      check(plan.pairs, plan.sittingOut, before);
      for (const p of players) p.played = plan.played[p.id];
      const playing = new Set(plan.pairs.flat());
      for (const [a, b] of plan.pairs) {
        players.find((p) => p.id === a)!.played.push(b);
        players.find((p) => p.id === b)!.played.push(a);
      }
      for (const p of players) if (playing.has(p.id)) p.roundsPlayed++;
    }
  };
  const solo = (n: number): SchedulerPlayer[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, sideId: `p${i}`, played: [], roundsPlayed: 0 }));

  it.each([2, 4, 6, 8])('rule 3: %i players meet everyone before any rematch, with no sit-outs', (n) => {
    for (let seed = 0; seed < 100; seed++) {
      const met = new Map<string, Set<string>>();
      run(solo(n), n - 1, seed, (pairs, sitOut) => {
        expect(sitOut).toEqual([]);
        expect(pairs.length).toBe(n / 2);
        for (const [a, b] of pairs) {
          expect(met.get(a)?.has(b) ?? false).toBe(false);
          if (!met.has(a)) met.set(a, new Set());
          if (!met.has(b)) met.set(b, new Set());
          met.get(a)!.add(b);
          met.get(b)!.add(a);
        }
      });
      for (const seen of met.values()) expect(seen.size).toBe(n - 1);
    }
  });

  it('rule 4: teammates never face each other', () => {
    const players: SchedulerPlayer[] = ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'c'].map((sideId, i) => ({ id: `p${i}`, sideId, played: [], roundsPlayed: 0 }));
    run(players, 30, 7, (pairs) => {
      for (const [a, b] of pairs) {
        expect(players.find((p) => p.id === a)!.sideId).not.toBe(players.find((p) => p.id === b)!.sideId);
      }
    });
  });

  it.each([3, 5, 7])('odd player counts: %i players rotate sit-outs fairly and never rematch early', (n) => {
    for (let seed = 0; seed < 30; seed++) {
      const players = solo(n);
      run(players, n * 4, seed, (pairs, _sit, before) => {
        for (const [a, b] of pairs) {
          expect(before.get(a)!.includes(b)).toBe(false);
          expect(before.get(b)!.includes(a)).toBe(false);
        }
      });
      const rounds = players.map((p) => p.roundsPlayed);
      expect(Math.max(...rounds) - Math.min(...rounds)).toBeLessThanOrEqual(2);
    }
  });

  it('uneven teams: sit-outs rotate through the bigger team', () => {
    const players: SchedulerPlayer[] = ['a', 'a', 'a', 'b', 'b'].map((sideId, i) => ({ id: `p${i}`, sideId, played: [], roundsPlayed: 0 }));
    run(players, 12, 3, (pairs) => expect(pairs.length).toBeGreaterThanOrEqual(1));
    const big = players.slice(0, 3).map((p) => p.roundsPlayed);
    expect(Math.max(...big) - Math.min(...big)).toBeLessThanOrEqual(2);
  });
});

describe('a round', () => {
  const setup = () => {
    const bank = makeBank();
    const rng = seededRng(5);
    const game = createGame(makeLobby(2), rng);
    startWave(game, bank, rng);
    const battle = game.battles[0];
    openQuestion(game, battle, bank, rng);
    return { game, bank, rng, battle };
  };

  it('rule 10: the higher score after 5 questions wins and earns 1 credit', () => {
    const { game, bank, rng, battle } = setup();
    for (let i = 0; i < 5; i++) {
      answerAll(game, battle, true, i === 0);
      advanceBattle(game, battle, bank, rng);
    }
    expect(battle.scoreA).toBe(5);
    expect(battle.scoreB).toBe(1);
    expect(battle.winner).toBe(battle.a);
    expect(game.players.find((p) => p.id === battle.a)!.credits).toBe(1);
    expect(game.players.find((p) => p.id === battle.b)!.credits).toBe(0);
  });

  it('plays all 5 even when already decided', () => {
    const { game, bank, rng, battle } = setup();
    for (let i = 0; i < 4; i++) {
      answerAll(game, battle, true, false);
      advanceBattle(game, battle, bank, rng);
      expect(battle.stage).toBe('question');
    }
  });

  it('no answer in time counts as wrong, and a double answer is ignored', () => {
    const { game, battle } = setup();
    const right = battle.current!.correct;
    expect(submitAnswer(battle, battle.a, right)).toBe(true);
    expect(submitAnswer(battle, battle.a, (right + 1) % 4)).toBe(false);
    closeQuestion(game, battle);
    expect(battle.scoreA).toBe(1);
    expect(battle.scoreB).toBe(0);
  });

  it('rule 6: ties go to sudden death until one is right and one is wrong', () => {
    const { game, bank, rng, battle } = setup();
    for (let i = 0; i < 5; i++) {
      answerAll(game, battle, i < 2, i < 2);
      advanceBattle(game, battle, bank, rng);
    }
    expect(battle.sudden).toBe(true);
    const first = battle.current!.id;
    expect(first.startsWith('d')).toBe(true);
    answerAll(game, battle, true, true);
    advanceBattle(game, battle, bank, rng);
    expect(battle.stage).toBe('question');
    answerAll(game, battle, false, false);
    advanceBattle(game, battle, bank, rng);
    expect(battle.stage).toBe('question');
    expect(battle.current!.id).not.toBe(first);
    answerAll(game, battle, false, true);
    advanceBattle(game, battle, bank, rng);
    expect(battle.winner).toBe(battle.b);
    expect(battle.scoreA).toBe(2);
    expect(battle.scoreB).toBe(2);
  });

  it('0-0 also goes to sudden death', () => {
    const { game, bank, rng, battle } = setup();
    for (let i = 0; i < 5; i++) {
      closeQuestion(game, battle);
      advanceBattle(game, battle, bank, rng);
    }
    expect(battle.sudden).toBe(true);
  });
});

describe('spectating', () => {
  const setup = () => {
    const bank = makeBank();
    const rng = seededRng(21);
    const game = createGame(makeLobby(4), rng);
    startWave(game, bank, rng);
    const [done, live] = game.battles;
    const player = (id: string) => game.players.find((p) => p.id === id)!;
    return { game, bank, rng, done, live, player };
  };

  it('a player whose round finished can watch a live round and stop', () => {
    const { game, done, live, player } = setup();
    finishBattle(game, done, done.a, false);
    expect(setWatching(game, done.a, live.id)).toBe(true);
    expect(player(done.a).watching).toBe(live.id);
    expect(setWatching(game, done.a, null)).toBe(true);
    expect(player(done.a).watching).toBeNull();
  });

  it('a player still in a round cannot watch another one', () => {
    const { game, done, live } = setup();
    expect(setWatching(game, live.a, done.id)).toBe(false);
  });

  it('finished rounds, unknown rounds and other phases cannot be watched', () => {
    const { game, done, live } = setup();
    finishBattle(game, done, done.a, false);
    finishBattle(game, live, live.a, false);
    expect(setWatching(game, done.a, live.id)).toBe(false);
    expect(setWatching(game, done.a, done.id)).toBe(false);
    expect(setWatching(game, done.a, 999)).toBe(false);
    expect(setWatching(game, done.a, 'x' as unknown as number)).toBe(false);
    game.phase = 'intermission';
    expect(setWatching(game, done.a, null)).toBe(false);
  });

  it('players sitting out and eliminated players can watch', () => {
    const bank = makeBank();
    const rng = seededRng(4);
    const game = createGame(makeLobby(5), rng);
    const out = game.players[0];
    game.sides.find((s) => s.id === out.sideId)!.eliminated = true;
    game.tiles.filter((t) => t.owner === out.sideId).forEach((t) => (t.owner = game.sides[1].id));
    startWave(game, bank, rng);
    expect(game.sittingOut).toEqual([]);
    expect(setWatching(game, out.id, game.battles[0].id)).toBe(true);

    const threeUp = createGame(makeLobby(3), rng);
    startWave(threeUp, bank, rng);
    expect(setWatching(threeUp, threeUp.sittingOut[0], threeUp.battles[0].id)).toBe(true);
  });

  it('a watched set never comes up in the watcher\'s own rounds', () => {
    const { game, done, live, player } = setup();
    finishBattle(game, done, done.a, false);
    setWatching(game, done.a, live.id);
    setWatching(game, done.a, live.id);
    expect(player(done.a).setsPlayed.filter((id) => id === live.setId)).toHaveLength(1);
  });

  it('a death question counts as seen for whoever is watching when it opens', () => {
    const { game, bank, rng, done, live, player } = setup();
    finishBattle(game, done, done.a, false);
    setWatching(game, done.a, live.id);
    live.sudden = true;
    openQuestion(game, live, bank, rng);
    expect(player(done.a).deathPlayed).toContain(live.current!.id);
    expect(player(done.b).deathPlayed).not.toContain(live.current!.id);
  });

  it('a new wave stops everyone watching', () => {
    const { game, bank, rng, done, live, player } = setup();
    finishBattle(game, done, done.a, false);
    setWatching(game, done.a, live.id);
    finishBattle(game, live, live.a, false);
    startWave(game, bank, rng);
    expect(player(done.a).watching).toBeNull();
  });
});

describe('question sets', () => {
  it('rule 6: no live duplicates and no repeats for a player', () => {
    const bank = makeBank(60);
    const rng = seededRng(11);
    const game = createGame(makeLobby(8), rng);
    for (let w = 0; w < 12; w++) {
      startWave(game, bank, rng);
      const ids = game.battles.map((b) => b.setId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const b of game.battles) finishBattle(game, b, b.a, false);
      game.completedWaves = 0; // no land changes needed for this check
      for (const p of game.players) expect(new Set(p.setsPlayed).size).toBe(p.setsPlayed.length);
    }
  });

  it('falls back to reuse rather than stalling when the pool runs out', () => {
    const bank = makeBank(4);
    const rng = seededRng(2);
    const game = createGame(makeLobby(4), rng);
    for (let w = 0; w < 10; w++) {
      startWave(game, bank, rng);
      expect(new Set(game.battles.map((b) => b.setId)).size).toBe(2);
      for (const b of game.battles) finishBattle(game, b, b.a, false);
    }
  });

  it('serves answers in shuffled order with the right index', () => {
    const bank = makeBank();
    const rng = seededRng(9);
    const game = createGame(makeLobby(2), rng);
    startWave(game, bank, rng);
    const seen = new Set<number>();
    const battle = game.battles[0];
    for (let i = 0; i < 5; i++) {
      openQuestion(game, battle, bank, rng);
      battle.questionIndex = -1;
      expect(battle.current!.options[battle.current!.correct]).toBe('right');
      seen.add(battle.current!.correct);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('capture and escalation', () => {
  it('rule 7: cost is 1, then rises by 1 every 5 waves with no cap of 3', () => {
    expect([0, 4, 5, 9, 10, 15, 18].map((w) => costForWaves(w, 5))).toEqual([1, 1, 2, 2, 3, 4, 4]);
    expect([0, 1, 2, 3].map((w) => costForWaves(w, 1))).toEqual([1, 2, 3, 4]);
  });

  it('rule 7: waves 1-19 climb, 20-25 roll 3 to 10, and from 26 roll 5 to 15', () => {
    const rng = seededRng(3);
    expect([1, 5, 6, 19].map((w) => costForWave(w, 5, rng))).toEqual([1, 1, 2, 4]);
    expect(costForWave(19, 1, rng)).toBe(19);
    const rolls = (wave: number) => Array.from({ length: 400 }, () => costForWave(wave, 5, rng));
    for (const wave of [20, 25]) {
      const r = rolls(wave);
      expect(Math.min(...r)).toBe(3);
      expect(Math.max(...r)).toBe(10);
    }
    for (const wave of [26, 40]) {
      const r = rolls(wave);
      expect(Math.min(...r)).toBe(5);
      expect(Math.max(...r)).toBe(15);
    }
  });

  it('a wave uses the cost rolled at the end of the last one, and flags a rise', () => {
    const rng = seededRng(8);
    const bank = makeBank(300, 200);
    const game = createGame(makeLobby(2, { startingTiles: 8, roundsPerCostIncrease: 2 }), rng);
    const seen: { wave: number; cost: number; rose: boolean; ahead: number | null }[] = [];
    for (let wave = 1; wave <= 30; wave++) {
      startWave(game, bank, rng);
      // No winner, so no land moves and the game lasts all 30 waves.
      finishBattle(game, game.battles[0], null, true);
      const before = game.cost;
      resolveWave(game, rng);
      expect(game.phase).toBe('intermission');
      seen.push({ wave: wave + 1, cost: game.cost, rose: game.costRose, ahead: wavesToNextCost(game) });
      expect(game.costRose).toBe(game.cost > before);
    }
    expect(seen.find((s) => s.wave === 3)).toMatchObject({ cost: 2, rose: true, ahead: 2 });
    expect(seen.find((s) => s.wave === 4)).toMatchObject({ cost: 2, rose: false, ahead: 1 });
    // With a rise every 2 waves, wave 19 would be 10, but the change at 20 is to random costs.
    expect(seen.find((s) => s.wave === 19)).toMatchObject({ cost: 10, ahead: 1 });
    for (const s of seen.filter((x) => x.wave >= 20)) {
      expect(s.ahead).toBeNull();
      expect(s.cost).toBeGreaterThanOrEqual(s.wave >= 26 ? 5 : 3);
      expect(s.cost).toBeLessThanOrEqual(s.wave >= 26 ? 15 : 10);
    }
  });

  it('prefers hexagons bordering the winner', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = seededRng(seed);
      const game = createGame(makeLobby(2, { startingTiles: 6 }), rng);
      const bank = makeBank();
      startWave(game, bank, rng);
      const b = game.battles[0];
      finishBattle(game, b, b.a, false);
      const sideA = `s-${b.a}`;
      resolveWave(game, rng);
      const event = game.lastWave.find((e) => e.type === 'capture')!;
      if (event.type !== 'capture') throw new Error();
      const tile = game.tiles.find((t) => t.id === event.tiles[0])!;
      expect(tile.owner).toBe(sideA);
      expect(game.tiles.some((t) => t.owner === sideA && hexDistance(t, tile) === 1)).toBe(true);
    }
  });

  it('the winner takes only what is left, and the loser is out instantly', () => {
    const rng = seededRng(4);
    const game = createGame(makeLobby(3), rng);
    const bank = makeBank();
    game.cost = 3;
    startWave(game, bank, rng);
    const b = game.battles[0];
    const loserSide = `s-${b.b}`;
    const onlyTile = game.tiles.filter((t) => t.owner === loserSide)[0];
    game.tiles.filter((t) => t.owner === loserSide && t !== onlyTile).forEach((t) => (t.owner = `s-${b.a}`));
    finishBattle(game, b, b.a, false);
    resolveWave(game, rng);
    expect(onlyTile.owner).toBe(`s-${b.a}`);
    expect(game.sides.find((s) => s.id === loserSide)!.eliminated).toBe(true);
  });

  it('game ends when one side owns everything', () => {
    const rng = seededRng(4);
    const game = createGame(makeLobby(2), rng);
    const bank = makeBank();
    startWave(game, bank, rng);
    const b = game.battles[0];
    game.tiles.forEach((t) => (t.owner = `s-${b.a}`));
    game.tiles[0].owner = `s-${b.b}`;
    finishBattle(game, b, b.a, false);
    resolveWave(game, rng);
    expect(game.phase).toBe('game_over');
    expect(game.winnerSide).toBe(`s-${b.a}`);
  });
});

describe('last stand', () => {
  // 2v2, team 1 down to its last hexagon, both rounds decided in a chosen order.
  const setup = (lastHexes = 1) => {
    const rng = seededRng(21);
    const game = createGame(makeLobby(4, { mode: 'teams', teamCount: 2 }, [2, 2]), rng);
    finishNaming(game, rng);
    const bank = makeBank();
    startWave(game, bank, rng);
    game.tiles.forEach((t) => (t.owner = 't-0'));
    for (let i = 0; i < lastHexes; i++) game.tiles[i].owner = 't-1';
    const [first, second] = game.battles;
    const t0 = (b: Battle) => (game.players.find((p) => p.id === b.a)!.sideId === 't-0' ? b.a : b.b);
    const t1 = (b: Battle) => (game.players.find((p) => p.id === b.a)!.sideId === 't-1' ? b.a : b.b);
    return { game, rng, first, second, t0, t1 };
  };

  it('a teammate winning afterwards keeps the team on 1 hexagon', () => {
    const { game, rng, first, second, t0, t1 } = setup();
    finishBattle(game, first, t0(first), false);
    finishBattle(game, second, t1(second), false);
    resolveWave(game, rng);
    expect(tilesOf(game, 't-1')).toBe(1);
    expect(game.sides[1].eliminated).toBe(false);
    expect(game.phase).toBe('intermission');
    expect(game.lastWave.map((e) => e.type)).toEqual(['hold', 'saved']);
  });

  it('the saving win captures nothing but still earns a credit', () => {
    const { game, rng, first, second, t0, t1 } = setup();
    const opponentTiles = tilesOf(game, 't-0');
    finishBattle(game, first, t0(first), false);
    finishBattle(game, second, t1(second), false);
    resolveWave(game, rng);
    expect(tilesOf(game, 't-0')).toBe(opponentTiles);
    expect(game.players.find((p) => p.id === t1(second))!.credits).toBe(1);
  });

  it('with no teammate winning, the team is eliminated when its last round ends', () => {
    const { game, rng, first, second, t0 } = setup();
    finishBattle(game, first, t0(first), false);
    finishBattle(game, second, t0(second), false);
    resolveWave(game, rng);
    expect(tilesOf(game, 't-1')).toBe(0);
    expect(game.sides[1].eliminated).toBe(true);
    expect(game.winnerSide).toBe('t-0');
  });

  it('no teammate still playing means no last stand', () => {
    const { game, rng, first, second, t0, t1 } = setup();
    finishBattle(game, second, t1(second), false);
    finishBattle(game, first, t0(first), false);
    resolveWave(game, rng);
    // First result gave team 1 extra land, so the later loss is an ordinary one.
    expect(game.lastWave[0].type).toBe('capture');
    expect(game.sides[1].eliminated).toBe(false);
  });

  it('solo mode never holds a hexagon', () => {
    const rng = seededRng(8);
    const game = createGame(makeLobby(4), rng);
    startWave(game, makeBank(), rng);
    const [first, second] = game.battles;
    const loser = `s-${first.b}`;
    game.tiles.filter((t) => t.owner === loser).slice(1).forEach((t) => (t.owner = `s-${first.a}`));
    finishBattle(game, first, first.a, false);
    finishBattle(game, second, second.a, false);
    const events = applyWaveResults(game, 1, rng);
    expect(events.some((e) => e.type === 'hold')).toBe(false);
    expect(game.sides.find((s) => s.id === loser)!.eliminated).toBe(true);
  });

  it('a held hexagon goes on to whoever knocked out its capturer', () => {
    const rng = seededRng(31);
    const game = createGame(makeLobby(6, { mode: 'teams', teamCount: 3 }, [2, 2, 2]), rng);
    finishNaming(game, rng);
    const member = (side: string, i: number) => game.players.filter((p) => p.sideId === side)[i].id;
    const battle = (id: number, a: string, b: string): Battle => ({
      id, a, b, setId: 'x', questionIndex: 0, sudden: false, suddenCount: 0, scoreA: 0, scoreB: 0,
      stage: 'question', current: null, answerA: null, answerB: null, winner: null, finishOrder: null, forfeit: false,
    });
    const b1 = battle(1, member('t-1', 0), member('t-0', 0));
    const b2 = battle(2, member('t-2', 0), member('t-1', 1));
    const b3 = battle(3, member('t-0', 1), member('t-2', 1));
    game.battles = [b1, b2, b3];
    game.tiles.forEach((t) => (t.owner = 't-2'));
    game.tiles[0].owner = 't-0';
    game.tiles[1].owner = 't-1';
    finishBattle(game, b1, b1.a, false); // team 1 takes team 0's last hexagon, held
    finishBattle(game, b2, b2.a, false); // team 2 knocks out team 1
    finishBattle(game, b3, b3.b, false); // team 0's last round is lost
    applyWaveResults(game, 1, rng);
    expect(game.sides.find((s) => s.id === 't-0')!.eliminated).toBe(true);
    expect(game.sides.find((s) => s.id === 't-1')!.eliminated).toBe(true);
    expect(game.tiles.every((t) => t.owner === 't-2')).toBe(true);
  });
});

describe('player stats', () => {
  const setup = () => {
    const bank = makeBank();
    const rng = seededRng(5);
    const game = createGame(makeLobby(2), rng);
    startWave(game, bank, rng);
    const battle = game.battles[0];
    openQuestion(game, battle, bank, rng);
    const a = game.players.find((p) => p.id === battle.a)!;
    const b = game.players.find((p) => p.id === battle.b)!;
    return { game, bank, rng, battle, a, b };
  };

  it('counts right, wrong and unanswered questions', () => {
    const { game, battle, a, b } = setup();
    submitAnswer(battle, battle.a, battle.current!.correct);
    closeQuestion(game, battle);
    expect([a.correct, a.wrong, a.answered]).toEqual([1, 0, 1]);
    // No answer in time counts as wrong, but not as answered.
    expect([b.correct, b.wrong, b.answered]).toEqual([0, 1, 0]);
  });

  it('counts sudden death answers but not towards the round score', () => {
    const { game, bank, rng, battle, a } = setup();
    for (let i = 0; i < 5; i++) {
      answerAll(game, battle, false, false);
      advanceBattle(game, battle, bank, rng);
    }
    expect(battle.sudden).toBe(true);
    answerAll(game, battle, true, false);
    expect(a.correct).toBe(1);
    expect(battle.scoreA).toBe(0);
    expect(a.wrong).toBe(5);
  });

  it('counts rounds won and hexagons captured by the winner', () => {
    const rng = seededRng(4);
    const game = createGame(makeLobby(3, { startingTiles: 5 }), rng);
    game.cost = 3;
    startWave(game, makeBank(), rng);
    const b = game.battles[0];
    finishBattle(game, b, b.a, false);
    resolveWave(game, rng);
    const winner = game.players.find((p) => p.id === b.a)!;
    expect(winner.roundsWon).toBe(1);
    expect(winner.tilesCaptured).toBe(3);
    expect(game.players.find((p) => p.id === b.b)!.tilesCaptured).toBe(0);
  });

  it('a last stand hexagon counts for the winner who finally takes it, and not if it is saved', () => {
    const play = (saved: boolean) => {
      const rng = seededRng(21);
      const game = createGame(makeLobby(4, { mode: 'teams', teamCount: 2 }, [2, 2]), rng);
      finishNaming(game, rng);
      startWave(game, makeBank(), rng);
      game.tiles.forEach((t) => (t.owner = 't-0'));
      game.tiles[0].owner = 't-1';
      const [first, second] = game.battles;
      const onTeam = (b: Battle, side: string) => (game.players.find((p) => p.id === b.a)!.sideId === side ? b.a : b.b);
      finishBattle(game, first, onTeam(first, 't-0'), false);
      finishBattle(game, second, onTeam(second, saved ? 't-1' : 't-0'), false);
      resolveWave(game, rng);
      return game.players.find((p) => p.id === onTeam(first, 't-0'))!.tilesCaptured;
    };
    expect(play(true)).toBe(0);
    expect(play(false)).toBe(1);
  });

  const view = (id: string, stats: Partial<GamePlayerView> = {}): GamePlayerView => ({
    id, name: id, sideId: `s-${id}`, roundsPlayed: 0, correct: 0, wrong: 0, answered: 0, roundsWon: 0, tilesCaptured: 0,
    connected: true, left: false, ...stats,
  });

  it('ranks the leaderboard by correct answers, then fewest wrong, with shared ranks for ties', () => {
    const rows = leaderboard([
      view('low', { correct: 1 }),
      view('top', { correct: 5, wrong: 3 }),
      view('tieB', { correct: 3, wrong: 1 }),
      view('tieA', { correct: 3, wrong: 1 }),
      view('careful', { correct: 5, wrong: 1 }),
    ]);
    expect(rows.map((r) => [r.player.id, r.rank])).toEqual([
      ['careful', 1], ['top', 2], ['tieA', 3], ['tieB', 3], ['low', 5],
    ]);
  });

  it('gives awards to the top player, shares them on ties, and skips any nobody earned', () => {
    const results = awards([
      view('a', { correct: 7, answered: 9, wrong: 2, tilesCaptured: 4 }),
      view('b', { correct: 2, answered: 9, wrong: 8, tilesCaptured: 0 }),
    ]);
    const find = (key: string) => results.find((r) => r.key === key)!;
    expect(find('correct').players.map((p) => p.id)).toEqual(['a']);
    expect(find('answered').players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(find('tilesCaptured').value).toBe(4);
    expect(find('wrong').players.map((p) => p.id)).toEqual(['b']);
    expect(awards([view('a'), view('b')])).toEqual([]);
  });
});

describe('team naming', () => {
  it('rule 9: one random member per team names it, the rest get random names', () => {
    const rng = seededRng(3);
    const game = createGame(makeLobby(4, { mode: 'teams', teamCount: 2 }, [2, 2]), rng);
    expect(game.phase).toBe('team_naming');
    const namer = game.sides[0].namerId!;
    const other = game.sides[0].memberIds.find((id) => id !== namer)!;
    expect(setTeamName(game, other, 'Nope')).toBe(false);
    expect(setTeamName(game, namer, 'X')).toBe(false);
    expect(setTeamName(game, namer, 'Galacticos')).toBe(true);
    expect(allTeamsNamed(game)).toBe(false);
    finishNaming(game, rng);
    expect(game.phase).toBe('countdown');
    expect(game.sides[0].name).toBe('Galacticos');
    expect(game.sides[1].name.length).toBeGreaterThan(1);
    expect(game.sides[1].name).not.toBe('Team 2');
  });
});

describe('leaving', () => {
  it('a player who leaves loses instantly, and is matched as an instant loss later', () => {
    const rng = seededRng(12);
    const game = createGame(makeLobby(4), rng);
    const bank = makeBank();
    startWave(game, bank, rng);
    const b = game.battles[0];
    markLeft(game, b.a);
    expect(b.stage).toBe('finished');
    expect(b.winner).toBe(b.b);
    expect(b.forfeit).toBe(true);
    expect(game.phase).toBe('wave');
  });

  it('the last side with anyone present wins', () => {
    const rng = seededRng(12);
    const game = createGame(makeLobby(3), rng);
    markLeft(game, 'p0');
    expect(game.phase).toBe('countdown');
    markLeft(game, 'p1');
    expect(game.phase).toBe('game_over');
    expect(game.winnerSide).toBe('s-p2');
    expect(game.tiles.every((t) => t.owner === 's-p2')).toBe(true);
    expect(game.sides.filter((s) => !s.eliminated).map((s) => s.id)).toEqual(['s-p2']);
  });
});

describe('store', () => {
  const item = { id: 'test', name: 'Test', description: '', cost: 2 };

  it('rule 11: spends credits only when affordable', () => {
    const game = createGame(makeLobby(2), seededRng(1));
    const p = game.players[0];
    expect(buyItem(game, p.id, 'test', [item])).toBe(false);
    p.credits = 3;
    expect(buyItem(game, p.id, 'test', [item])).toBe(true);
    expect(p.credits).toBe(1);
    expect(p.inventory).toEqual(['test']);
    expect(buyItem(game, p.id, 'test', [item])).toBe(false);
    expect(buyItem(game, p.id, 'missing', [item])).toBe(false);
  });
});
