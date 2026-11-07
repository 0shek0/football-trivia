import { randomBytes, randomUUID } from 'node:crypto';
import type { ClientMessage, RoomView, ServerMessage, Timers } from '@tb/shared';
import {
  addPlayer, advanceBattle, allTeamsNamed, autoNameTeam, battleOf, bothAnswered, buyItem, cleanName, closeQuestion, createGame,
  createLobby, finishNaming, markLeft, nameError, openQuestion, removePlayer, resolveWave, setColor, setReady, setTeam, setTeamName,
  startError, startWave, submitAnswer, updateSettings, waveComplete,
  type Battle, type GameState, type Lobby, type QuestionBank, type Rng,
} from '@tb/engine';
import { gameView, lobbyView } from './views';

export interface RoomConnection {
  send(msg: ServerMessage): void;
}

interface TimedAction {
  timer: NodeJS.Timeout;
  deadline: number;
}

export class Room {
  readonly lobby: Lobby;
  game: GameState | null = null;

  private tokens = new Map<string, string>();
  private connections = new Map<string, RoomConnection>();
  private graceTimers = new Map<string, NodeJS.Timeout>();
  private phase: TimedAction | null = null;
  private battleTimers = new Map<number, TimedAction>();
  private broadcastQueued = false;
  private destroyed = false;
  private rng: Rng = Math.random;

  constructor(
    readonly code: string,
    private bank: QuestionBank,
    private timers: Timers & { lobbyGraceMs: number },
    private onEmpty: (room: Room) => void,
  ) {
    this.lobby = createLobby('');
  }

  get playerCount(): number {
    return this.lobby.players.length;
  }

  // --- Membership ---

  join(rawName: string, conn: RoomConnection): { error: ServerMessage & { t: 'error' } } | { playerId: string; token: string } {
    if (this.game) return { error: { t: 'error', code: 'game_in_progress', message: 'That game has already started' } };
    if (this.lobby.players.length >= 8) return { error: { t: 'error', code: 'room_full', message: 'That room is full' } };
    const name = cleanName(rawName);
    const problem = nameError(name, this.lobby.players);
    if (problem === 'name_invalid') return { error: { t: 'error', code: problem, message: 'Names need 2-16 characters' } };
    if (problem === 'name_taken') return { error: { t: 'error', code: problem, message: 'Someone in this room already has that name' } };

    const playerId = randomUUID().slice(0, 8);
    const token = randomBytes(24).toString('base64url');
    if (!this.lobby.hostId) this.lobby.hostId = playerId;
    addPlayer(this.lobby, playerId, name);
    this.tokens.set(playerId, token);
    this.connections.set(playerId, conn);
    this.queueBroadcast();
    return { playerId, token };
  }

  resume(token: string, conn: RoomConnection): string | null {
    const entry = [...this.tokens].find(([, t]) => t === token);
    if (!entry) return null;
    const [playerId] = entry;
    this.connections.set(playerId, conn);
    clearTimeout(this.graceTimers.get(playerId));
    this.graceTimers.delete(playerId);
    this.setConnected(playerId, true);
    this.queueBroadcast();
    return playerId;
  }

  disconnect(playerId: string, conn: RoomConnection) {
    // A newer socket may already have replaced this one.
    if (this.connections.get(playerId) !== conn) return;
    this.connections.delete(playerId);
    this.setConnected(playerId, false);
    const grace = this.game ? this.timers.disconnectGraceMs : this.timers.lobbyGraceMs;
    this.graceTimers.set(playerId, setTimeout(() => this.leave(playerId), grace));
    if (this.game?.phase === 'wave') {
      const battle = battleOf(this.game, playerId);
      if (battle) this.closeIfReady(battle);
    }
    this.queueBroadcast();
  }

  leave(playerId: string) {
    if (!this.tokens.has(playerId)) return;
    clearTimeout(this.graceTimers.get(playerId));
    this.graceTimers.delete(playerId);
    this.tokens.delete(playerId);
    this.connections.delete(playerId);
    removePlayer(this.lobby, playerId);
    if (this.game && this.game.phase !== 'game_over') {
      markLeft(this.game, playerId);
      this.afterLeaving(playerId);
    }
    if (this.tokens.size === 0) {
      this.destroy();
      return;
    }
    this.queueBroadcast();
  }

