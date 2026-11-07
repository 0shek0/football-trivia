import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { ClientMessage, RoomView, ServerMessage } from '@tb/shared';
import { TIMERS } from '@tb/shared';
import { loadBank } from '../src/bank';
import { Hub, type HubTimers } from '../src/hub';

const FAST: HubTimers = {
  ...TIMERS,
  teamNamingMs: 40,
  startCountdownMs: 5,
  waveBreakOverrideMs: 5,
  battleIntroMs: 1,
  revealMs: 1,
  disconnectGraceMs: 30,
  lobbyGraceMs: 30,
};

let server: Server;
let hub: Hub;
let url: string;

beforeAll(async () => {
  server = createServer();
  // Bots at test speed send far more than a person can, so the limit gets its own test.
  hub = new Hub(server, loadBank(), FAST, 1_000_000);
  await new Promise<void>((r) => server.listen(0, r));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
});

afterAll(() => {
  hub.close();
  server.close();
});

class Bot {
  ws!: WebSocket;
  state: RoomView | null = null;
  code = '';
  token = '';
  id = '';
  errors: string[] = [];
  leaks = 0;
  autoplay = true;
  private waiters: { test: () => boolean; resolve: () => void }[] = [];
  private answered = new Set<string>();

  async open() {
    this.ws = new WebSocket(url);
    await new Promise((r) => this.ws.once('open', r));
    this.ws.on('message', (data) => this.onMessage(JSON.parse(data.toString())));
  }

