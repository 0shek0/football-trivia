export type Mode = 'solo' | 'teams';

export interface GameSettings {
  mode: Mode;
  teamCount: number;
  startingTiles: number;
  questionTimeSec: number;
  roundsPerCostIncrease: number;
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
  maxCost: 3,
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
};

export const TIMERS = {
  teamNamingMs: 60_000,
  startCountdownMs: 10_000,
  intermissionMs: 10_000,
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

// Hexagons a round's loser gives up, given how many waves are complete.
export function costForWaves(completedWaves: number, roundsPerCostIncrease: number): number {
  return Math.min(LIMITS.maxCost, 1 + Math.floor(completedWaves / roundsPerCostIncrease));
}
