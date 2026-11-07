import type { ClientMessage, ErrorCode, RoomView, ServerMessage } from '@tb/shared';

const SESSION_KEY = 'tb.session';
const NAME_KEY = 'tb.name';

interface Session {
  code: string;
  token: string;
}

function readStorage(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    // Private browsing can block storage; the game still works without resume.
  }
}

class AppState {
  view = $state.raw<RoomView | null>(null);
  online = $state(false);
  errorCode = $state<ErrorCode | null>(null);
  errorMessage = $state<string | null>(null);
  resuming = $state(false);
  // Ticks a few times a second so countdowns update without per-component timers.
  now = $state(performance.now());
  phaseDeadline = $state(0);
  battleDeadline = $state(0);

  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer: number | undefined;
  private session: Session | null = null;
  private queue: ClientMessage[] = [];

  init() {
    const hasInvite = new URLSearchParams(location.search).has('room');
    const stored = readStorage(() => sessionStorage, SESSION_KEY) ?? (hasInvite ? null : readStorage(() => localStorage, SESSION_KEY));
    if (stored) {
      try {
        this.session = JSON.parse(stored);
        this.resuming = true;
      } catch {
        this.session = null;
      }
    }
    this.connect();
    setInterval(() => (this.now = performance.now()), 200);
    // Phones suspend sockets in the background, so reconnect the moment we return.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.reconnectNow();
    });
    addEventListener('online', () => this.reconnectNow());
  }

  get savedName(): string {
    return readStorage(() => localStorage, NAME_KEY) ?? '';
  }

  saveName(name: string) {
    writeStorage(() => localStorage, NAME_KEY, name);
  }

  private reconnectNow() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    clearTimeout(this.retryTimer);
    this.retry = 0;
    this.connect();
  }

  private connect() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    // Set when the page and the game server are hosted separately. See docs/DEPLOY.md.
    const server = import.meta.env.VITE_SERVER_URL as string | undefined;
    const ws = new WebSocket(server ? `${server.replace(/\/+$/, '')}/ws` : `${scheme}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.online = true;
      this.retry = 0;
      if (this.session) ws.send(JSON.stringify({ t: 'resume', code: this.session.code, token: this.session.token }));
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.online = false;
      const delay = Math.min(4000, 300 * 2 ** this.retry++);
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  private onMessage(msg: ServerMessage) {
    switch (msg.t) {
      case 'joined': {
        this.session = { code: msg.code, token: msg.token };
        const json = JSON.stringify(this.session);
        writeStorage(() => sessionStorage, SESSION_KEY, json);
        writeStorage(() => localStorage, SESSION_KEY, json);
        this.clearError();
        this.resuming = false;
        if (location.search) history.replaceState(null, '', location.pathname);
        break;
      }
      case 'state': {
        const at = performance.now();
        this.phaseDeadline = at + (msg.state.game?.msLeft ?? 0);
        this.battleDeadline = at + (msg.state.game?.myBattle?.msLeft ?? 0);
        this.now = at;
        this.view = msg.state;
        break;
      }
      case 'left':
        this.forgetSession();
        break;
      case 'error':
        if (msg.code === 'resume_failed') {
          this.forgetSession();
          break;
        }
        this.errorCode = msg.code;
        this.errorMessage = msg.message;
        break;
    }
  }

  private forgetSession() {
    this.session = null;
    this.view = null;
    this.resuming = false;
    writeStorage(() => sessionStorage, SESSION_KEY, null);
    writeStorage(() => localStorage, SESSION_KEY, null);
  }

  clearError() {
    this.errorCode = null;
    this.errorMessage = null;
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else if (msg.t === 'create' || msg.t === 'join') this.queue.push(msg);
  }

  leave() {
    this.send({ t: 'leave' });
    // The server is told if it can be reached, and the player goes home either way.
    this.forgetSession();
  }

  secondsLeft(deadline: number): number {
    return Math.max(0, Math.ceil((deadline - this.now) / 1000));
  }
}

export const app = new AppState();

export function haptic(ms = 12) {
  try {
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms);
  } catch {
    // Not supported everywhere.
  }
}