  send(msg: ClientMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  private onMessage(msg: ServerMessage) {
    if (msg.t === 'joined') {
      this.code = msg.code;
      this.token = msg.token;
      this.id = msg.playerId;
    }
    if (msg.t === 'error') this.errors.push(msg.code);
    if (msg.t === 'state') {
      this.state = msg.state;
      const b = msg.state.game?.myBattle;
      if (b && b.stage === 'question' && (b.correct !== null || b.opponentAnswer !== null)) this.leaks++;
      if (this.autoplay) this.play();
    }
    this.waiters = this.waiters.filter((w) => {
      if (!w.test()) return true;
      w.resolve();
      return false;
    });
  }

  private play() {
    const g = this.state?.game;
    if (!g) return;
    if (g.namingFor) this.send({ t: 'teamName', name: `Bots ${this.id.slice(0, 4)}` });
    const b = g.myBattle;
    if (b && b.stage === 'question' && b.myAnswer === null) {
      const key = `${b.id}:${b.sudden}:${b.question}`;
      if (!this.answered.has(key)) {
        this.answered.add(key);
        this.send({ t: 'answer', battleId: b.id, question: b.question, option: Math.floor(Math.random() * 4) });
      }
    }
  }

  until(test: () => boolean, ms = 20_000): Promise<void> {
    if (test()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out; phase=${this.state?.game?.phase}`)), ms);
      this.waiters.push({
        test,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
      });
    });
  }
}

async function makeRoom(count: number): Promise<Bot[]> {
  const host = new Bot();
  await host.open();
  host.send({ t: 'create', name: 'Bot 0' });
  await host.until(() => !!host.state);
  const bots = [host];
  for (let i = 1; i < count; i++) {
    const b = new Bot();
    await b.open();
    b.send({ t: 'join', code: host.code, name: `Bot ${i}` });
    await b.until(() => !!b.state);
    bots.push(b);
  }
  return bots;
}

const readyAll = async (bots: Bot[]) => {
  for (const b of bots.slice(1)) b.send({ t: 'ready', ready: true });
  await bots[0].until(() => bots[0].state?.lobby?.startError === null);
};

const closeAll = (bots: Bot[]) => bots.forEach((b) => b.ws.close());

describe('multiplayer server', () => {
  it('creates 6 character room codes and rejects bad joins', async () => {
    const [host] = await makeRoom(1);
    expect(host.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const other = new Bot();
    await other.open();
    other.send({ t: 'join', code: 'ZZZZZZ', name: 'Nope' });
    other.send({ t: 'join', code: host.code, name: 'B' });
    other.send({ t: 'join', code: host.code, name: 'bot 0' });
    await other.until(() => other.errors.length === 3);
    expect(other.errors).toEqual(['room_not_found', 'name_invalid', 'name_taken']);
    closeAll([host, other]);
  });

  it('a lower-case code still joins', async () => {
    const [host] = await makeRoom(1);
    const other = new Bot();
    await other.open();
    other.send({ t: 'join', code: host.code.toLowerCase(), name: 'Lower' });
    await other.until(() => !!other.state);
    closeAll([host, other]);
  });

  it('only the host can change settings or start', async () => {
    const bots = await makeRoom(2);
    bots[1].send({ t: 'settings', settings: { startingTiles: 7 } });
    bots[1].send({ t: 'start' });
    await bots[1].until(() => !!bots[1].state?.lobby);
    await new Promise((r) => setTimeout(r, 20));
    expect(bots[0].state!.lobby!.settings.startingTiles).toBe(3);
    expect(bots[0].state!.game).toBeNull();
    closeAll(bots);
  });

  it.each([2, 3, 5, 8])('%i bots play a full solo game to the end', async (n) => {
    const bots = await makeRoom(n);
    await readyAll(bots);
    bots[0].send({ t: 'start' });
    await Promise.all(bots.map((b) => b.until(() => b.state?.game?.phase === 'game_over', 50_000)));
    const g = bots[0].state!.game!;
    expect(new Set(g.tiles.map((t) => t.owner)).size).toBe(1);
    expect(g.winnerSide).toBe(g.tiles[0].owner);
    expect(bots.reduce((sum, b) => sum + b.leaks, 0)).toBe(0);
    closeAll(bots);
  });

  it('4 bots play a teams game including naming', async () => {
    const bots = await makeRoom(4);
    bots[0].send({ t: 'settings', settings: { mode: 'teams', teamCount: 2 } });
    await bots[0].until(() => bots[0].state?.lobby?.settings.mode === 'teams');
    await readyAll(bots);
    bots[0].send({ t: 'start' });
    await Promise.all(bots.map((b) => b.until(() => b.state?.game?.phase === 'game_over', 50_000)));
    const g = bots[0].state!.game!;
    expect(g.sides.every((s) => s.name.startsWith('Bots '))).toBe(true);
    closeAll(bots);
  });

  it('team naming times out into a random name', async () => {
    const bots = await makeRoom(4);
    bots.forEach((b) => (b.autoplay = false));
    bots[0].send({ t: 'settings', settings: { mode: 'teams', teamCount: 2 } });
    await bots[0].until(() => bots[0].state?.lobby?.settings.mode === 'teams');
    await readyAll(bots);
    bots[0].send({ t: 'start' });
    await bots[0].until(() => bots[0].state?.game?.phase === 'wave');
    expect(bots[0].state!.game!.sides.every((s) => s.named && !/^Team \d$/.test(s.name))).toBe(true);
    closeAll(bots);
  });

  it('a dropped player reconnects to the same seat and game', async () => {
    const bots = await makeRoom(2);
    await readyAll(bots);
    const [host, guest] = bots;
    guest.autoplay = false;
    host.send({ t: 'start' });
    await guest.until(() => guest.state?.game?.myBattle?.stage === 'question');
    const { token, code, id } = guest;
    guest.ws.close();
    await host.until(() => host.state?.game?.players.find((p) => p.id === id)?.connected === false);

    const back = new Bot();
    back.token = token;
    await back.open();
    back.send({ t: 'resume', code, token });
    await back.until(() => !!back.state?.game);
    expect(back.state!.you).toBe(id);
    await host.until(() => host.state?.game?.players.find((p) => p.id === id)?.connected === true);
    closeAll([host, back]);
  });

  it('a resume with a wrong token fails', async () => {
    const [host] = await makeRoom(1);
    const other = new Bot();
    await other.open();
    other.send({ t: 'resume', code: host.code, token: 'wrong' });
    await other.until(() => other.errors.includes('resume_failed'));
    closeAll([host, other]);
  });

  it('a player gone past the grace period counts as left and the game ends for the rest', async () => {
    const bots = await makeRoom(2);
    await readyAll(bots);
    const [host, guest] = bots;
    host.send({ t: 'start' });
    await host.until(() => host.state?.game?.phase === 'wave');
    guest.ws.close();
    await host.until(() => host.state?.game?.phase === 'game_over');
    expect(host.state!.game!.winnerSide).toBe(host.state!.game!.players.find((p) => p.id === host.id)!.sideId);
    closeAll([host]);
  });

  it('the host leaving the lobby passes host on', async () => {
    const bots = await makeRoom(2);
    bots[0].send({ t: 'leave' });
    await bots[1].until(() => bots[1].state?.hostId === bots[1].id);
    closeAll(bots);
  });

  it('rooms are removed once everyone has gone', async () => {
    const [host] = await makeRoom(1);
    const code = host.code;
    expect(hub.rooms.has(code)).toBe(true);
    host.send({ t: 'leave' });
    await new Promise((r) => setTimeout(r, 50));
    expect(hub.rooms.has(code)).toBe(false);
    closeAll([host]);
  });

  describe('the break between waves', () => {
    let breakServer: Server;
    let breakHub: Hub;
    const original = { url: '' };

    beforeAll(async () => {
      // Real break lengths here, so the wave only moves on when the test says so.
      breakServer = createServer();
      breakHub = new Hub(breakServer, loadBank(), { ...FAST, waveBreakOverrideMs: undefined }, 1_000_000);
      await new Promise<void>((r) => breakServer.listen(0, r));
      original.url = url;
      url = `ws://127.0.0.1:${(breakServer.address() as AddressInfo).port}/ws`;
    });

    afterAll(() => {
      url = original.url;
      breakHub.close();
      breakServer.close();
    });

    const playToBreak = async (settings: object) => {
      const bots = await makeRoom(3);
      bots[0].send({ t: 'settings', settings });
      await bots[0].until(() => bots[0].state?.lobby?.settings.startingTiles === 8);
      await readyAll(bots);
      bots[0].send({ t: 'start' });
      await Promise.all(bots.map((b) => b.until(() => b.state?.game?.phase === 'intermission')));
      return bots;
    };

    it('defaults to 30 seconds and the host can start the next wave at once', async () => {
      const bots = await playToBreak({ startingTiles: 8 });
      const left = bots[0].state!.game!.msLeft;
      expect(left).toBeGreaterThan(28_000);
      expect(left).toBeLessThanOrEqual(30_000);
      bots[1].send({ t: 'nextWave' });
      await new Promise((r) => setTimeout(r, 50));
      expect(bots[0].state!.game!.wave).toBe(1);
      bots[0].send({ t: 'nextWave' });
      await bots[1].until(() => (bots[1].state?.game?.wave ?? 0) >= 2);
      closeAll(bots);
    });

    it('the host can choose a 5 minute break', async () => {
      const bots = await playToBreak({ startingTiles: 8, waveBreakSec: 300 });
      expect(bots[0].state!.game!.msLeft).toBeGreaterThan(290_000);
      closeAll(bots);
    });

    it('sends the stats the leaderboard needs', async () => {
      const bots = await playToBreak({ startingTiles: 8 });
      const players = bots[0].state!.game!.players;
      const playing = players.filter((p) => p.roundsPlayed > 0);
      for (const p of playing) expect(p.correct + p.wrong).toBeGreaterThanOrEqual(5);
      expect(players.reduce((sum, p) => sum + p.answered, 0)).toBeGreaterThan(0);
      closeAll(bots);
    });
  });

  describe('spectating', () => {
    it('shows a waiting player both picks live, but the right answer only at the reveal', async () => {
      const bots = await makeRoom(4);
      bots.forEach((b) => (b.autoplay = false));
      await readyAll(bots);
      bots[0].send({ t: 'start' });
      await bots[0].until(() => bots[0].state?.game?.phase === 'wave');
      const { battles } = bots[0].state!.game!;
      const bot = (id: string) => bots.find((b) => b.id === id)!;
      const [first, second] = battles;
      const watcher = bot(first.a);
      const fighterA = bot(second.a);
      const fighterB = bot(second.b);

      // The first round plays out while the second sits on its first question.
      bot(first.a).autoplay = true;
      bot(first.b).autoplay = true;
      await Promise.all([fighterA, fighterB].map((b) => b.until(() => b.state?.game?.myBattle?.stage === 'question')));
      watcher.send({ t: 'spectate', battleId: null });
      await watcher.until(() => watcher.state?.game?.battles.find((b) => b.id === first.id)?.finished === true);

      watcher.send({ t: 'spectate', battleId: second.id });
      await watcher.until(() => !!watcher.state?.game?.spectating);
      const watched = watcher.state!.game!.spectating!;
      expect(watched.id).toBe(second.id);
      expect(watched.stage).toBe('question');
      expect(watched.text).toBeTruthy();
      expect(watched.options).toHaveLength(4);
      expect(watched.correct).toBeNull();

      fighterA.send({ t: 'answer', battleId: second.id, question: 1, option: 2 });
      await watcher.until(() => watcher.state?.game?.spectating?.answerA === 2);
      expect(watcher.state!.game!.spectating!.correct).toBeNull();
      // The other player in the round learns they answered, not what they picked.
      await fighterB.until(() => fighterB.state?.game?.myBattle?.opponentAnswered === true);
      expect(fighterB.state!.game!.myBattle!.opponentAnswer).toBeNull();
      expect(fighterB.state!.game!.spectating).toBeNull();

      fighterB.send({ t: 'answer', battleId: second.id, question: 1, option: 3 });
      let reveal = watcher.state!.game!.spectating!;
      await watcher.until(() => {
        reveal = watcher.state!.game!.spectating!;
        return reveal.stage === 'reveal';
      });
      expect(reveal.answerB).toBe(3);
      expect(reveal.correct).toEqual(expect.any(Number));

      // Still fighting, so no watching for them.
      fighterA.send({ t: 'spectate', battleId: first.id });
      await new Promise((r) => setTimeout(r, 20));
      expect(fighterA.state!.game!.spectating).toBeNull();

      watcher.send({ t: 'spectate', battleId: null });
      await watcher.until(() => watcher.state?.game?.spectating === null);
      closeAll(bots);
    });

    it('an eliminated player can watch the rounds still being played', async () => {
      const bots = await makeRoom(5);
      await readyAll(bots);
      bots[0].send({ t: 'start' });
      let watchedAs = '';
      const tryToWatch = (b: Bot) => {
        const g = b.state?.game;
        if (!g || g.phase !== 'wave' || watchedAs) return false;
        const side = g.sides.find((s) => s.memberIds.includes(b.id));
        if (!side?.eliminated) return false;
        if (g.spectating) {
          watchedAs = b.id;
          return true;
        }
        const live = g.battles.find((x) => !x.finished);
        if (live) b.send({ t: 'spectate', battleId: live.id });
        return false;
      };
      await Promise.race(bots.map((b) => b.until(() => tryToWatch(b), 50_000)));
      expect(watchedAs).not.toBe('');
      closeAll(bots);
    });
  });

  it('disconnects a client that floods messages', async () => {
    const floodServer = createServer();
    const floodHub = new Hub(floodServer, loadBank(), FAST, 10);
    await new Promise<void>((r) => floodServer.listen(0, r));
    const ws = new WebSocket(`ws://127.0.0.1:${(floodServer.address() as AddressInfo).port}/ws`);
    await new Promise((r) => ws.once('open', r));
    const closed = new Promise<number>((r) => ws.once('close', r));
    for (let i = 0; i < 20; i++) ws.send('{}');
    expect(await closed).toBe(4008);
    floodHub.close();
    floodServer.close();
  });

  it('survives malformed messages', async () => {
    const [host] = await makeRoom(1);
    host.ws.send('not json');
    host.ws.send('null');
    host.ws.send(JSON.stringify({ t: 'answer' }));
    host.ws.send(JSON.stringify({ t: 'settings', settings: null }));
    host.ws.send(JSON.stringify({ t: 'team', team: 'x' }));
    host.ws.send(JSON.stringify({ t: 'color', color: 'nope' }));
    host.send({ t: 'settings', settings: { startingTiles: 5 } });
    await host.until(() => host.state?.lobby?.settings.startingTiles === 5);
    closeAll([host]);
  });

  it('play again returns the host and players to the lobby', async () => {
    const bots = await makeRoom(2);
    await readyAll(bots);
    bots[0].send({ t: 'start' });
    await bots[0].until(() => bots[0].state?.game?.phase === 'game_over', 30_000);
    bots[0].send({ t: 'playAgain' });
    await bots[1].until(() => !!bots[1].state?.lobby);
    expect(bots[1].state!.game).toBeNull();
    closeAll(bots);
  });
});
