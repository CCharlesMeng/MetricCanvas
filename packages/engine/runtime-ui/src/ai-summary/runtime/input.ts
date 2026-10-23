import { aiSummaryRelatedData, aiSummarySourceReferences, hasAiSummaryBody, canonicalizeJson, resolveDataSourceFields,
  type AiSummaryProps, type DataSnapshot, type Page, type EffectiveQuery, type TabSelections } from '@metriccanvas/page/internal';
import type { PageDataSnapshots, FilterValue, FilterValues } from '../../../../runtime/src';
import type { AiSummaryContextInfo, AiSummaryDataSource } from '../types';
import { semanticHtmlInstructions } from '../../../../widgets/src/shared/semantic-html';


export const AI_SUMMARY_RUNTIME_CONTEXT = Symbol('metriccanvas.aiSummaryRuntime');
export interface AiSummaryRuntimeContext {
  page: Page;
  pageRevision?: string;
  documentKey: string;
  filters: FilterValues;
  queries: ReadonlyMap<string, EffectiveQuery>;
  tabs: TabSelections;
}
export type AiSummaryRuntimeReader = () => AiSummaryRuntimeContext | undefined;

export interface AiSummaryGenerationInput {
  key: string;
  owner: string;
  question: string;
  contextInfo: AiSummaryContextInfo;
  initialBody?: string;
}

const OUTPUT_INSTRUCTION = `只根据所给查询条件、字段含义与结果分析，不补造事实。注意各数据源结果范围与查询状态。返回完整纯文本或受控 semantic HTML。${semanticHtmlInstructions()}`;

/** 后端可用相同确定性输入生成首屏正文的绑定标识；输入不含请求时间或随机 ID。 */
export function aiSummaryInputKey(question: string, contextInfo: AiSummaryContextInfo): string {
  return canonicalizeJson({ version: 1, question, contextInfo });
}

export function assembleGenerationInput(
  props: AiSummaryProps, componentId: string,
  snapshots: PageDataSnapshots, runtime: AiSummaryRuntimeContext
): AiSummaryGenerationInput | undefined {
  if (hasAiSummaryBody(props)) return;
  const related = aiSummaryRelatedData(runtime.page, props, runtime.tabs);
  if (Object.values(related).some(value => !snapshots.get(value.source) || snapshots.get(value.source)?.status === 'loading')) return;
  const question = `${props.promptTemplate ?? ''}\n\n${OUTPUT_INSTRUCTION}`;
  const contextInfo: AiSummaryContextInfo = {
    pageId: runtime.page.id, pageRevision: runtime.pageRevision ?? '', componentId,
    sectionIds: aiSummarySourceReferences(props) || props.relatedData ? [] : [...(props.relatedSections ?? [])].sort(),
    timeFilters: headerTimeFilters(runtime),
    dataSources: Object.entries(related).sort(([a], [b]) => a.localeCompare(b))
      .map(([id, definition]) => summaryDataSource(id, definition, snapshots, runtime))
  };
  const inputKey = aiSummaryInputKey(question, contextInfo);
  const key = canonicalizeJson({ document: runtime.documentKey, input: inputKey });
  return { key, owner: `${runtime.page.id}/${componentId}`, question, contextInfo,
    ...(props.initial?.inputKey === inputKey ? { initialBody: props.initial.body } : {}) };
}

type RelatedDefinition = NonNullable<AiSummaryProps['relatedData']>[string];
function summaryDataSource(id: string, definition: RelatedDefinition, snapshots: PageDataSnapshots,
  runtime: AiSummaryRuntimeContext): AiSummaryDataSource {
  const source = runtime.page.dataSources[definition.source]!;
  const available = resolveDataSourceFields(source);
  const fields = Object.fromEntries(definition.fields.map(binding => [binding.field,
    { ...available[binding.field], label: binding.term }]));
  const query = runtime.queries.get(definition.source);
  const snapshot = snapshots.get(definition.source)!;
  return { id: definition.source, description: definition.description || id, fields,
    ...(query ? { query } : {}),
    resultScope: source.source.type === 'inline' || (source.source.type === 'query' && source.source.resultScope === 'complete') ? 'complete' : 'window',
    result: selectSnapshot(snapshot, definition.fields.map(binding => binding.field)) };
}

function selectSnapshot(snapshot: DataSnapshot, fields: string[]): DataSnapshot {
  if (snapshot.status !== 'ready') return structuredClone(snapshot);
  return { ...snapshot, rows: snapshot.rows.map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? null]))) };
}

function headerTimeFilters(runtime: AiSummaryRuntimeContext): Record<string, FilterValue> {
  const ids = new Set(runtime.page.sections.flatMap(section => section.components.flatMap(component =>
    component.type === 'reportHeader' ? component.props.filterIds ?? [] : [])));
  return Object.fromEntries([...ids].sort().flatMap(id => {
    const value = runtime.filters.get(id);
    return value && (value.type === 'timePoint' || value.type === 'timeRange') ? [[id, value]] : [];
  }));
}
