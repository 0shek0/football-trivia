export type Mode = 'solo' | 'teams';

export interface GameSettings {
  mode: Mode;
  teamCount: number;
  startingTiles: number;
  questionTimeSec: number;
  roundsPerCostIncrease: number;
  waveBreakSec: number;
}

export const LIMITS = {
  minPlayers: 2,
  maxPlayers: 8,
  teamCounts: [2, 3, 4],
  minTeamSize: 2,
  maxTeamSize: 4,
  startingTiles: { min: 3, max: 8 },
  questionTimeSec: { min: 10, max: 30 },
  roundsPerCostIncrease: { min: 1, max: 20 },
  waveBreakSec: [30, 300],
  questionsPerSet: 5,
  name: { min: 2, max: 16 },
  teamName: { min: 2, max: 20 },
  roomCodeLength: 6,
} as const;

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'solo',
  teamCount: 2,
  startingTiles: 3,
  questionTimeSec: 10,
  roundsPerCostIncrease: 5,
  waveBreakSec: 30,
};

export const TIMERS = {
  teamNamingMs: 60_000,
  startCountdownMs: 10_000,
  battleIntroMs: 2_500,
  revealMs: 2_000,
  disconnectGraceMs: 60_000,
};
export type Timers = typeof TIMERS;

export const COLORS = [
  { id: 'red', name: 'Red', hex: '#e8483f' },
  { id: 'orange', name: 'Orange', hex: '#f58a25' },
  { id: 'yellow', name: 'Yellow', hex: '#f6cf35' },
  { id: 'green', name: 'Green', hex: '#57bd4a' },
  { id: 'blue', name: 'Blue', hex: '#3a6df0' },
  { id: 'purple', name: 'Purple', hex: '#9b56e3' },
  { id: 'pink', name: 'Pink', hex: '#f26bab' },
  { id: 'ivory', name: 'Ivory', hex: '#f3ecd9' },
] as const;
export type ColorId = (typeof COLORS)[number]['id'];

export function colorHex(id: ColorId): string {
  return COLORS.find((c) => c.id === id)!.hex;
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
}

// Rule 11: the purchase system is live, items are specified later.
export const STORE_ITEMS: StoreItem[] = [];

// Hexagons a round's loser gives up while the cost is still climbing, given how many waves are complete.
export function costForWaves(completedWaves: number, roundsPerCostIncrease: number): number {
  return 1 + Math.floor(completedWaves / roundsPerCostIncrease);
}

// Rule 7: from wave 20 the climb stops and each wave rolls a random cost instead.
export const RANDOM_COSTS = [
  { fromWave: 20, min: 3, max: 10 },
  { fromWave: 26, min: 5, max: 15 },
] as const;

export function randomCostRange(wave: number): { min: number; max: number } | null {
  let range: { min: number; max: number } | null = null;
  for (const r of RANDOM_COSTS) if (wave >= r.fromWave) range = { min: r.min, max: r.max };
  return range;
}