  private afterLeaving(playerId: string) {
    const game = this.game!;
    if (game.phase === 'game_over') {
      this.clearGameTimers();
      return;
    }
    if (game.phase === 'team_naming') {
      const side = game.sides.find((s) => s.namerId === playerId && !s.named);
      if (side) autoNameTeam(game, side, this.rng);
      if (allTeamsNamed(game)) this.startCountdown();
    }
    if (game.phase === 'wave') {
      const battle = battleOf(game, playerId);
      if (battle) this.clearBattleTimer(battle.id);
      if (waveComplete(game)) this.endWave();
    }
  }

  private setConnected(playerId: string, connected: boolean) {
    const lobbyPlayer = this.lobby.players.find((p) => p.id === playerId);
    if (lobbyPlayer) lobbyPlayer.connected = connected;
    const gamePlayer = this.game?.players.find((p) => p.id === playerId);
    if (gamePlayer) gamePlayer.connected = connected;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearGameTimers();
    for (const t of this.graceTimers.values()) clearTimeout(t);
    this.graceTimers.clear();
    this.onEmpty(this);
  }

  // --- Messages ---

  handle(playerId: string, msg: ClientMessage): boolean {
    const isHost = this.lobby.hostId === playerId;
    let ok = true;
    switch (msg.t) {
      case 'ready':
        if (this.game) return false;
        setReady(this.lobby, playerId, !!msg.ready);
        break;
      case 'settings':
        if (this.game || !isHost || typeof msg.settings !== 'object' || !msg.settings) return false;
        updateSettings(this.lobby, msg.settings);
        break;
      case 'team':
        if (this.game) return false;
        ok = setTeam(this.lobby, playerId, msg.team);
        break;
      case 'color':
        if (this.game) return false;
        ok = setColor(this.lobby, playerId, msg.color);
        break;
      case 'start':
        if (this.game || !isHost || startError(this.lobby)) return false;
        this.startGame();
        break;
      case 'teamName':
        if (!this.game || typeof msg.name !== 'string') return false;
        ok = setTeamName(this.game, playerId, msg.name);
        if (ok && allTeamsNamed(this.game)) this.startCountdown();
        break;
      case 'answer':
        ok = this.answer(playerId, msg.battleId, msg.question, msg.option);
        break;
      case 'buy':
        if (!this.game || typeof msg.itemId !== 'string') return false;
        ok = buyItem(this.game, playerId, msg.itemId);
        break;
      case 'playAgain':
        if (!this.game || this.game.phase !== 'game_over' || !isHost) return false;
        this.game = null;
        for (const p of this.lobby.players) p.ready = false;
        break;
      case 'leave':
        this.leave(playerId);
        return true;
      default:
        return false;
    }
    if (ok) this.queueBroadcast();
    return ok;
  }

  private answer(playerId: string, battleId: number, question: number, option: number): boolean {
    const battle = this.game?.battles.find((b) => b.id === battleId);
    if (!battle || this.game!.phase !== 'wave') return false;
    const current = battle.sudden ? battle.suddenCount : battle.questionIndex + 1;
    // A late tap from the previous question must not count for this one.
    if (question !== current || !submitAnswer(battle, playerId, option)) return false;
    this.closeIfReady(battle);
    return true;
  }

  // --- Phases ---

  private startGame() {
    this.game = createGame(this.lobby, this.rng);
    if (this.game.phase === 'team_naming') {
      this.setPhaseTimer(this.timers.teamNamingMs, () => this.startCountdown());
    } else {
      this.setPhaseTimer(this.timers.startCountdownMs, () => this.beginWave());
    }
  }

  private startCountdown() {
    const game = this.game!;
    if (game.phase === 'team_naming') finishNaming(game, this.rng);
    this.setPhaseTimer(this.timers.startCountdownMs, () => this.beginWave());
    this.queueBroadcast();
  }

