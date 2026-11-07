import { describe, expect, it } from 'vitest';
import { advanceBattle, closeQuestion, createGame, finishNaming, markLeft, openQuestion, resolveWave, startWave, submitAnswer, waveComplete } from '../src/game';
import { seededRng } from '../src/rng';
import type { GameState, Rng } from '../src/types';
import { makeBank, makeLobby } from './helpers';

const bank = makeBank(300, 200);

function playBattles(game: GameState, rng: Rng) {
  const live = game.battles.filter((b) => b.stage !== 'finished');
  for (const b of live) openQuestion(game, b, bank, rng);
  // Rounds interleave and finish in a random order, as they do in real play.
  while (live.some((b) => b.stage !== 'finished')) {
    const b = live.filter((x) => x.stage !== 'finished')[Math.floor(rng() * live.filter((x) => x.stage !== 'finished').length)];
    const right = b.current!.correct;
    if (rng() < 0.6) submitAnswer(b, b.a, rng() < 0.6 ? right : (right + 1) % 4);
    if (rng() < 0.6) submitAnswer(b, b.b, rng() < 0.6 ? right : (right + 1) % 4);
    closeQuestion(b);
    advanceBattle(game, b, bank, rng);
  }
}

function checkInvariants(game: GameState, totalTiles: number) {
  expect(game.tiles.length).toBe(totalTiles);
  const sideIds = new Set(game.sides.map((s) => s.id));
  for (const t of game.tiles) {
    expect(sideIds.has(t.owner)).toBe(true);
    expect(game.sides.find((s) => s.id === t.owner)!.eliminated).toBe(false);
  }
  for (const s of game.sides) {
    const owned = game.tiles.filter((t) => t.owner === s.id).length;
    if (s.eliminated) expect(owned).toBe(0);
    else expect(owned).toBeGreaterThan(0);
  }
}

function playGame(game: GameState, rng: Rng, onWave?: () => void): number {
  const total = game.tiles.length;
  if (game.phase === 'team_naming') finishNaming(game, rng);
  let waves = 0;
  while (game.phase !== 'game_over') {
    startWave(game, bank, rng);
    onWave?.();
    if ((game.phase as string) === 'game_over') break;
    const ids = game.battles.map((b) => b.setId);
    expect(new Set(ids).size).toBe(ids.length);
    const seen = new Set<string>();
    for (const b of game.battles) {
      expect(seen.has(b.a) || seen.has(b.b)).toBe(false);
      seen.add(b.a);
      seen.add(b.b);
      const sideA = game.players.find((p) => p.id === b.a)!.sideId;
      const sideB = game.players.find((p) => p.id === b.b)!.sideId;
      expect(sideA).not.toBe(sideB);
    }
    expect(game.battles.length).toBeGreaterThan(0);
    playBattles(game, rng);
    expect(waveComplete(game)).toBe(true);
    resolveWave(game, rng);
    checkInvariants(game, total);
    waves++;
    if (waves > 2000) throw new Error('game did not finish');
  }
  return waves;
}

describe('full game simulations', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('solo with %i players always finishes with one owner', (n) => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = seededRng(seed * 31 + n);
      const game = createGame(makeLobby(n, { startingTiles: 3 + (seed % 6), roundsPerCostIncrease: 1 + (seed % 7) }), rng);
      playGame(game, rng);
      expect(new Set(game.tiles.map((t) => t.owner)).size).toBe(1);
      expect(game.tiles[0].owner).toBe(game.winnerSide);
    }
  });

  const layouts: [number, number[]][] = [
    [2, [2, 2]], [2, [3, 2]], [2, [3, 3]], [2, [4, 2]], [2, [4, 3]], [2, [4, 4]],
    [3, [2, 2, 2]], [3, [3, 2, 2]], [3, [3, 3, 2]],
    [4, [2, 2, 2, 2]],
  ];
  it.each(layouts)('teams x%i %j always finish with one owner', (teamCount, sizes) => {
    const players = sizes.reduce((a, b) => a + b, 0);
    for (let seed = 0; seed < 30; seed++) {
      const rng = seededRng(seed * 17 + players + teamCount);
      const game = createGame(makeLobby(players, { mode: 'teams', teamCount, startingTiles: 3 + (seed % 3), roundsPerCostIncrease: 1 + (seed % 7) }, sizes), rng);
      playGame(game, rng);
      expect(new Set(game.tiles.map((t) => t.owner)).size).toBe(1);
    }
  });

  it('games still finish when players leave midway', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = seededRng(seed + 900);
      const game = createGame(makeLobby(6), rng);
      let wave = 0;
      playGame(game, rng, () => {
        wave++;
        if (wave === 2) markLeft(game, game.players[0].id);
        if (wave === 3) markLeft(game, game.players[1].id);
      });
      expect(game.phase).toBe('game_over');
    }
  });

});
