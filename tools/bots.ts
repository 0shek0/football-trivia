// Fills a room with bots so one person can test the game.
// Usage: npm run bots -- ROOMCODE [count] [accuracy 0-1] [answer delay in ms]
import WebSocket from 'ws';
import type { RoomView, ServerMessage } from '@tb/shared';

const [code, countArg = '1', accuracyArg = '0.5', delayArg = '1500'] = process.argv.slice(2);
if (!code) {
  console.error('Usage: npm run bots -- ROOMCODE [count] [accuracy] [delayMs]');
  process.exit(1);
}
const url = process.env.TB_URL ?? 'ws://localhost:8787/ws';
const NAMES = ['Pele Bot', 'Zico Bot', 'Xavi Bot', 'Kaka Bot', 'Pirlo Bot', 'Figo Bot', 'Puyol Bot'];
const delay = Number(delayArg);

for (let i = 0; i < Number(countArg); i++) {
  const ws = new WebSocket(url);
  const answered = new Set<string>();
  let named = false;
  const send = (m: unknown) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
  ws.on('open', () => send({ t: 'join', code, name: NAMES[i] }));
  ws.on('close', () => console.log(`${NAMES[i]} disconnected`));
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ServerMessage;
    if (msg.t === 'error') console.log(`${NAMES[i]}: ${msg.message}`);
    if (msg.t === 'state') act(msg.state);
  });
  const act = (view: RoomView) => {
    if (view.lobby) {
      named = false;
      if (!view.lobby.players.find((p) => p.id === view.you)?.ready) send({ t: 'ready', ready: true });
      return;
    }
    const game = view.game!;
    if (game.namingFor && !named) {
      named = true;
      setTimeout(() => send({ t: 'teamName', name: `${NAMES[i].split(' ')[0]} United` }), delay);
    }
    const b = game.myBattle;
    if (!b || b.stage !== 'question' || b.myAnswer !== null) return;
    const key = `${b.id}:${b.sudden}:${b.question}`;
    if (answered.has(key)) return;
    answered.add(key);
    // Bots can't see the answer, so "accuracy" is modelled by answering at random more or less often.
    const answers = Math.random() < Number(accuracyArg);
    setTimeout(() => {
      if (answers) send({ t: 'answer', battleId: b.id, question: b.question, option: Math.floor(Math.random() * 4) });
    }, delay + Math.random() * delay);
  };
}
