// Checks the question files against rule 6, rule 10 and the content rules before they reach players.
export interface RawQuestion {
  q: string;
  correct: string;
  wrong: string[];
}
export interface RawSet {
  id: string;
  questions: RawQuestion[];
}
export type RawDeath = RawQuestion & { id: string };

export const FIRST_YEAR = 1950;
export const LAST_YEAR = 2024;

// Arabic letters that are often swapped count as the same, so duplicates can't hide behind spelling.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

const LATIN = /[A-Za-z]/;
const ARABIC = /[؀-ۿ]/;

function checkText(label: string, text: string, errors: string[]) {
  if (LATIN.test(text)) errors.push(`${label}: has English letters: ${text}`);
  for (const match of text.matchAll(/(?<!\d)(\d{4})(?!\d)/g)) {
    const year = Number(match[1]);
    // Only numbers that could be years: "5000 to 1" betting odds are fine.
    if (year >= 1800 && year <= 2100 && (year < FIRST_YEAR || year > LAST_YEAR)) errors.push(`${label}: year ${year} is outside ${FIRST_YEAR}-${LAST_YEAR}`);
  }
}

function checkQuestion(label: string, q: RawQuestion, errors: string[]) {
  if (typeof q.q !== 'string' || q.q.trim().length < 8) errors.push(`${label}: question text is missing`);
  else if (!ARABIC.test(q.q)) errors.push(`${label}: question must be in Arabic`);
  if (typeof q.correct !== 'string' || !q.correct.trim()) errors.push(`${label}: correct answer is missing`);
  if (!Array.isArray(q.wrong) || q.wrong.length !== 3) {
    errors.push(`${label}: needs exactly 3 wrong answers`);
    return;
  }
  const options = [q.correct, ...q.wrong].map(normalize);
  if (new Set(options).size !== 4) errors.push(`${label}: answers must all be different`);
  if (options.some((o) => !o)) errors.push(`${label}: blank answer`);
  checkText(label, q.q ?? '', errors);
  for (const option of [q.correct, ...q.wrong]) checkText(label, option ?? '', errors);
}

export function validateQuestions(sets: RawSet[], death: RawDeath[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const texts = new Map<string, string>();

  const noteText = (label: string, text: string) => {
    const key = normalize(text ?? '');
    const first = texts.get(key);
    if (first) errors.push(`${label}: same question as ${first}`);
    else texts.set(key, label);
  };

  for (const set of sets) {
    if (ids.has(set.id)) errors.push(`${set.id}: duplicate id`);
    ids.add(set.id);
    if (!Array.isArray(set.questions) || set.questions.length !== 5) {
      errors.push(`${set.id}: a set needs exactly 5 questions`);
      continue;
    }
    set.questions.forEach((q, i) => {
      const label = `${set.id}-${i + 1}`;
      checkQuestion(label, q, errors);
      noteText(label, q.q);
    });
  }
  for (const q of death) {
    if (ids.has(q.id)) errors.push(`${q.id}: duplicate id`);
    ids.add(q.id);
    checkQuestion(q.id, q, errors);
    noteText(q.id, q.q);
  }

  if (sets.length * 5 < 1000) warnings.push(`Standard pool has ${sets.length * 5} questions, target is 1000-1500`);
  if (death.length < 200) warnings.push(`Death pool has ${death.length} questions, target is 200+`);
  return { errors, warnings };
}
