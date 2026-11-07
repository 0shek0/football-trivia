import type { ColorId, GameSettings, StoreItem } from './settings';

// Client to server
export type ClientMessage =
  | { t: 'create'; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'resume'; code: string; token: string }
  | { t: 'leave' }
  | { t: 'ready'; ready: boolean }
  | { t: 'settings'; settings: Partial<GameSettings> }
  | { t: 'team'; team: number }
  | { t: 'color'; color: ColorId }
  | { t: 'start' }
  | { t: 'teamName'; name: string }
  | { t: 'answer'; battleId: number; question: number; option: number }
  | { t: 'buy'; itemId: string }
  | { t: 'nextWave' }
  | { t: 'spectate'; battleId: number | null }
  | { t: 'playAgain' };

// Server to client
export type ServerMessage =
  | { t: 'joined'; code: string; token: string; playerId: string }
  | { t: 'state'; state: RoomView }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'left' };

export type ErrorCode =
  | 'room_not_found'
  | 'room_full'
  | 'game_in_progress'
  | 'name_invalid'
  | 'name_taken'
  | 'resume_failed'
  | 'not_allowed'
  | 'invalid'
  | 'server_full';

export interface RoomView {
  code: string;
  you: string;
  hostId: string;
  lobby: LobbyView | null;
  game: GameView | null;
}

export interface LobbyPlayerView {
  id: string;
  name: string;
  ready: boolean;
  color: ColorId;
  team: number;
  connected: boolean;
}

export interface LobbyView {
  players: LobbyPlayerView[];
  teamColors: ColorId[];
  settings: GameSettings;
  mapSize: number;
  startError: string | null;
}

export type GamePhase = 'team_naming' | 'countdown' | 'wave' | 'intermission' | 'game_over';

export interface SideView {
  id: string;
  name: string;
  color: ColorId;
  memberIds: string[];
  isTeam: boolean;
  named: boolean;
  eliminated: boolean;
  tiles: number;
}

export interface GamePlayerView {
  id: string;
  name: string;
  sideId: string;
  roundsPlayed: number;
  correct: number;
  wrong: number;
  answered: number;
  roundsWon: number;
  tilesCaptured: number;
  connected: boolean;
  left: boolean;
}

export interface TileView {
  id: number;
  q: number;
  r: number;
  owner: string;
  decor: number;
}

export interface BattleSummary {
  id: number;
  a: string;
  b: string;
  scoreA: number;
  scoreB: number;
  question: number;
  sudden: boolean;
  finished: boolean;
  winner: string | null;
}

export type BattleStage = 'intro' | 'question' | 'reveal' | 'finished';

export interface MyBattleView {
  id: number;
  opponentId: string;
  stage: BattleStage;
  // 1-based, counts death questions separately when sudden is true.
  question: number;
  sudden: boolean;
  text: string | null;
  options: string[] | null;
  myAnswer: number | null;
  opponentAnswered: boolean;
  // Only present once the question is revealed.
  correct: number | null;
  opponentAnswer: number | null;
  myScore: number;
  opponentScore: number;
  winner: string | null;
  forfeit: boolean;
  msLeft: number;
}

// The live detail of a watched round. Names and scores come from its BattleSummary.
export interface SpectateView {
  id: number;
  stage: BattleStage;
  text: string | null;
  options: string[] | null;
  // Sent as soon as each player taps, while correct stays hidden until the reveal.
  answerA: number | null;
  answerB: number | null;
  correct: number | null;
  forfeit: boolean;
  msLeft: number;
}

export type WaveEvent =
  | { type: 'capture'; winnerSide: string; loserSide: string; winnerId: string; loserId: string; tiles: number[] }
  | { type: 'hold'; side: string; tile: number }
  | { type: 'saved'; side: string; tile: number; playerId: string }
  | { type: 'eliminated'; side: string };

export interface GameView {
  phase: GamePhase;
  msLeft: number;
  wave: number;
  cost: number;
  // Waves until the cost rises, null once it is at the maximum.
  wavesToNextCost: number | null;
  costJustRose: boolean;
  questionTimeSec: number;
  sides: SideView[];
  players: GamePlayerView[];
  tiles: TileView[];
  battles: BattleSummary[];
  myBattle: MyBattleView | null;
  spectating: SpectateView | null;
  sittingOut: string[];
  namingFor: string | null;
  lastWave: WaveEvent[];
  winnerSide: string | null;
  credits: number;
  inventory: string[];
  store: StoreItem[];
}
