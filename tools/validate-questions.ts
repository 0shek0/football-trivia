import { readFileSync } from 'node:fs';
import { validateQuestions } from './question-rules';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../content/questions/${name}.json`, import.meta.url), 'utf8'));
const sets = read('standard');
const death = read('death');
const { errors, warnings } = validateQuestions(sets, death);

console.log(`${sets.length} sets (${sets.length * 5} questions), ${death.length} death questions`);
warnings.forEach((w) => console.log(`warning: ${w}`));
errors.forEach((e) => console.error(`error: ${e}`));
if (errors.length) process.exit(1);
console.log('Questions are valid');
