import { costForWaves, LIMITS, STORE_ITEMS, type StoreItem } from '@tb/shared';
import type { Lobby } from './lobby';
import type { Battle, GameState, Player, QuestionBank, Rng, Side } from './types';
import { applyWaveResults } from './capture';
import { generateMap } from './map';
import { chooseDeath, chooseSet, serveQuestion } from './questions';
import { pick, shuffled } from './rng';
import { scheduleWave } from './scheduler';

export const TEAM_NAMES = [
  'Tiki Taka FC', 'Route One Rovers', 'False Nines', 'Golden Boots', 'Clean Sheets', 'Top Bins United',
  'Injury Time', 'The Offside Trap', 'Parked Buses', 'Rabona Rangers', 'Nutmeg Athletic', 'Panenka Town',
];

function makePlayer(id: string, name: string, sideId: string): Player {
  return {
    id, name, sideId, credits: 0, inventory: [], roundsPlayed: 0, played: [], setsPlayed: [], deathPlayed: [], watching: null,
    correct: 0, wrong: 0, answered: 0, roundsWon: 0, tilesCaptured: 0, connected: true, left: false,
  };
}

export function createGame(lobby: Lobby, rng: Rng): GameState {
  const { settings } = lobby;
  const sides: Side[] = [];
  const players: Player[] = [];

  if (settings.mode === 'solo') {
    for (const p of lobby.players) {
      const sideId = `s-${p.id}`;
      sides.push({ id: sideId, name: p.name, color: p.color, memberIds: [p.id], isTeam: false, namerId: null, named: true, eliminated: false });
      players.push(makePlayer(p.id, p.name, sideId));
    }
  } else {
    for (let team = 0; team < settings.teamCount; team++) {
      const members = lobby.players.filter((p) => p.team === team);
      const sideId = `t-${team}`;
      // Rule 9: a random member of each team picks the name.
      sides.push({
        id: sideId,
        name: `Team ${team + 1}`,
        color: lobby.teamColors[team],
        memberIds: members.map((p) => p.id),
        isTeam: true,
        namerId: pick(members, rng).id,
        named: false,
        eliminated: false,
      });
      for (const p of members) players.push(makePlayer(p.id, p.name, sideId));
    }
  }

  const tiles = generateMap(
    sides.map((s) => ({ owner: s.id, tiles: s.memberIds.length * settings.startingTiles })),
    rng,
  );

  return {
    phase: settings.mode === 'teams' ? 'team_naming' : 'countdown',
    settings: { ...settings },
    sides,
    players,
    tiles,
    wave: 0,
    completedWaves: 0,
    battles: [],
    sittingOut: [],
    lastWave: [],
    winnerSide: null,
    setUse: {},
    deathUse: {},
    nextBattleId: 1,
    finishCounter: 0,
  };
}

// --- Team naming ---

export function setTeamName(game: GameState, playerId: string, raw: string): boolean {
  if (game.phase !== 'team_naming') return false;
  const side = game.sides.find((s) => s.namerId === playerId && !s.named);
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!side || name.length < LIMITS.teamName.min || name.length > LIMITS.teamName.max) return false;
  side.name = name;
  side.named = true;
  return true;
}

export function autoNameTeam(game: GameState, side: Side, rng: Rng) {
  const taken = new Set(game.sides.filter((s) => s.named).map((s) => s.name));
  side.name = pick(TEAM_NAMES.filter((n) => !taken.has(n)), rng);
  side.named = true;
}

export function finishNaming(game: GameState, rng: Rng) {
  for (const side of game.sides) if (!side.named) autoNameTeam(game, side, rng);
  game.phase = 'countdown';
}

export function allTeamsNamed(game: GameState): boolean {
  return game.sides.every((s) => s.named);
}

// --- Cost ---

export function currentCost(game: GameState): number {
  return costForWaves(game.completedWaves, game.settings.roundsPerCostIncrease);
}

export function wavesToNextCost(game: GameState): number | null {
  if (currentCost(game) >= LIMITS.maxCost) return null;
  const every = game.settings.roundsPerCostIncrease;
  return every - (game.completedWaves % every);
}

// --- Waves ---

