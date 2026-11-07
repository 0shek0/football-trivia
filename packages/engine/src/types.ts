import type { BattleStage, ColorId, GamePhase, GameSettings, WaveEvent } from '@tb/shared';

export type Rng = () => number;

export interface Question {
  id: string;
  text: string;
  correct: string;
  wrong: [string, string, string];
}

export interface QuestionSet {
  id: string;
  questions: Question[];
}

export interface QuestionBank {
  sets: QuestionSet[];
  death: Question[];
}

export interface ServedQuestion {
  id: string;
  text: string;
  options: string[];
  correct: number;
}

export interface Tile {
  id: number;
  q: number;
  r: number;
  owner: string;
  decor: number;
}

export interface Side {
  id: string;
  name: string;
  color: ColorId;
  memberIds: string[];
  isTeam: boolean;
  namerId: string | null;
  named: boolean;
  eliminated: boolean;
}

export interface Player {
  id: string;
  name: string;
  sideId: string;
  credits: number;
  inventory: string[];
  roundsPlayed: number;
  // Opponents faced since this player's history last cleared (rule 3).
  played: string[];
  setsPlayed: string[];
  deathPlayed: string[];
  connected: boolean;
  left: boolean;
}

export interface Battle {
  id: number;
  a: string;
  b: string;
  setId: string;
  questionIndex: number;
  sudden: boolean;
  suddenCount: number;
  scoreA: number;
  scoreB: number;
  stage: BattleStage;
  current: ServedQuestion | null;
  answerA: number | null;
  answerB: number | null;
  winner: string | null;
  finishOrder: number | null;
  forfeit: boolean;
}

export interface GameState {
  phase: GamePhase;
  settings: GameSettings;
  sides: Side[];
  players: Player[];
  tiles: Tile[];
  wave: number;
  completedWaves: number;
  battles: Battle[];
  sittingOut: string[];
  lastWave: WaveEvent[];
  winnerSide: string | null;
  setUse: Record<string, number>;
  deathUse: Record<string, number>;
  nextBattleId: number;
  finishCounter: number;
}
