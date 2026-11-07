import { readFileSync } from 'node:fs';
import type { Question, QuestionBank } from '@tb/engine';

interface RawQuestion {
  q: string;
  correct: string;
  wrong: [string, string, string];
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../../content/questions/${name}.json`, import.meta.url), 'utf8'));

const toQuestion = (id: string, raw: RawQuestion): Question => ({ id, text: raw.q, correct: raw.correct, wrong: raw.wrong });

// Stays on the server. Players only ever receive the question being played.
export function loadBank(): QuestionBank {
  const sets = read<{ id: string; questions: RawQuestion[] }[]>('standard');
  const death = read<(RawQuestion & { id: string })[]>('death');
  return {
    sets: sets.map((s) => ({ id: s.id, questions: s.questions.map((q, i) => toQuestion(`${s.id}-${i + 1}`, q)) })),
    death: death.map((q) => toQuestion(q.id, q)),
  };
}