export function livingPlayers(game: GameState): Player[] {
  const alive = new Set(game.sides.filter((s) => !s.eliminated).map((s) => s.id));
  return game.players.filter((p) => alive.has(p.sideId));
}

export function startWave(game: GameState, bank: QuestionBank, rng: Rng) {
  game.phase = 'wave';
  game.wave++;
  game.battles = [];
  game.lastWave = [];
  for (const p of game.players) p.watching = null;

  const players = livingPlayers(game);
  const plan = scheduleWave(players, rng);
  for (const p of players) p.played = plan.played[p.id];
  game.sittingOut = plan.sittingOut;

  for (const [aId, bId] of shuffled(plan.pairs, rng)) {
    const a = game.players.find((p) => p.id === aId)!;
    const b = game.players.find((p) => p.id === bId)!;
    const battle: Battle = {
      id: game.nextBattleId++,
      a: aId,
      b: bId,
      setId: chooseSet(game, bank, a, b, rng),
      questionIndex: -1,
      sudden: false,
      suddenCount: 0,
      scoreA: 0,
      scoreB: 0,
      stage: 'intro',
      current: null,
      answerA: null,
      answerB: null,
      winner: null,
      finishOrder: null,
      forfeit: false,
    };
    game.battles.push(battle);
    // Players who already left lose instantly so nobody waits on them.
    if (a.left || b.left) finishBattle(game, battle, a.left && b.left ? null : a.left ? bId : aId, true);
  }
}

export function battleOf(game: GameState, playerId: string): Battle | null {
  return game.battles.find((b) => b.a === playerId || b.b === playerId) ?? null;
}

export function openQuestion(game: GameState, battle: Battle, bank: QuestionBank, rng: Rng) {
  battle.answerA = null;
  battle.answerB = null;
  battle.stage = 'question';
  if (battle.sudden) {
    const a = game.players.find((p) => p.id === battle.a)!;
    const b = game.players.find((p) => p.id === battle.b)!;
    battle.suddenCount++;
    battle.current = serveQuestion(chooseDeath(game, bank, battle, a, b, rng), rng);
    for (const p of game.players) if (p.watching === battle.id) markSeen(p, battle);
  } else {
    battle.questionIndex++;
    const set = bank.sets.find((s) => s.id === battle.setId)!;
    battle.current = serveQuestion(set.questions[battle.questionIndex], rng);
  }
}

export function submitAnswer(battle: Battle, playerId: string, option: number): boolean {
  if (battle.stage !== 'question' || !Number.isInteger(option) || option < 0 || option > 3) return false;
  if (playerId === battle.a && battle.answerA === null) battle.answerA = option;
  else if (playerId === battle.b && battle.answerB === null) battle.answerB = option;
  else return false;
  return true;
}

export function bothAnswered(battle: Battle): boolean {
  return battle.answerA !== null && battle.answerB !== null;
}

// Timer ended or both answered: score the question and move to the reveal.
export function closeQuestion(game: GameState, battle: Battle) {
  if (battle.stage !== 'question' || !battle.current) return;
  battle.stage = 'reveal';
  if (!battle.sudden) {
    if (battle.answerA === battle.current.correct) battle.scoreA++;
    if (battle.answerB === battle.current.correct) battle.scoreB++;
  }
  recordAnswer(game, battle.a, battle.answerA, battle.current.correct);
  recordAnswer(game, battle.b, battle.answerB, battle.current.correct);
}

function recordAnswer(game: GameState, playerId: string, answer: number | null, correct: number) {
  const player = game.players.find((p) => p.id === playerId)!;
  if (answer !== null) player.answered++;
  if (answer === correct) player.correct++;
  else player.wrong++;
}

// After the reveal: next question, sudden death, or the end of the round.
export function advanceBattle(game: GameState, battle: Battle, bank: QuestionBank, rng: Rng) {
  if (battle.stage !== 'reveal' || !battle.current) return;
  if (battle.sudden) {
    const aRight = battle.answerA === battle.current.correct;
    const bRight = battle.answerB === battle.current.correct;
    if (aRight !== bRight) finishBattle(game, battle, aRight ? battle.a : battle.b, false);
    else openQuestion(game, battle, bank, rng);
    return;
  }
  if (battle.questionIndex < LIMITS.questionsPerSet - 1) {
    openQuestion(game, battle, bank, rng);
  } else if (battle.scoreA === battle.scoreB) {
    battle.sudden = true;
    openQuestion(game, battle, bank, rng);
  } else {
    finishBattle(game, battle, battle.scoreA > battle.scoreB ? battle.a : battle.b, false);
  }
}

