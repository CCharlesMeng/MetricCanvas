type Props = Record<string, unknown>;
type Result = {ok: true; props: Props} | {ok: false; message: string};
const object = (value: unknown): Props | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Props : undefined;
const presentation = ['format', 'unit', 'currency', 'missingText'];
const seriesType = (type: string) => type === 'barChart' || type === 'lineChart';

/** Preserve literal origins across compatible shapes; reject conversions that would discard them. */
export function retainChartConstants(previous: Props, type: string, next: Props): Result {
  const sources = mainSources(previous);
  if (!sources?.some(source => Object.hasOwn(source, 'value'))) return {ok: true, props: next};
  if (seriesType(type)) {
    if (!compatibleLineAxes(previous, type)) return {ok: false, message: '目标折线图不能保留当前主次轴分配，未修改图表'};
    next.series = sources.map(source => copyKeys(source, ['field', 'value', 'label', ...presentation]));
    const category = previous.xField ?? previous.categoryField ?? previous.nameField;
    if (category !== undefined) next[type === 'lineChart' ? 'xField' : 'categoryField'] = category;
    if (previous.dualAxis !== undefined) next.dualAxis = previous.dualAxis;
  } else if (['pieChart', 'mapChart', 'gauge'].includes(type)) {
    if (sources.length !== 1) return {ok: false, message: '目标图表只有一个数值入口，不能直接保留多个含常量的系列，未修改图表'};
    for (const key of ['valueField', ...presentation]) delete next[key];
    Object.assign(next, copyKeys(sources[0], ['value', ...presentation]));
  } else return {ok: false, message: '目标组件不能保留当前常量取值，未修改图表'};
  if (previous.emptyBehavior !== undefined) next.emptyBehavior = previous.emptyBehavior;
  return {ok: true, props: next};
}

function mainSources(props: Props): Props[] | undefined {
  if (Array.isArray(props.series)) return props.series.map(object).filter((value): value is Props => value !== undefined);
  if (Object.hasOwn(props, 'value')) return [props];
  return undefined;
}

function compatibleLineAxes(props: Props, type: string): boolean {
  if (type !== 'lineChart' || props.dualAxis !== true || !Array.isArray(props.series)) return true;
  return props.series.every((source, index) => {
    const axis = object(source)?.axis;
    return axis === undefined || axis === (index === 0 ? 'primary' : 'secondary');
  });
}

function copyKeys(source: Props, keys: string[]): Props {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
}
