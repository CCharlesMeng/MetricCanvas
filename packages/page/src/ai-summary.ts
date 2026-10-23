import { activePageComponents, type TabSelections } from './tab-state';
import { resolveDataSourceFields } from './data-source';
import type { AiSummaryProps, Page } from './page';
import type { TypedError } from './errors';
import { walkPageComponents } from './component-walk';
import { aiSummaryRegion } from './ai-summary-region';
export { aiSummaryRegion } from './ai-summary-region';

/** 非空正文直接展示；空字符串或纯空白继续走生成流程。 */
export function hasAiSummaryBody(props: AiSummaryProps): boolean {
  return Boolean(props.body?.trim());
}

/** 兼容拼写在此归一化；保留原键以报告准确的文档路径。 */
export function aiSummarySourceReferences(props: AiSummaryProps) {
  if (props.relatedDataSources) return { key: 'relatedDataSources' as const, ids: props.relatedDataSources };
  if (props.relatedDataSource) return { key: 'relatedDataSource' as const, ids: props.relatedDataSource };
}

/** 显式来源优先；section 只推导实际组件数据槽，不递归其他摘要或查询上游。 */
export function aiSummaryRelatedData(page: Page, props: AiSummaryProps, selections: TabSelections = {}, componentId = '') {
  if (hasAiSummaryBody(props)) return {};
  const sources = aiSummarySourceReferences(props);
  if (sources) return relatedSources(page, sources.ids);
  if (props.relatedData && Object.keys(props.relatedData).length) return props.relatedData;
  const sections = props.scope === 'container'
    ? regionSections(page, componentId)
    : page.sections.filter(section => props.relatedSections?.includes(section.id));
  const ids = new Set(activePageComponents({ ...page, sections, detailViews: undefined }, selections)
    .flatMap(component => Object.values(component.data ?? {})));
  return relatedSources(page, [...ids]);
}

function regionSections(page: Page, componentId: string): Page['sections'] {
  const region = aiSummaryRegion(page, componentId);
  return region ? [{ id: region.sectionId, components: [...region.components] }] : [];
}

function relatedSources(page: Page, ids: string[]) {
  return Object.fromEntries([...new Set(ids)].sort().flatMap(id => {
    const source = page.dataSources[id];
    if (!source) return [];
    const fields = Object.entries(resolveDataSourceFields(source))
      .filter(([, field]) => field.role !== 'detail')
      .map(([field, definition]) => ({ field, term: definition.label ?? field }));
    return [[id, { source: id, description: id, fields }]];
  }));
}

export function aiSummaryErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const error = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR' as const, path, message });
  walkPageComponents(page, (component, path) => {
    if (component.type !== 'aiSummary') return;
    const props = component.props;
    if (page.layout === 'dashboard') error(path, 'AI 总结仅支持 Report 布局');
    if (hasAiSummaryBody(props)) return;
    if (!props.promptTemplate?.trim()) error(`${path}/props/promptTemplate`, '动态生成需要非空业务提示词');
    if (!aiSummarySourceReferences(props) && !props.relatedData && !props.relatedSections && !props.scope) error(`${path}/props`, '动态生成需要 relatedDataSources 或 relatedSections 或 scope（旧声明仍可读取）');
    containerScopeErrors(page, component.id, props, path, error);
    sourceErrors(page, props, path, error);
    sectionErrors(page, props.relatedSections, path, error);
  });
  return errors;
}

function containerScopeErrors(page: Page, id: string, props: AiSummaryProps, path: string, error: ErrorReporter): void {
  if (!props.scope) return;
  if (aiSummarySourceReferences(props) || props.relatedData || props.relatedSections) error(`${path}/props/scope`, '所在区域 scope 不能与其他分析范围同时声明');
  if (!aiSummaryRegion(page, id)) error(`${path}/props/scope`, '所在区域 scope 需要内容分区、组合卡或 Tab 页签直接拥有当前 AI 总结');
}

type ErrorReporter = (path: string, message: string) => void;
function sourceErrors(page: Page, props: AiSummaryProps, path: string, error: ErrorReporter): void {
  const sources = aiSummarySourceReferences(props);
  if (!sources) return;
  const { key, ids } = sources;
  if (props.relatedDataSources && props.relatedDataSource) error(`${path}/props`, 'relatedDataSources 不能与旧 relatedDataSource 同时声明');
  if (props.relatedData) error(`${path}/props`, `${key} 不能与旧 relatedData 同时声明`);
  for (const [index, id] of ids.entries()) {
    if (!Object.hasOwn(page.dataSources, id)) error(`${path}/props/${key}/${index}`, `关联数据引用了未知数据源:${id}`);
  }
  if (new Set(ids).size !== ids.length) error(`${path}/props/${key}`, '数据源引用不能重复');
}
function sectionErrors(page: Page, ids: string[] | undefined, path: string, error: ErrorReporter): void {
  if (!ids) return;
  for (const [index, id] of ids.entries()) {
    if (!page.sections.some(section => section.id === id)) error(`${path}/props/relatedSections/${index}`, `未知内容分区:${id}`);
  }
  if (new Set(ids).size !== ids.length) error(`${path}/props/relatedSections`, '内容分区引用不能重复');
}
