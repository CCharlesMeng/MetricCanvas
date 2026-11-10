import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeKnowledge, digest, knowledgeSelection } from './local-authoring-knowledge-core';
import { queryKnowledge } from './local-authoring-query';
import type { KnowledgeExample, KnowledgeQuery, QueryKnowledge } from './local-authoring-query-types';
import type { ExampleGuide } from './local-authoring-example-guides';

type Manifest = {schemaVersion: string; files: Array<{file: string; sha256: string}>};
const HELP = {
  commands: ['resolve --document target.json --at binding-pointer --aspect numeric-format|signed-number|time-format|display-unit [--cursor returned-cursor]',
    'find --kind schema|example|semantic|rule|guide [--owner type] [--query text] [--limit 1..30] [--cursor returned-cursor]',
    'find --kind semantic --example returned-example-id [--query text] [--owner module] [--limit 1..30] [--cursor returned-cursor]',
    'find --document target.json --at document-pointer [--query text] [--limit 1..30] [--cursor returned-cursor]',
    'find --kind component --document target.json [--owner type] [--query label-or-id] [--at scope-pointer]',
    'show --id returned-id [--select facet] [--owner returned-owner] [--at pointer] [--branch returned-branch] [--limit 1..30] [--cursor returned-cursor]',
    'list --module id', 'show --topic id [--topic id] [--pointer schema-pointer]'],
  output: 'JSON; find <=1024 bytes, new show <=2048 bytes, resolve <=8192 bytes; complete describes this selected view only; coverage is registered scope, never task acceptance; follow next and required dependencies',
  continuation: 'If next is returned, repeat the same command and arguments with --cursor <next>; --next <next> is an equivalent alias. Use only one cursor option. A changed input or selection invalidates the cursor.',
  sideEffects: 'read-only; examples and protocol data remain inside the installed Skill',
  compatibility: 'list and topic/pointer show retain their legacy output; normal authoring uses find and facet show',
  errors: '1 usage/topic; 2 damaged knowledge'
};

function readModel(root: string): {model: QueryKnowledge; manifest: Manifest} {
  const file = 'references/authoring-knowledge/model.json';
  const manifest: Manifest = JSON.parse(readFileSync(path.join(root, 'references/knowledge.json'), 'utf8'));
  const content = readFileSync(path.join(root, file), 'utf8');
  if (manifest.files.find(item => item.file === file)?.sha256 !== digest(content)) throw new Error('Knowledge hash mismatch; replace the complete Skill');
  const model: QueryKnowledge = decodeKnowledge(content);
  if (model.schemaVersion !== manifest.schemaVersion) throw new Error('Knowledge version mismatch');
  if (model.formatVersion !== undefined && ![1, 2, 3, 4].includes(model.formatVersion)) throw new Error('Unsupported knowledge format; replace the complete Skill');
  return {model, manifest};
}

function loadExample(root: string, manifest: Manifest, entry: KnowledgeExample): unknown {
  if (!/^references\/page-metadata\/examples\/[a-zA-Z0-9_-]+\.json$/.test(entry.file)) throw new Error('Invalid indexed example path');
  const content = readFileSync(path.join(root, entry.file), 'utf8');
  const expected = manifest.files.find(file => file.file === entry.file)?.sha256;
  if (expected !== digest(content) || entry.sha256 !== expected) throw new Error('Example hash mismatch; replace the complete Skill');
  return JSON.parse(content);
}

function loadGuide(root:string,manifest:Manifest,guide:ExampleGuide):string {
  const file=guide.content.file;
  if(!/^references\/example-guides\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.md$/.test(file)) throw new Error('Invalid indexed guide path');
  const text=readFileSync(path.join(root,file),'utf8');
  if(digest(text)!==guide.content.sha256 || manifest.files.find(entry=>entry.file===file)?.sha256!==guide.content.sha256) throw new Error('Guide hash mismatch; replace the complete Skill');
  return text;
}

