import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeKnowledge, knowledgeSelection } from './local-authoring-knowledge-core';

try {
  const model = decodeKnowledge(readFileSync(fileURLToPath(new URL('../references/authoring-knowledge/model.json', import.meta.url)), 'utf8'));
  const value = JSON.parse(readFileSync(0, 'utf8'));
  console.log(JSON.stringify(knowledgeSelection(model, value.topics ?? [], value.pointers ?? [])));
} catch (error) {
  console.error(JSON.stringify({error: String(error)}));
  process.exitCode = 1;
}
