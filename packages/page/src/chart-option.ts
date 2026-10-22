import { walkDocumentComponents } from './component-walk';
import type { TypedError } from './errors';
import type { JsonObject } from './query';

export const chartOptionTypes = ['barChart', 'lineChart', 'pieChart'] as const;
export type ExtensibleChartType = typeof chartOptionTypes[number];
export const isExtensibleChart = (type: unknown): type is ExtensibleChartType =>
  chartOptionTypes.some(candidate => candidate === type);

const roots = new Set(['color', 'backgroundColor', 'textStyle', 'grid', 'legend', 'tooltip', 'xAxis', 'yAxis', 'series',
  'animation', 'animationDuration', 'animationDurationUpdate', 'animationEasing', 'animationEasingUpdate', 'animationDelay', 'animationDelayUpdate', 'stateAnimation']);
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'data', 'dataset', 'encode', 'dimensions', 'dataGroupId',
  'coordinateSystem', 'xAxisIndex', 'yAxisIndex', 'gridIndex', 'geoIndex', 'polarIndex', 'calendarIndex', 'datasetIndex',
  'stack', 'stackStrategy', 'stackOrder', 'silent', 'triggerEvent', 'selectedMode', 'realtimeSort', 'sampling',
  'markPoint', 'markLine', 'markArea', 'baseOption', 'options', 'media', 'timeline', 'visualMap', 'geo', 'graphic', 'toolbox',
  'link', 'sublink', 'image', 'extraCssText', 'appendTo', 'appendToBody', 'valueFormatter', 'optionToContent', 'renderItem']);
const pointer = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const issue = (path: string, message: string): TypedError => ({ type: 'CHART_OPTION_ERROR', path, message });

/** Checked before any JSON cloning: host API inputs must obey the same JSON contract as files. */
function jsonErrors(value: unknown, path: string, ancestors = new Set<object>(), depth = 0): TypedError[] {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return [];
  if (typeof value !== 'object' || !value) return [issue(path, 'ECharts 配置只接受 JSON 值，不接受函数、undefined 或非有限数字')];
  if (depth > 64 || ancestors.has(value)) return [issue(path, 'ECharts 配置不能循环引用，嵌套深度不能超过 64 层')];
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    return [issue(path, 'ECharts 配置只接受普通 JSON 对象')];
  if (Object.getOwnPropertySymbols(value).length) return [issue(path, 'ECharts 配置不接受 Symbol 属性')];
  ancestors.add(value);
  const errors: TypedError[] = [];
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === 'length') continue;
    const at = `${path}/${pointer(key)}`;
    if (descriptor.get || descriptor.set) errors.push(issue(at, 'ECharts 配置不接受访问器属性'));
    else errors.push(...jsonErrors(descriptor.value, at, ancestors, depth + 1));
  }
  if (Array.isArray(value) && Object.keys(value).length !== value.length) errors.push(issue(path, 'ECharts 配置不接受稀疏数组或数组附加属性'));
  ancestors.delete(value);
  return errors;
}

