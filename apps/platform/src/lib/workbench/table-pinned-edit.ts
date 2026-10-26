import { versionPolicy } from '@metriccanvas/page';
import { projectCanvasDraft, type DocumentEditResult } from './document-edit';
import type { PropertyControl } from './property-edit';

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function columnPaths(columns: unknown, prefix: number[] = []): { path: number[]; column: Record<string, unknown> }[] {
  if (!Array.isArray(columns)) return [];
  return columns.flatMap((value, index) => {
    const column = object(value), path = [...prefix, index];
    if (!column) return [];
    return column.kind === 'group' ? columnPaths(column.children, path) : [{ path, column }];
  });
}
/** One atomic edit keeps source selection and all column bindings valid together. */
export function pinnedTableControl(component: Record<string, unknown> | null): PropertyControl {
  const props = object(component?.props), data = object(component?.data), pinned = object(props?.pinnedTop);
  const slot = pinned?.data;
  return { id: 'table-pinned', label: '置顶行数据源与列绑定', kind: 'json', target: { kind: 'table-pinned' },
    value: typeof slot === 'string' ? { slot, source: data?.[slot],
      cells: columnPaths(props?.columns).filter(({column}) => column.pinnedTop).map(({path,column}) => ({path,...object(column.pinnedTop)})) } : undefined };
}
const invalid = (): DocumentEditResult => ({ok:false,message:'置顶行需要 slot、已有 source 和 cells 列字段绑定；未修改页面。'});
function applyCell(cells: unknown[], columns: ReturnType<typeof columnPaths>): boolean {
  for (const value of cells) {
    const cell = object(value);
    if (!cell || !Array.isArray(cell.path)) return false;
    const target = columns.find(column => JSON.stringify(column.path) === JSON.stringify(cell.path));
    if (!target) return false;
    const {path: _path, ...binding} = cell;
    target.column.pinnedTop = binding;
  }
  return true;
}
export function editPinnedTable(document: Record<string, unknown>, component: Record<string, unknown> | null, value: unknown): DocumentEditResult {
  if (component?.type !== 'table') return invalid();
  const props = object(component.props), data = object(component.data);
  if (!props || !data) return invalid();
  const columns = columnPaths(props.columns), previous = object(props.pinnedTop)?.data;
  for (const {column} of columns) delete column.pinnedTop;
  if (typeof previous === 'string' && previous !== 'main') delete data[previous];
  delete props.pinnedTop;
  if (value !== undefined) {
    const setting = pinnedSetting(value);
    if (!setting) return invalid();
    if (setting.slot in data || !(setting.source in (object(document.dataSources) ?? {}))) return invalid();
    if (!applyCell(setting.cells, columns)) return invalid();
    data[setting.slot] = setting.source;
    props.pinnedTop = {data:setting.slot};
  }
  document.schemaVersion = versionPolicy.current;
  return projectCanvasDraft(document);
}

function pinnedSetting(value: unknown): {slot:string;source:string;cells:unknown[]} | undefined {
  const setting = object(value);
  if (!setting || typeof setting.slot !== 'string' || setting.slot === 'main' || typeof setting.source !== 'string' || !Array.isArray(setting.cells)) return;
  return {slot:setting.slot,source:setting.source,cells:setting.cells};
}
