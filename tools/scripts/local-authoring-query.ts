import { resolveDocumentContract } from './local-authoring-contract-query';
import { findSchema, showSchema } from './local-authoring-schema-query';
import { findExamples, showExample } from './local-authoring-example-query';
import { findSemantic, showSemantic } from './local-authoring-semantic-query';
import { queryPage } from './local-authoring-query-budget';
import { findRules, showRule } from './local-authoring-query-rules';
import type { ExampleLoader, KnowledgeQuery, QueryKnowledge, QueryResult, KnowledgeQueryContext } from './local-authoring-query-types';
import { digest } from './local-authoring-knowledge-core';
import { findGuides, showGuide } from './local-authoring-guide-query';
import { findDocumentSchema } from './local-authoring-document-query';
import { findDocumentComponents } from './local-authoring-document-components';

export function queryKnowledge(model: QueryKnowledge, command: 'find' | 'show' | 'resolve', options: KnowledgeQuery, load: ExampleLoader, context:KnowledgeQueryContext={}): QueryResult {
  const hasDocument=Object.hasOwn(context,'document');
  if(command==='resolve') return resolveQuery(model,options,context);
  if(options.aspect!==undefined) throw new TypeError('aspect requires resolve');
  if(hasDocument && command!=='find') throw new TypeError('Target document is only accepted by find');
  validateQuery(command, options,hasDocument);
  const kind = command === 'show' ? resourceKind(options.id) : options.kind ?? 'schema';
  const result = hasDocument?documentQuery(model,options,context.document):
    command === 'find' ? find(model, options, kind) : show(model, options, kind, load,context);
  return queryPage(result, options, command, digest(JSON.stringify({model,document:context.document})));
}

function documentQuery(model:QueryKnowledge,options:KnowledgeQuery,document:unknown):QueryResult {
  return options.kind==='component'?findDocumentComponents(document,options):findDocumentSchema(model,options,document);
}

function validateQuery(command: 'find' | 'show' | 'resolve', options: KnowledgeQuery, hasDocument:boolean): void {
  validateExampleScope(command,options,hasDocument);
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 30)) throw new TypeError('limit must be 1..30');
  const allowed = new Set(['kind','owner','query','id','select','at','branch','cursor','limit','example']);
  for (const [key, value] of Object.entries(options)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown knowledge option: ${key}`);
    if (key !== 'limit' && value !== undefined && typeof value !== 'string') throw new TypeError(`${key} must be a string`);
  }
  const forbidden = command === 'find' ? ['id','select','branch',...(hasDocument?[]:['at'])] : ['query','kind'];
  if (forbidden.some(key => options[key as keyof KnowledgeQuery] !== undefined)) throw new TypeError(`Unsupported ${command} option`);
}

function validateExampleScope(command: 'find' | 'show' | 'resolve', options: KnowledgeQuery, hasDocument: boolean): void {
  if (options.example === undefined) return;
  if (command !== 'find' || options.kind !== 'semantic' || hasDocument) {
    throw new TypeError('--example is only accepted by semantic find without a target document');
  }
}

function resourceKind(id: string | undefined): string {
  const kind = id?.split(':')[0];
  if (!['schema', 'example', 'semantic', 'rule', 'guide'].includes(kind ?? '')) throw new TypeError('show requires a returned resource id');
  return kind!;
}

function find(model: QueryKnowledge, options: KnowledgeQuery, kind: string): QueryResult {
  switch (kind) {
    case 'schema': return findSchema(model, options);
    case 'example': return findExamples(model, options);
    case 'semantic': return findSemantic(model, options);
    case 'rule': return findRules(model, options);
    case 'guide': return findGuides(model, options);
    case 'component': throw new TypeError('Component directory requires a target document');
    default: throw new TypeError(`Unknown knowledge kind: ${kind}`);
  }
}

function show(model: QueryKnowledge, options: KnowledgeQuery, kind: string, load: ExampleLoader, context:KnowledgeQueryContext): QueryResult {
  switch (kind) {
    case 'schema': return showSchema(model, options);
    case 'example': return showExample(model, options, load);
    case 'semantic': return showSemantic(model, options);
    case 'rule': return showRule(model, options);
    case 'guide': return showGuide(model,options,guide=>{
      if(!context.readGuide) throw new TypeError('Guide text loader unavailable');
      return context.readGuide(guide);
    });
    default: throw new TypeError(`Unknown knowledge kind: ${kind}`);
  }
}

/** A single contract read combines registered structure and verbatim behavior. */
function resolveQuery(model: QueryKnowledge, options: KnowledgeQuery, context: KnowledgeQueryContext): QueryResult {
  if (!Object.hasOwn(context, 'document')) throw new TypeError('resolve requires document');
  const allowed = new Set(['at', 'aspect', 'cursor', 'limit']);
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    if (!allowed.has(key)) throw new TypeError(`resolve does not accept ${key}`);
    if (key !== 'limit' && typeof value !== 'string') throw new TypeError(`${key} must be a string`);
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 30)) throw new TypeError('limit must be 1..30');
  const result = resolveDocumentContract(model, options, context.document);
  return queryPage(result, {...options, limit: options.limit ?? 30}, 'resolve', digest(JSON.stringify({model, document: context.document})));
}
