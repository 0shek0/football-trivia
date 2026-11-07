import type { Rng } from './types';
import { shuffled } from './rng';

export interface SchedulerPlayer {
  id: string;
  sideId: string;
  played: string[];
  roundsPlayed: number;
}

export interface WavePlan {
  pairs: [string, string][];
  sittingOut: string[];
  // Player id -> their history once this schedule was made, after any clearing.
  played: Record<string, string[]>;
}

type History = Map<string, Set<string>>;

const LOOKAHEAD_DEPTH = 7;
const LOOKAHEAD_BUDGET = 400;

function opponentsOf(id: string, players: SchedulerPlayer[]): string[] {
  const me = players.find((p) => p.id === id)!;
  return players.filter((p) => p.sideId !== me.sideId).map((p) => p.id);
}

// Rule 3: history clears once a player has faced everyone still available to them.
function clearFinished(players: SchedulerPlayer[], history: History) {
  for (const p of players) {
    const seen = history.get(p.id)!;
    const opponents = opponentsOf(p.id, players);
    for (const id of [...seen]) if (!opponents.includes(id)) seen.delete(id);
    if (opponents.length > 0 && opponents.every((id) => seen.has(id))) seen.clear();
  }
}

function legal(a: SchedulerPlayer, b: SchedulerPlayer, history: History): boolean {
  return a.sideId !== b.sideId && !history.get(a.id)!.has(b.id) && !history.get(b.id)!.has(a.id);
}

function allMatchings(players: SchedulerPlayer[], history: History): [string, string][][] {
  const out: [string, string][][] = [];
  const used = new Set<number>();
  const current: [string, string][] = [];
  const walk = (i: number) => {
    while (i < players.length && used.has(i)) i++;
    if (i >= players.length) {
      out.push([...current]);
      return;
    }
    used.add(i);
    walk(i + 1);
    for (let j = i + 1; j < players.length; j++) {
      if (used.has(j) || !legal(players[i], players[j], history)) continue;
      used.add(j);
      current.push([players[i].id, players[j].id]);
      walk(i + 1);
      current.pop();
      used.delete(j);
    }
    used.delete(i);
  };
  walk(0);
  return out;
}

function largest(matchings: [string, string][][]): [string, string][][] {
  const size = Math.max(0, ...matchings.map((m) => m.length));
  return matchings.filter((m) => m.length === size);
}

function freshHistory(players: SchedulerPlayer[]): History {
  return new Map(players.map((p) => [p.id, new Set<string>()]));
}

function afterMatching(history: History, matching: [string, string][]): History {
  const next: History = new Map([...history].map(([id, seen]) => [id, new Set(seen)]));
  for (const [a, b] of matching) {
    next.get(a)!.add(b);
    next.get(b)!.add(a);
  }
  return next;
}

// True if the coming waves can all still be full, so this choice causes no avoidable sit-outs.
function futureStaysFull(players: SchedulerPlayer[], history: History, ideal: number, depth: number, budget: { left: number }, rng: Rng): boolean {
  clearFinished(players, history);
  if (depth === 0 || budget.left <= 0) return true;
  if ([...history.values()].every((seen) => seen.size === 0)) return true;
  const full = allMatchings(players, history).filter((m) => m.length === ideal);
  if (full.length === 0) return false;
  for (const m of shuffled(full, rng)) {
    budget.left--;
    if (budget.left <= 0) return true;
    if (futureStaysFull(players, afterMatching(history, m), ideal, depth - 1, budget, rng)) return true;
  }
  return false;
}

export function scheduleWave(players: SchedulerPlayer[], rng: Rng): WavePlan {
  const history: History = new Map(players.map((p) => [p.id, new Set(p.played)]));
  clearFinished(players, history);

  let matchings = largest(allMatchings(players, history));
  if (matchings[0].length === 0) {
    // Nobody has a legal opponent left, so everyone starts fresh.
    for (const seen of history.values()) seen.clear();
    matchings = largest(allMatchings(players, history));
  }

  const ideal = largest(allMatchings(players, freshHistory(players)))[0].length;
  const roundsOf = new Map(players.map((p) => [p.id, p.roundsPlayed]));
  const sitOutRounds = (m: [string, string][]) => {
    const playing = new Set(m.flat());
    return players.filter((p) => !playing.has(p.id)).reduce((sum, p) => sum + roundsOf.get(p.id)!, 0);
  };

  // Those who have played the most sit out first, so sit-outs rotate.
  const candidates = shuffled(matchings, rng).sort((x, y) => sitOutRounds(y) - sitOutRounds(x));
  const budget = { left: LOOKAHEAD_BUDGET };
  const chosen =
    candidates.find((m) => futureStaysFull(players, afterMatching(history, m), ideal, LOOKAHEAD_DEPTH, budget, rng)) ?? candidates[0];

  const playing = new Set(chosen.flat());
  return {
    pairs: chosen,
    sittingOut: players.filter((p) => !playing.has(p.id)).map((p) => p.id),
    played: Object.fromEntries([...history].map(([id, seen]) => [id, [...seen]])),
  };
}
