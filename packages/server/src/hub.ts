import { randomInt } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { LIMITS, TIMERS, type ClientMessage, type ServerMessage } from '@tb/shared';
import type { QuestionBank } from '@tb/engine';
import { Room, type RoomConnection } from './room';

// No 0/O or 1/I, so codes survive being read out loud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 5000;
const MAX_MESSAGE_BYTES = 2048;
const RATE_WINDOW_MS = 5000;
export const RATE_MAX_MESSAGES = 60;
const MAX_JOIN_ATTEMPTS = 30;
const HEARTBEAT_MS = 20_000;
const FINISHED_ROOM_SWEEP_MS = 60_000;

export type HubTimers = typeof TIMERS & { lobbyGraceMs: number };
export const DEFAULT_HUB_TIMERS: HubTimers = { ...TIMERS, lobbyGraceMs: 180_000 };

interface Client {
  ws: WebSocket;
  conn: RoomConnection;
  room: Room | null;
  playerId: string | null;
  windowStart: number;
  windowCount: number;
  joinAttempts: number;
  alive: boolean;
}

export class Hub {
  readonly rooms = new Map<string, Room>();
  private wss: WebSocketServer;
  private heartbeat: NodeJS.Timeout;
  private clients = new Set<Client>();

  constructor(
    server: HttpServer,
    private bank: QuestionBank,
    private timers: HubTimers = DEFAULT_HUB_TIMERS,
    private rateMaxMessages = RATE_MAX_MESSAGES,
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });
    this.wss.on('connection', (ws) => this.onConnection(ws));
    // Phones can vanish without closing their socket, so dead ones are found by ping.
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) {
          c.ws.terminate();
          continue;
        }
        c.alive = false;
        c.ws.ping();
      }
    }, HEARTBEAT_MS);
    this.heartbeat.unref();
    setInterval(() => this.sweep(), FINISHED_ROOM_SWEEP_MS).unref();
  }

  close() {
    clearInterval(this.heartbeat);
    for (const room of this.rooms.values()) room.destroy();
    for (const c of this.clients) c.ws.terminate();
    this.wss.close();
  }

  private sweep() {
    for (const room of this.rooms.values()) if (room.playerCount === 0) room.destroy();
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < LIMITS.roomCodeLength; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private onConnection(ws: WebSocket) {
    const conn: RoomConnection = {
      send: (msg: ServerMessage) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      },
    };
    const client: Client = { ws, conn, room: null, playerId: null, windowStart: Date.now(), windowCount: 0, joinAttempts: 0, alive: true };
    this.clients.add(client);

    ws.on('pong', () => (client.alive = true));
    ws.on('error', () => ws.terminate());
    ws.on('close', () => {
      this.clients.delete(client);
      if (client.room && client.playerId) client.room.disconnect(client.playerId, conn);
    });
    ws.on('message', (data) => {
      client.alive = true;
      const now = Date.now();
      if (now - client.windowStart > RATE_WINDOW_MS) {
        client.windowStart = now;
        client.windowCount = 0;
      }
      if (++client.windowCount > this.rateMaxMessages) {
        ws.close(4008, 'too many messages');
        return;
      }
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      try {
        this.onMessage(client, msg);
      } catch (err) {
        console.error('message failed', msg?.t, err);
        conn.send({ t: 'error', code: 'invalid', message: 'Something went wrong' });
      }
    });
  }

  private onMessage(client: Client, msg: ClientMessage) {
    const { conn } = client;
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'create' || msg.t === 'join' || msg.t === 'resume') {
      if (client.room) return;
      if (++client.joinAttempts > MAX_JOIN_ATTEMPTS) {
        client.ws.close(4008, 'too many attempts');
        return;
      }
      if (msg.t === 'create') this.create(client, msg.name);
      else if (msg.t === 'join') this.join(client, msg.code, msg.name);
      else this.resume(client, msg.code, msg.token);
      return;
    }

    if (!client.room || !client.playerId) return;
    const room = client.room;
    if (msg.t === 'leave') {
      room.leave(client.playerId);
      client.room = null;
      client.playerId = null;
      conn.send({ t: 'left' });
      return;
    }
    if (!room.handle(client.playerId, msg)) {
      // Ignored quietly: late taps and stale buttons are normal in a live game.
      conn.send({ t: 'state', state: room.viewFor(client.playerId) });
    }
  }

  private create(client: Client, name: unknown) {
    if (this.rooms.size >= MAX_ROOMS) {
      client.conn.send({ t: 'error', code: 'server_full', message: 'The server is full, try again soon' });
      return;
    }
    const code = this.newCode();
    const room = new Room(code, this.bank, this.timers, (r) => this.rooms.delete(r.code));
    this.rooms.set(code, room);
    if (!this.enter(client, room, name)) room.destroy();
  }

  private join(client: Client, code: unknown, name: unknown) {
    const room = typeof code === 'string' ? this.rooms.get(code.trim().toUpperCase()) : undefined;
    if (!room) {
      client.conn.send({ t: 'error', code: 'room_not_found', message: 'No room with that code' });
      return;
    }
    this.enter(client, room, name);
  }

  private enter(client: Client, room: Room, name: unknown): boolean {
    const result = room.join(typeof name === 'string' ? name : '', client.conn);
    if ('error' in result) {
      client.conn.send(result.error);
      return false;
    }
    client.room = room;
    client.playerId = result.playerId;
    client.conn.send({ t: 'joined', code: room.code, token: result.token, playerId: result.playerId });
    return true;
  }

  private resume(client: Client, code: unknown, token: unknown) {
    const room = typeof code === 'string' ? this.rooms.get(code.trim().toUpperCase()) : undefined;
    const playerId = room && typeof token === 'string' ? room.resume(token, client.conn) : null;
    if (!room || !playerId) {
      client.conn.send({ t: 'error', code: 'resume_failed', message: 'That game is no longer available' });
      return;
    }
    client.room = room;
    client.playerId = playerId;
    client.conn.send({ t: 'joined', code: room.code, token: token as string, playerId });
  }
}