  private beginWave() {
    const game = this.game!;
    if (game.phase === 'game_over') return;
    this.phase = null;
    startWave(game, this.bank, this.rng);
    for (const battle of game.battles) {
      if (battle.stage === 'finished') continue;
      this.setBattleTimer(battle, this.timers.battleIntroMs, () => this.openBattleQuestion(battle));
    }
    if (waveComplete(game)) this.endWave();
    this.queueBroadcast();
  }

  private openBattleQuestion(battle: Battle) {
    openQuestion(this.game!, battle, this.bank, this.rng);
    this.setBattleTimer(battle, this.game!.settings.questionTimeSec * 1000, () => this.closeBattleQuestion(battle));
    this.closeIfReady(battle);
    this.queueBroadcast();
  }

  // Both answered, or the only player still connected has: no reason to keep waiting.
  private closeIfReady(battle: Battle) {
    if (battle.stage !== 'question') return;
    const connected = (id: string) => this.connections.has(id);
    const aDone = battle.answerA !== null || !connected(battle.a);
    const bDone = battle.answerB !== null || !connected(battle.b);
    const someoneHere = connected(battle.a) || connected(battle.b);
    if (bothAnswered(battle) || (someoneHere && aDone && bDone)) this.closeBattleQuestion(battle);
  }

  private closeBattleQuestion(battle: Battle) {
    if (battle.stage !== 'question') return;
    closeQuestion(battle);
    this.setBattleTimer(battle, this.timers.revealMs, () => this.advance(battle));
    this.queueBroadcast();
  }

  private advance(battle: Battle) {
    const game = this.game!;
    advanceBattle(game, battle, this.bank, this.rng);
    if (battle.stage === 'question') {
      this.setBattleTimer(battle, game.settings.questionTimeSec * 1000, () => this.closeBattleQuestion(battle));
      this.closeIfReady(battle);
    } else {
      this.clearBattleTimer(battle.id);
      if (waveComplete(game)) this.endWave();
    }
    this.queueBroadcast();
  }

  private endWave() {
    const game = this.game!;
    if (game.phase !== 'wave') return;
    resolveWave(game, this.rng);
    if ((game.phase as string) === 'intermission') {
      this.setPhaseTimer(this.timers.intermissionMs, () => this.beginWave());
    } else {
      this.clearGameTimers();
    }
    this.queueBroadcast();
  }

  // --- Timers ---

  private setPhaseTimer(ms: number, action: () => void) {
    if (this.phase) clearTimeout(this.phase.timer);
    this.phase = { deadline: Date.now() + ms, timer: setTimeout(action, ms) };
  }

  private setBattleTimer(battle: Battle, ms: number, action: () => void) {
    this.clearBattleTimer(battle.id);
    this.battleTimers.set(battle.id, { deadline: Date.now() + ms, timer: setTimeout(action, ms) });
  }

  private clearBattleTimer(id: number) {
    const t = this.battleTimers.get(id);
    if (t) clearTimeout(t.timer);
    this.battleTimers.delete(id);
  }

  private clearGameTimers() {
    if (this.phase) clearTimeout(this.phase.timer);
    this.phase = null;
    for (const t of this.battleTimers.values()) clearTimeout(t.timer);
    this.battleTimers.clear();
  }

  // --- Views ---

  private queueBroadcast() {
    if (this.broadcastQueued) return;
    this.broadcastQueued = true;
    // Several changes in one tick reach players as one update.
    queueMicrotask(() => {
      this.broadcastQueued = false;
      if (!this.destroyed) for (const [id, conn] of this.connections) conn.send({ t: 'state', state: this.viewFor(id) });
    });
  }

  viewFor(playerId: string): RoomView {
    const now = Date.now();
    const remaining = (deadline: number | undefined) => (deadline ? Math.max(0, deadline - now) : 0);
    return {
      code: this.code,
      you: playerId,
      hostId: this.lobby.hostId,
      lobby: this.game ? null : lobbyView(this.lobby),
      game: this.game ? gameView(this.game, playerId, remaining(this.phase?.deadline), (id) => remaining(this.battleTimers.get(id)?.deadline)) : null,
    };
  }
}
