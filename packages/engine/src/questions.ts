import type { Battle, GameState, Player, Question, QuestionBank, Rng, ServedQuestion } from './types';
import { pick, shuffled } from './rng';

// Answer order is shuffled every time, so stored order means nothing to players.
export function serveQuestion(q: Question, rng: Rng): ServedQuestion {
  const options = shuffled([q.correct, ...q.wrong], rng);
  return { id: q.id, text: q.text, options, correct: options.indexOf(q.correct) };
}

function chooseLeastUsed(ids: string[], use: Record<string, number>, rng: Rng): string {
  const lowest = Math.min(...ids.map((id) => use[id] ?? 0));
  return pick(ids.filter((id) => (use[id] ?? 0) === lowest), rng);
}

// Rule 6: never the same set in two live rounds, never a repeat for either player.
// If the pool runs out, the least used questions come back so the game cannot stall.
export function chooseSet(game: GameState, bank: QuestionBank, a: Player, b: Player, rng: Rng): string {
  const active = new Set(game.battles.map((x) => x.setId));
  const free = bank.sets.map((s) => s.id).filter((id) => !active.has(id));
  const fresh = free.filter((id) => !a.setsPlayed.includes(id) && !b.setsPlayed.includes(id));
  const id = fresh.length ? pick(fresh, rng) : chooseLeastUsed(free.length ? free : bank.sets.map((s) => s.id), game.setUse, rng);
  game.setUse[id] = (game.setUse[id] ?? 0) + 1;
  a.setsPlayed.push(id);
  b.setsPlayed.push(id);
  return id;
}

export function chooseDeath(game: GameState, bank: QuestionBank, battle: Battle, a: Player, b: Player, rng: Rng): Question {
  const active = new Set(
    game.battles.filter((x) => x.id !== battle.id && x.sudden && x.stage !== 'finished' && x.current).map((x) => x.current!.id),
  );
  const free = bank.death.map((q) => q.id).filter((id) => !active.has(id));
  const fresh = free.filter((id) => !a.deathPlayed.includes(id) && !b.deathPlayed.includes(id));
  const id = fresh.length ? pick(fresh, rng) : chooseLeastUsed(free.length ? free : bank.death.map((q) => q.id), game.deathUse, rng);
  game.deathUse[id] = (game.deathUse[id] ?? 0) + 1;
  a.deathPlayed.push(id);
  b.deathPlayed.push(id);
  return bank.death.find((q) => q.id === id)!;
}
