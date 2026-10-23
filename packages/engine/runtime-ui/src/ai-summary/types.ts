import type { FilterValue } from '../../../runtime/src';
import type { DataSnapshot, EffectiveQuery, ResolvedFieldDefinition } from '@metriccanvas/page/internal';

export interface AiSummaryDataSource {
  id: string;
  description: string;
  fields: Record<string, ResolvedFieldDefinition>;
  query?: EffectiveQuery;
  resultScope: 'complete' | 'window';
  result: DataSnapshot;
}

export interface AiSummaryContextInfo {
  pageId: string;
  pageRevision: string;
  componentId: string;
  sectionIds: string[];
  region?: { kind: 'section' | 'compositeCard' | 'tab'; id: string; sectionId: string };
  timeFilters: Record<string, FilterValue>;
  dataSources: AiSummaryDataSource[];
}

/** 集成应用实现；SSE 构建、事件解析和内容累积均在此 Interface 之后。 */
export type AiSummaryGenerate = (question: string, contextInfo: AiSummaryContextInfo) => Promise<string>;

export interface AiSummaryConfig {
  generate: AiSummaryGenerate;
  throttleMs?: number;
  concurrency?: number;
  maxEntries?: number;
  ttlMs?: number;
}

export type AiSummarySnapshot =
  | { status: 'loading' }
  | { status: 'ready'; text: string; format?: 'semanticHtml' | 'text' }
  | { status: 'empty' }
  | { status: 'error'; error: { message: string } };
