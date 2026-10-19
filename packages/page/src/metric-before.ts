import { walkDocumentComponents } from './component-walk';
import type { TypedError } from './errors';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};

/** 前置文字是分区直接相邻指标卡的排布关系，不改变数据或计算语义。 */
export function metricBeforeErrors(document: unknown): TypedError[] {
  const page = object(document), sections = Array.isArray(page.sections) ? page.sections : [];
  const errors: TypedError[] = [];
  walkDocumentComponents(document, (component, path) => {
    const before = object(object(component.layout).before);
    if (!Object.hasOwn(object(component.layout), 'before')) return;
    const fail = (message: string) => errors.push({ type: 'SCHEMA_ERROR', path: `${path}/layout/before`, message });
    const match = /^\/sections\/(\d+)\/components\/(\d+)$/.exec(path);
    if (component.type !== 'metricCard' || !match) { fail('before 仅支持内容分区顶层指标卡'); return; }
    const section = object(sections[Number(match[1])]);
    const components = Array.isArray(section.components) ? section.components.map(object) : [];
    const index = Number(match[2]);
    if ((page.layout ?? page.layoutForm ?? 'report') !== 'dashboard') fail('before 仅支持 Dashboard');
    if (!['plain', 'card'].includes(String(section.container))) fail('before 要求 plain 或 card 内容分区');
    if (section.columnTracks !== undefined) fail('before 使用默认 12 列，不与 columnTracks 混用');
    if (components.some(item => object(item.layout).layer === 'backdrop')) fail('before 不与 backdrop 混用');
    if (components.some(item => object(item.layout).connectPrevious === true)) fail('before 不与 connectPrevious 混用');
    if (index > 0 && components[index - 1]?.type !== 'metricCard') fail('before 前一项必须是相邻指标卡');
    if (typeof before.text === 'string' && !before.text.trim()) fail('before.text 必须是非空连接文字');
    let span = Number(object(component.layout).span);
    let cursor = index;
    while (cursor > 0 && object(object(components[cursor]).layout).before !== undefined) {
      cursor--;
      span += Number(object(components[cursor].layout).span);
    }
    if (span > 12) fail('连接指标卡的 span 之和不能超过 12');
  });
  return errors;
}

/** 可选文本参数缺席时释放整个连接声明；仅作用于物化副本。 */
export function removeAbsentMetricBefore(document: unknown): void {
  walkDocumentComponents(document, component => {
    const layout = object(component.layout), before = object(layout.before);
    if (component.type === 'metricCard' && layout.before !== undefined &&
        (before.text === undefined || (typeof before.text === 'string' && !before.text.trim()))) delete layout.before;
  });
}
