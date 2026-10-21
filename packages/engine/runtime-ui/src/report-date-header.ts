import type { FilterDeclaration, ReportHeaderProps } from '@metriccanvas/page/internal';
import type { FilterValues } from '../../runtime/src';
import { filterGroupOptions, formatPeriod } from '@metriccanvas/page/internal';

export function headerDateDeclarations(props: ReportHeaderProps, declarations: readonly FilterDeclaration[]): FilterDeclaration[] {
  return (props.filterIds ?? []).flatMap(id => declarations.find(f => f.id === id) ?? []);
}
/** 6.13/6.14 的只读兼容；6.15 文本只由显式引用决定。 */
export function headerPeriod(props: ReportHeaderProps, declarations: readonly FilterDeclaration[], values: FilterValues, schemaVersion: string): string | undefined {
  if (Number(schemaVersion.split('.')[1]) >= 15) return undefined;
  if (!props.filterIds?.length) return undefined;
  const dates=headerDateDeclarations(props, declarations);
  return dates.map(filter => {
    const value = values.get(filter.id);
    const period = value?.type === 'timePoint' ? value.value : value?.type === 'timeRange' ?
      formatPeriod({ start: value.from, end: value.to }) : '全部期间';
    return dates.length===1 ? period : `${filter.label ?? '期间'}：${period}`;
  }).join('；');
}
export function contentFilterDeclarations(page: { sections: Array<{components: import('@metriccanvas/page/internal').Component[]}> }, declarations: FilterDeclaration[]): FilterDeclaration[] {
  const headerIds = new Set(page.sections.flatMap(s => s.components.flatMap(c => c.type === 'reportHeader' ? c.props.filterIds ?? [] : [])));
  const chartIds = filterGroupOptions(page);
  return declarations.filter(f => !headerIds.has(f.id) && !chartIds.has(f.id));
}
