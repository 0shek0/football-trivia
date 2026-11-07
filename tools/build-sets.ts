// Builds content/questions/standard.json from the topic files in content/questions/pools.
// Sets mix topics, so one round never feels like five questions on the same thing.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { RawQuestion } from './question-rules';

const dir = new URL('../content/questions/', import.meta.url);

// Fixed seed: rebuilding with the same questions always gives the same sets.
let state = 2024;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = <T>(items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const files = readdirSync(new URL('pools/', dir)).filter((f) => f.endsWith('.json')).sort();
const topics = files.map((f) => shuffle(JSON.parse(readFileSync(new URL(`pools/${f}`, dir), 'utf8')) as RawQuestion[]));
const sizes = topics.map((t) => t.length);
const total = sizes.reduce((sum, n) => sum + n, 0);

const sets: { id: string; questions: RawQuestion[] }[] = [];
for (;;) {
  // Draw from the fullest topics, and never the same topic twice in a set.
  const picks = topics.filter((t) => t.length > 0).sort((a, b) => b.length - a.length).slice(0, 5);
  if (picks.length < 5) break;
  sets.push({ id: `s${String(sets.length + 1).padStart(3, '0')}`, questions: shuffle(picks.map((t) => t.pop()!)) });
}

writeFileSync(new URL('standard.json', dir), `[\n${sets.map((s) => JSON.stringify(s)).join(',\n')}\n]\n`);
console.log(`${files.length} topics, ${total} questions, ${sets.length} sets, ${total - sets.length * 5} unused`);
files.forEach((f, i) => console.log(`  ${f}: ${sizes[i]}`));
