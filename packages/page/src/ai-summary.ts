import { activePageComponents, type TabSelections } from './tab-state';
import { resolveDataSourceFields } from './data-source';
import type { AiSummaryProps, Page } from './page';
import type { TypedError } from './errors';
import { walkPageComponents } from './component-walk';

/** 显式来源优先；section 只推导实际组件数据槽，不递归其他摘要或查询上游。 */
export function aiSummaryRelatedData(page: Page, props: AiSummaryProps, selections: TabSelections = {}) {
  if (props.mode === 'provided') return {};
  if (props.relatedData && Object.keys(props.relatedData).length) return props.relatedData;
  const sections = page.sections.filter(section => props.relatedSections?.includes(section.id));
  const ids = new Set(activePageComponents({ ...page, sections, detailViews: undefined }, selections)
    .flatMap(component => Object.values(component.data ?? {})));
  return Object.fromEntries([...ids].sort().flatMap(id => {
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
    if (props.mode === 'provided') {
      providedErrors(props, path, error);
      return;
    }
    if (props.body !== undefined) error(`${path}/props/body`, '动态生成模式的首屏正文使用 initial 并绑定 inputKey');
    if (!props.promptTemplate?.trim()) error(`${path}/props/promptTemplate`, '动态生成需要非空业务提示词');
    if (!props.relatedData && !props.relatedSections) error(`${path}/props`, '动态生成需要 relatedData 或 relatedSections');
    sectionErrors(page, props.relatedSections, path, error);
  });
  return errors;
}

type ErrorReporter = (path: string, message: string) => void;
function providedErrors(props: AiSummaryProps, path: string, error: ErrorReporter): void {
  if (!props.body?.trim()) error(`${path}/props/body`, '提供正文模式需要非空正文');
  if (props.promptTemplate || props.relatedData || props.relatedSections || props.initial) error(`${path}/props`, '提供正文模式不能同时声明生成输入');
}
function sectionErrors(page: Page, ids: string[] | undefined, path: string, error: ErrorReporter): void {
  if (!ids) return;
  for (const [index, id] of ids.entries()) {
    if (!page.sections.some(section => section.id === id)) error(`${path}/props/relatedSections/${index}`, `未知内容分区:${id}`);
  }
  if (new Set(ids).size !== ids.length) error(`${path}/props/relatedSections`, '内容分区引用不能重复');
}
