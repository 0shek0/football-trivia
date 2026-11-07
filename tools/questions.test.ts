import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalize, validateQuestions } from './question-rules';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../content/questions/${name}.json`, import.meta.url), 'utf8'));
const good = { q: 'من فاز بكأس العالم؟', correct: 'البرازيل', wrong: ['إيطاليا', 'فرنسا', 'ألمانيا'] };
const set = (questions: typeof good[]) => [{ id: 's1', questions }];
const fill = (extra: typeof good) =>
  set([extra, { ...good, q: 'السؤال الثاني هنا؟' }, { ...good, q: 'السؤال الثالث هنا؟' }, { ...good, q: 'السؤال الرابع هنا؟' }, { ...good, q: 'السؤال الخامس هنا؟' }]);
const errorsFor = (extra: typeof good) => validateQuestions(fill(extra), []).errors.join('\n');

describe('question content', () => {
  it('passes validation', () => {
    expect(validateQuestions(read('standard'), read('death')).errors).toEqual([]);
  });

  it('meets the question count targets', () => {
    expect(read('standard').length).toBeGreaterThanOrEqual(200);
    expect(read('death').length).toBeGreaterThanOrEqual(200);
  });

  it('accepts a valid Arabic set', () => {
    expect(errorsFor(good)).toBe('');
  });

  it('requires 5 questions per set', () => {
    expect(validateQuestions(set([good]), []).errors.join()).toContain('exactly 5');
  });

  it('catches duplicates, even with different Arabic spellings', () => {
    expect(normalize('إيطاليا')).toBe(normalize('ايطاليا'));
    expect(errorsFor({ ...good, q: 'السؤال الثاني هنا؟' })).toContain('same question');
    expect(errorsFor({ ...good, wrong: ['ايطاليا', 'إيطاليا', 'فرنسا'] })).toContain('all be different');
  });

  it('needs exactly 3 wrong answers', () => {
    expect(errorsFor({ ...good, wrong: ['فرنسا'] })).toContain('3 wrong');
  });

  it('rejects anything not in Arabic', () => {
    expect(errorsFor({ ...good, q: 'Who won the World Cup?' })).toContain('in Arabic');
    expect(errorsFor({ ...good, correct: 'Brazil' })).toContain('English letters');
  });

  it('rejects years outside 1950-2024', () => {
    expect(errorsFor({ ...good, q: 'من فاز بكأس العالم 1930؟' })).toContain('year 1930');
    expect(errorsFor({ ...good, correct: '2025' })).toContain('year 2025');
    expect(errorsFor({ ...good, q: 'من فاز بكأس العالم 1950؟' })).toBe('');
    expect(errorsFor({ ...good, q: 'من فاز بكأس العالم 2024؟' })).toBe('');
  });
});
