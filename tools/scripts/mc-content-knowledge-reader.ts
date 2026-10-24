import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { knowledgeSelection, type AuthoringKnowledge } from './local-authoring-knowledge-core';

try {
  const model = JSON.parse(readFileSync(fileURLToPath(new URL('../references/authoring-knowledge/model.json', import.meta.url)), 'utf8')) as AuthoringKnowledge;
  const value = JSON.parse(readFileSync(0, 'utf8'));
  console.log(JSON.stringify(knowledgeSelection(model, value.topics ?? [], value.pointers ?? [])));
} catch (error) {
  console.error(JSON.stringify({error: String(error)}));
  process.exitCode = 1;
}