export function finishBattle(game: GameState, battle: Battle, winner: string | null, forfeit: boolean) {
  if (battle.stage === 'finished') return;
  battle.stage = 'finished';
  battle.winner = winner;
  battle.forfeit = forfeit;
  battle.finishOrder = ++game.finishCounter;
  const a = game.players.find((p) => p.id === battle.a)!;
  const b = game.players.find((p) => p.id === battle.b)!;
  a.roundsPlayed++;
  b.roundsPlayed++;
  a.played.push(b.id);
  b.played.push(a.id);
  // Rule 11: winning a round grants 1 credit, immediately usable while waiting.
  if (winner) {
    const champion = game.players.find((p) => p.id === winner)!;
    champion.credits++;
    champion.roundsWon++;
  }
}

export function waveComplete(game: GameState): boolean {
  return game.battles.every((b) => b.stage === 'finished');
}

export function resolveWave(game: GameState, rng: Rng) {
  game.lastWave = applyWaveResults(game, currentCost(game), rng);
  game.completedWaves++;
  const alive = game.sides.filter((s) => !s.eliminated);
  if (alive.length === 1) {
    game.winnerSide = alive[0].id;
    game.phase = 'game_over';
  } else {
    game.phase = 'intermission';
  }
}

// --- Spectating ---

// Questions a player has watched must not come up in their own rounds later (rule 6).
function markSeen(player: Player, battle: Battle) {
  if (!player.setsPlayed.includes(battle.setId)) player.setsPlayed.push(battle.setId);
  if (battle.sudden && battle.current && !player.deathPlayed.includes(battle.current.id)) player.deathPlayed.push(battle.current.id);
}

// Anyone without a live round of their own can watch one. Null stops watching.
export function setWatching(game: GameState, playerId: string, battleId: number | null): boolean {
  const player = game.players.find((p) => p.id === playerId);
  if (!player || game.phase !== 'wave') return false;
  if (battleId === null) {
    player.watching = null;
    return true;
  }
  const own = battleOf(game, playerId);
  if (own && own.stage !== 'finished') return false;
  const battle = game.battles.find((b) => b.id === battleId);
  if (!battle || battle.stage === 'finished' || battle === own) return false;
  player.watching = battle.id;
  markSeen(player, battle);
  return true;
}

// --- Leaving ---

// A player who left stays on the map and loses their rounds instantly.
export function markLeft(game: GameState, playerId: string) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return;
  player.left = true;
  player.connected = false;
  if (game.phase === 'wave') {
    const battle = battleOf(game, playerId);
    if (battle && battle.stage !== 'finished') {
      const otherId = battle.a === playerId ? battle.b : battle.a;
      const other = game.players.find((p) => p.id === otherId)!;
      finishBattle(game, battle, other.left ? null : otherId, true);
    }
  }
  // Last side with anyone still here wins immediately.
  if (game.phase === 'game_over') return;
  const present = game.sides.filter((s) => !s.eliminated && s.memberIds.some((id) => !game.players.find((p) => p.id === id)!.left));
  if (present.length <= 1) {
    game.winnerSide = present[0]?.id ?? null;
    game.phase = 'game_over';
    // The win condition is owning the map, so a walkover hands it all to the winner.
    if (game.winnerSide) {
      for (const tile of game.tiles) tile.owner = game.winnerSide;
      for (const side of game.sides) side.eliminated = side.id !== game.winnerSide;
    }
  }
}

// --- Store ---

export function buyItem(game: GameState, playerId: string, itemId: string, catalog: readonly StoreItem[] = STORE_ITEMS): boolean {
  const player = game.players.find((p) => p.id === playerId);
  const item = catalog.find((i) => i.id === itemId);
  if (!player || !item || player.credits < item.cost) return false;
  player.credits -= item.cost;
  player.inventory.push(item.id);
  return true;
}
