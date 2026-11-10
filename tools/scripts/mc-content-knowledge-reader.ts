import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeKnowledge, digest, knowledgeSelection } from './local-authoring-knowledge-core';
import { queryKnowledge } from './local-authoring-query';
import type { KnowledgeExample, QueryKnowledge } from './local-authoring-query-types';
import type { ExampleGuide } from './local-authoring-example-guides';

function example(entry: KnowledgeExample): unknown {
  if (!/^references\/page-metadata\/examples\/[a-zA-Z0-9_-]+\.json$/.test(entry.file)) throw new Error('Invalid indexed example path');
  const content = readFileSync(new URL('../' + entry.file, import.meta.url), 'utf8');
  if (digest(content) !== entry.sha256) throw new Error('Example hash mismatch');
  return JSON.parse(content);
}

function guideText(guide:ExampleGuide):string {
  if(!/^references\/example-guides\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.md$/.test(guide.content.file)) throw new Error('Invalid indexed guide path');
  const text=readFileSync(new URL('../'+guide.content.file,import.meta.url),'utf8');
  if(digest(text)!==guide.content.sha256) throw new Error('Guide hash mismatch');
  return text;
}

try {
  const model: QueryKnowledge = decodeKnowledge(readFileSync(fileURLToPath(new URL('../references/authoring-knowledge/model.json', import.meta.url)), 'utf8'));
  const value = JSON.parse(readFileSync(0, 'utf8'));
  const {command, document, ...options} = value;
  if(command===undefined && Object.hasOwn(value,'document')) throw new TypeError('Target document requires find');
  if (command !== undefined && command !== 'find' && command !== 'show' && command !== 'resolve') throw new TypeError('Unknown knowledge command');
  const result = command === undefined ? knowledgeSelection(model, value.topics ?? [], value.pointers ?? [])
    : queryKnowledge(model, command, options, example,{readGuide:guideText,...(Object.hasOwn(value,'document')?{document}:{})});
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({error: String(error)}));
  process.exitCode = 1;
}
