import type { AuthoringKnowledge } from './local-authoring-knowledge-core';
import type { ContractBinding } from './local-authoring-contract-query';
import type { ExampleGuide } from './local-authoring-example-guides';

export interface ExampleObject { id: string; type: string; path: string }
export interface KnowledgeExample {
  id: string; file: string; pageId: string; title: string; layout: string;
  bytes: number; sha256: string; objects: ExampleObject[]; sourceTypes: string[];
  guides?: ExampleGuide[];
}
export interface QueryKnowledge extends AuthoringKnowledge {
  formatVersion?: number;
  contracts?: ContractBinding[];
  examples?: KnowledgeExample[];
  passages?: KnowledgePassage[];
  ruleBindings?: KnowledgeRule[];
}
export interface KnowledgeRule {
  id: string; description: string; owners: string[]; valid: string[]; invalid: string[];
}
export interface KnowledgePassage {
  id: string; module: string; section: number; title: string; start: number; end: number;
}
export interface KnowledgeQuery {
  kind?: 'schema' | 'example' | 'semantic' | 'rule' | 'guide' | 'component';
  aspect?: string;
  owner?: string; query?: string; id?: string; select?: string; example?: string;
  at?: string; branch?: string; cursor?: string; limit?: number;
}
export type QueryResult = Record<string, unknown>;
export type ExampleLoader = (entry: KnowledgeExample) => unknown;
export interface KnowledgeQueryContext {
  document?: unknown;
  readGuide?: (guide: ExampleGuide) => string;
}
