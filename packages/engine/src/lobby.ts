import { COLORS, DEFAULT_SETTINGS, LIMITS, type ColorId, type GameSettings } from '@tb/shared';

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  color: ColorId;
  team: number;
  connected: boolean;
}

export interface Lobby {
  hostId: string;
  players: LobbyPlayer[];
  teamColors: ColorId[];
  settings: GameSettings;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

export function createLobby(hostId: string): Lobby {
  return { hostId, players: [], teamColors: [], settings: { ...DEFAULT_SETTINGS } };
}

export function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
}

export function nameError(name: string, players: { name: string }[]): 'name_invalid' | 'name_taken' | null {
  if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) return 'name_invalid';
  if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'name_taken';
  return null;
}

function freePlayerColor(lobby: Lobby): ColorId {
  const used = new Set(lobby.players.map((p) => p.color));
  return COLORS.find((c) => !used.has(c.id))!.id;
}

function teamSizes(lobby: Lobby): number[] {
  const sizes = Array<number>(lobby.settings.teamCount).fill(0);
  for (const p of lobby.players) if (p.team < sizes.length) sizes[p.team]++;
  return sizes;
}

function smallestTeam(lobby: Lobby): number {
  const sizes = teamSizes(lobby);
  return sizes.indexOf(Math.min(...sizes));
}

function syncTeamColors(lobby: Lobby) {
  const keep = lobby.teamColors.slice(0, lobby.settings.teamCount);
  for (const c of COLORS) {
    if (keep.length >= lobby.settings.teamCount) break;
    if (!keep.includes(c.id)) keep.push(c.id);
  }
  lobby.teamColors = keep;
}

function reassignOutOfRangeTeams(lobby: Lobby) {
  for (const p of lobby.players) p.team = p.team >= lobby.settings.teamCount ? -1 : p.team;
  for (const p of lobby.players) if (p.team === -1) p.team = smallestTeam(lobby);
}

// A new team count shouldn't leave a team too small to start while another has spare players.
function fillSmallTeams(lobby: Lobby) {
  for (;;) {
    const sizes = teamSizes(lobby);
    const smallest = Math.min(...sizes);
    const largest = Math.max(...sizes);
    if (smallest >= LIMITS.minTeamSize || largest <= LIMITS.minTeamSize) return;
    const fromTeam = sizes.indexOf(largest);
    const mover = [...lobby.players].reverse().find((p) => p.team === fromTeam)!;
    mover.team = sizes.indexOf(smallest);
  }
}

export function addPlayer(lobby: Lobby, id: string, name: string): LobbyPlayer {
  const player: LobbyPlayer = { id, name, ready: false, color: freePlayerColor(lobby), team: smallestTeam(lobby), connected: true };
  lobby.players.push(player);
  syncTeamColors(lobby);
  return player;
}

export function removePlayer(lobby: Lobby, id: string) {
  lobby.players = lobby.players.filter((p) => p.id !== id);
  if (lobby.hostId === id && lobby.players[0]) lobby.hostId = lobby.players[0].id;
}

export function setReady(lobby: Lobby, id: string, ready: boolean) {
  const p = lobby.players.find((x) => x.id === id);
  if (p) p.ready = ready;
}

export function setColor(lobby: Lobby, id: string, color: ColorId): boolean {
  const p = lobby.players.find((x) => x.id === id);
  if (!p || !COLORS.some((c) => c.id === color)) return false;
  if (lobby.settings.mode === 'teams') {
    if (lobby.teamColors.includes(color)) return false;
    lobby.teamColors[p.team] = color;
    return true;
  }
  if (lobby.players.some((x) => x.id !== id && x.color === color)) return false;
  p.color = color;
  return true;
}

export function setTeam(lobby: Lobby, id: string, team: number): boolean {
  const p = lobby.players.find((x) => x.id === id);
  if (!p || lobby.settings.mode !== 'teams') return false;
  if (!Number.isInteger(team) || team < 0 || team >= lobby.settings.teamCount) return false;
  if (p.team !== team && teamSizes(lobby)[team] >= LIMITS.maxTeamSize) return false;
  p.team = team;
  p.ready = false;
  return true;
}

export function updateSettings(lobby: Lobby, patch: Partial<GameSettings>) {
  const s = lobby.settings;
  const structural = (patch.mode !== undefined && patch.mode !== s.mode) || (patch.teamCount !== undefined && patch.teamCount !== s.teamCount);
  if (patch.mode === 'solo' || patch.mode === 'teams') s.mode = patch.mode;
  if (patch.teamCount !== undefined && (LIMITS.teamCounts as readonly number[]).includes(patch.teamCount)) s.teamCount = patch.teamCount;
  if (typeof patch.startingTiles === 'number') s.startingTiles = clamp(patch.startingTiles, LIMITS.startingTiles.min, LIMITS.startingTiles.max);
  if (typeof patch.questionTimeSec === 'number') s.questionTimeSec = clamp(patch.questionTimeSec, LIMITS.questionTimeSec.min, LIMITS.questionTimeSec.max);
  if (typeof patch.roundsPerCostIncrease === 'number') {
    s.roundsPerCostIncrease = clamp(patch.roundsPerCostIncrease, LIMITS.roundsPerCostIncrease.min, LIMITS.roundsPerCostIncrease.max);
  }
  if (structural) {
    reassignOutOfRangeTeams(lobby);
    fillSmallTeams(lobby);
    syncTeamColors(lobby);
  }
  // Anything that changes the game a player agreed to clears their ready vote.
  for (const p of lobby.players) p.ready = false;
}

export function mapSize(lobby: Lobby): number {
  return lobby.players.length * lobby.settings.startingTiles;
}

export function startError(lobby: Lobby): string | null {
  const { players, settings } = lobby;
  if (players.length < LIMITS.minPlayers) return `Need at least ${LIMITS.minPlayers} players`;
  if (players.length > LIMITS.maxPlayers) return `At most ${LIMITS.maxPlayers} players`;
  if (settings.mode === 'teams') {
    const sizes = teamSizes(lobby);
    if (sizes.some((n) => n < LIMITS.minTeamSize)) return `Every team needs at least ${LIMITS.minTeamSize} players`;
    if (sizes.some((n) => n > LIMITS.maxTeamSize)) return `Teams can have at most ${LIMITS.maxTeamSize} players`;
  }
  if (players.some((p) => p.id !== lobby.hostId && !p.ready)) return 'Waiting for everyone to be ready';
  return null;
}
