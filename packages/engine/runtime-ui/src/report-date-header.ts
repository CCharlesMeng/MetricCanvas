import type { FilterDeclaration, ReportHeaderProps } from '@metriccanvas/page/internal';
import type { FilterValues } from '../../runtime/src';

export function headerDateDeclarations(props: ReportHeaderProps, declarations: readonly FilterDeclaration[]): FilterDeclaration[] {
  return (props.filterIds ?? []).flatMap(id => declarations.find(f => f.id === id) ?? []);
}
export function headerPeriod(props: ReportHeaderProps, declarations: readonly FilterDeclaration[], values: FilterValues): string | undefined {
  if (!props.filterIds?.length) return undefined;
  const dates=headerDateDeclarations(props, declarations);
  return dates.map(filter => {
    const value = values.get(filter.id);
    const period = value?.type === 'timePoint' ? value.value : value?.type === 'timeRange' ?
      value.from === value.to ? value.from : `${value.from} 至 ${value.to}` : '全部期间';
    return dates.length===1 ? period : `${filter.label ?? '期间'}：${period}`;
  }).join('；');
}
export function contentFilterDeclarations(page: { sections: Array<{components: import('@metriccanvas/page/internal').Component[]}> }, declarations: FilterDeclaration[]): FilterDeclaration[] {
  const headerIds = new Set(page.sections.flatMap(s => s.components.flatMap(c => c.type === 'reportHeader' ? c.props.filterIds ?? [] : [])));
  return declarations.filter(f => !headerIds.has(f.id));
}