type CliQuery=KnowledgeQuery & {document?:string};
function options(args: string[]): CliQuery {
  const allowed = ['kind', 'owner', 'query', 'id', 'select', 'at', 'branch', 'cursor', 'limit', 'document', 'example', 'aspect'];
  const value: Record<string, string> = {};
  if (args.length % 2) throw new TypeError('Options require --name value pairs');
  for (let i = 0; i < args.length; i += 2) {
    const rawKey = args[i]!.replace(/^--/, '');
    const key = rawKey === 'next' ? 'cursor' : rawKey;
    if (!args[i]!.startsWith('--') || !allowed.includes(key) || Object.hasOwn(value, key)) throw new TypeError(`Unknown or repeated option: ${args[i]}`);
    value[key] = args[i + 1]!;
  }
  return validatedOptions(value);
}

function validatedOptions(value: Record<string, string>): CliQuery {
  if (value.kind && !['schema', 'example', 'semantic', 'rule', 'guide', 'component'].includes(value.kind)) throw new TypeError('Unknown kind');
  const limit = value.limit === undefined ? undefined : Number(value.limit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 30)) throw new TypeError('limit must be 1..30');
  return {...value, kind: value.kind as KnowledgeQuery['kind'], limit};
}

function queryOptions(command: 'find' | 'show' | 'resolve', rest: string[]): CliQuery {
  const value = options(rest);
  if (command === 'resolve') return value;
  const disallowed = command === 'find' ? ['id', 'select', 'branch',...(value.document?[]:['at'])] : ['query', 'kind','document','example'];
  for (const key of disallowed) if (Object.hasOwn(value, key) && value[key as keyof KnowledgeQuery] !== undefined) {
    throw new TypeError(`${command} does not accept --${key}`);
  }
  return value;
}

function legacy(model: QueryKnowledge, command: string, rest: string[]): unknown {
  if (command === 'list' && rest.length === 2 && rest[0] === '--module') {
    if (!Object.hasOwn(model.modules, rest[1]!)) throw new TypeError(`Unknown module: ${rest[1]}`);
    return Object.entries(model.topics).filter(([,topic]) => topic.module === rest[1]).map(([id,t]) => ({id, title:t.title, dependencies:t.dependencies}));
  }
  if (command !== 'show' || !rest.length || rest.length % 2 || rest.some((arg,i) => i % 2 === 0 && !['--topic','--pointer'].includes(arg))) throw new TypeError('Use --help for knowledge queries');
  const values = (flag: string) => rest.filter((_,i) => i % 2 === 1 && rest[i - 1] === flag);
  return knowledgeSelection(model, values('--topic'), values('--pointer'));
}

function commandHelp(command: string): typeof HELP {
  const commands = HELP.commands.filter(usage => usage.startsWith(command + ' '));
  if (!commands.length) throw new TypeError('Unknown command; use --help for knowledge queries');
  return { ...HELP, commands };
}

function run(args: string[]): unknown {
  if (args.length === 1 && args[0] === '--help') return HELP;
  if (args.length === 2 && args[1] === '--help') return commandHelp(args[0]!);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const {model, manifest} = readModel(root);
  if (args.length === 1 && args[0] === '--version') return {schemaVersion:model.schemaVersion, knowledgeFormatVersion:model.formatVersion ?? 1};
  const [command, ...rest] = args;
  if (command === 'list' || rest.includes('--topic') || rest.includes('--pointer')) return legacy(model, command!, rest);
  if (command !== 'find' && command !== 'show' && command !== 'resolve') throw new TypeError('Use --help for knowledge queries');
  return runQuery(root,manifest,model,command,queryOptions(command,rest));
}

function runQuery(root:string,manifest:Manifest,model:QueryKnowledge,command:'find'|'show'|'resolve',options:CliQuery):unknown {
  const {document,...selection}=options;
  const context={readGuide:(guide:ExampleGuide)=>loadGuide(root,manifest,guide),
    ...(document!==undefined?{document:targetDocument(document)}:{})};
  return queryKnowledge(model,command,selection,entry=>loadExample(root,manifest,entry),context);
}

function targetDocument(file:string):unknown {
  try {return JSON.parse(readFileSync(file,'utf8'));}
  catch {throw new TypeError('Cannot read target document JSON');}
}

try { console.log(JSON.stringify(run(process.argv.slice(2)))); }
catch (error) {
  console.error(JSON.stringify({error: error instanceof Error ? error.message : String(error)}));
  process.exitCode = error instanceof TypeError || /Unknown (topic|schema pointer)/.test(String(error)) ? 1 : 2;
}