/** Shared product policy. ECharts' complete option vocabulary is intentionally not reimplemented. */
export function chartOptionErrorsFor(type: ExtensibleChartType, props: Record<string, unknown>, path: string): TypedError[] {
  const option = props.echartsOption;
  const errors = jsonErrors(option, path);
  if (errors.length) return errors;
  if (!record(option)) return [issue(path, 'echartsOption 必须是 JSON 对象')];
  for (const key of Object.keys(option)) if (!roots.has(key)) errors.push(issue(`${path}/${pointer(key)}`, `不支持的 ECharts 根入口：${key}；只开放呈现扩展`));
  const seriesCount = type === 'pieChart' ? 1 : Array.isArray(props.series) ? props.series.length : 0;
  const mixed = type === 'barChart' && Array.isArray(props.series) && props.series.some(series => record(series) && (series.kind !== undefined || series.axis !== undefined));
  const horizontal = type === 'barChart' && !mixed && props.horizontal === true;
  const valueAxes = props.dualAxis === true && (seriesCount > 1 || mixed) ? 2 : 1;
  collections(option.series, 'series', seriesCount, true);
  collections(option.xAxis, 'xAxis', type === 'pieChart' ? 0 : horizontal ? valueAxes : 1);
  collections(option.yAxis, 'yAxis', type === 'pieChart' ? 0 : horizontal ? 1 : valueAxes);
  for (const key of ['grid', 'legend', 'tooltip', 'textStyle', 'stateAnimation']) {
    if (Object.hasOwn(option, key) && !record(option[key])) errors.push(issue(`${path}/${key}`, `${key} 只接受一个对象，不允许增删组件`));
  }
  if (type === 'pieChart' && Object.hasOwn(option, 'grid')) errors.push(issue(`${path}/grid`, '饼图没有可扩展的 grid'));
  visit(option, path);
  return errors;

  function collections(value: unknown, key: string, count: number, arrayOnly = false): void {
    if (!Object.hasOwn(option as object, key)) return;
    const at = `${path}/${key}`;
    if (count === 0) { errors.push(issue(at, `当前图表没有可扩展的 ${key}`)); return; }
    if ((!Array.isArray(value) && (arrayOnly || !record(value)))) { errors.push(issue(at, `${key} 必须是${arrayOnly ? '' : '对象或'}对象数组`)); return; }
    const entries = Array.isArray(value) ? value : [value];
    if (entries.length > count) errors.push(issue(`${at}/${count}`, `${key} 补丁越界：最多 ${count} 项，不允许新增系列或轴`));
    entries.forEach((entry, index) => {
      const entryPath = Array.isArray(value) ? `${at}/${index}` : at;
      if (!record(entry)) { errors.push(issue(entryPath, '补丁成员必须是对象')); return; }
      for (const protectedKey of key === 'series' ? ['id', 'name', 'type'] : ['id', 'type'])
        if (Object.hasOwn(entry, protectedKey)) errors.push(issue(`${entryPath}/${protectedKey}`, `禁止覆盖引擎管理的 ${key}.${protectedKey}`));
    });
  }
  function visit(value: unknown, at: string): void {
    if (Array.isArray(value)) { value.forEach((child, index) => visit(child, `${at}/${index}`)); return; }
    if (!record(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${at}/${pointer(key)}`;
      if (forbidden.has(key)) errors.push(issue(childPath, `禁止覆盖引擎数据、结构、交互或资源路径：${key}`));
      if (typeof child === 'string' && (/\b(?:url|image-set|expression)\s*\(|(?:javascript|vbscript)\s*:/i.test(child) || key !== 'formatter' && child.includes(';')))
        errors.push(issue(childPath, '只允许单个呈现值，不接受 CSS 声明片段、外部资源或可执行 URL'));
      // ECharts escapes substituted values, but the tooltip template itself is inserted as HTML.
      if (key === 'formatter' && /\/tooltip\/formatter$/.test(childPath) && typeof child === 'string' && /[<>]/.test(child))
        errors.push(issue(childPath, 'tooltip.formatter 仅接受纯文本模板，不接受 HTML 标记；可用 richText 模式和换行'));
      if (key === 'formatter' && (typeof child !== 'string' || !/(?:\/tooltip|\/axisLabel|\/label)\/formatter$/.test(childPath)))
        errors.push(issue(childPath, 'formatter 仅在 tooltip、axisLabel、label 中接受字符串模板'));
      if (key === 'labelLayout' && !record(child)) errors.push(issue(childPath, 'labelLayout 只接受声明式对象'));
      if ((key === 'animationDelay' || key === 'animationDelayUpdate' || key === 'animationDuration' || key === 'animationDurationUpdate') && typeof child !== 'number')
        errors.push(issue(childPath, `${key} 只接受数字，不接受回调`));
      if ((key === 'symbol' || key === 'icon') && typeof child === 'string' && /^(?:image|https?|data|blob|javascript):/i.test(child))
        errors.push(issue(childPath, '不允许外部图形资源'));
      visit(child, childPath);
    }
  }
}

export function chartOptionErrors(document: unknown): TypedError[] {
  const errors: TypedError[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (!record(component.props) || !Object.hasOwn(component.props, 'echartsOption')) return;
    const at = `${path}/props/echartsOption`;
    if (record(document) && typeof document.schemaVersion === 'string' && document.schemaVersion.startsWith('5.')) errors.push(issue(at, 'echartsOption 由 6.32 引入，5.x 只读文档不能声明此能力'));
    if (!isExtensibleChart(component.type)) errors.push(issue(at, 'echartsOption 只支持 barChart、lineChart、pieChart'));
    else errors.push(...chartOptionErrorsFor(component.type, component.props, at));
  });
  return errors;
}

/** Exact component positions only: arbitrary similarly named business keys remain ordinary text scope. */
export function chartOptionScopes(document: unknown): WeakSet<object> {
  const scopes = new WeakSet<object>();
  walkDocumentComponents(document, component => {
    if (!isExtensibleChart(component.type) || !record(component.props)) return;
    const option = component.props.echartsOption;
    if (typeof option === 'object' && option !== null) scopes.add(option);
  });
  return scopes;
}

export function isChartOptionError(error: Pick<TypedError, 'type'>): boolean {
  return error.type === 'CHART_OPTION_ERROR';
}

export type ChartOption = JsonObject;

export function chartOptionPaths(document: unknown): Map<string, string> {
  const paths = new Map<string, string>();
  walkDocumentComponents(document, (component, path) => {
    if (isExtensibleChart(component.type) && typeof component.id === 'string') paths.set(component.id, `${path}/props/echartsOption`);
  });
  return paths;
}

/** Only used to report unrelated errors alongside a rejected payload, never to render an invalid document. */
export function withoutChartOptions(document: unknown): unknown {
  const props = new WeakSet<object>();
  walkDocumentComponents(document, component => { if (record(component.props)) props.add(component.props); });
  const copy = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(copy);
    if (!record(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !(key === 'echartsOption' && props.has(value))).map(([key, child]) => [key, copy(child)]));
  };
  return copy(document);
}
