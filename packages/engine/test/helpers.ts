import type { GameSettings } from '@tb/shared';
import { addPlayer, createLobby, updateSettings, type Lobby } from '../src/lobby';
import type { QuestionBank } from '../src/types';

export function makeBank(setCount = 60, deathCount = 40): QuestionBank {
  const q = (id: string) => ({ id, text: id, correct: 'right', wrong: ['w1', 'w2', 'w3'] as [string, string, string] });
  return {
    sets: Array.from({ length: setCount }, (_, s) => ({
      id: `s${s}`,
      questions: Array.from({ length: 5 }, (_, i) => q(`s${s}-${i}`)),
    })),
    death: Array.from({ length: deathCount }, (_, i) => q(`d${i}`)),
  };
}

// teamSizes given means teams mode, with players assigned to teams in order.
export function makeLobby(players: number, settings: Partial<GameSettings> = {}, teamSizes?: number[]): Lobby {
  const lobby = createLobby('p0');
  for (let i = 0; i < players; i++) addPlayer(lobby, `p${i}`, `Player ${i}`);
  updateSettings(lobby, settings);
  if (teamSizes) {
    let i = 0;
    teamSizes.forEach((size, team) => {
      for (let n = 0; n < size; n++) lobby.players[i++].team = team;
    });
  }
  return lobby;
}
