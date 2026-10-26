import type { FieldBinding } from '../field';
import type { TableColumn, TableColumnNode } from '../page';
import { walkDocumentComponents } from '../component-walk';
type ColumnShape = {
    kind?: unknown;
    children?: unknown;
    visibleWhen?: unknown;
};
/** Only protocol column positions are visited; never query bodies or source rows. */
export function visitTableColumns<T extends ColumnShape>(nodes: readonly T[], path: string, visit: (node: T, path: string) => void): void {
    nodes.forEach((node, index) => {
        if(!node || typeof node!=='object')return;
        const own = `${path}/${index}`;
        visit(node, own);
        if (node.kind === 'group' && Array.isArray(node.children))
            visitTableColumns(node.children, `${own}/children`, visit);
    });
}
export function hasColumnConditions(nodes: readonly TableColumnNode[]): boolean {
    return nodes.some(node => node.visibleWhen !== undefined || (node.kind === 'group' && hasColumnConditions(node.children)));
}
export function tableColumnLeaves(nodes: readonly TableColumnNode[]): TableColumn[] {
    return nodes.flatMap(node => node.kind === 'group' ? tableColumnLeaves(node.children) : [node]);
}
/** Search is defined on main, even when another data slot uses the same field name. */
export function mainColumnField(binding: FieldBinding | undefined): string | undefined {
    if (typeof binding === 'string')
        return binding;
    return binding && 'field' in binding && binding.data === 'main' ? binding.field : undefined;
}
export function columnMainFields(nodes: readonly TableColumnNode[], compound = false): Set<string> {
    const fields = tableColumnLeaves(nodes).flatMap(column => compound ? [column.field, column.secondaryField, column.badgeField] : [column.field]);
    return new Set(fields.map(mainColumnField).filter((field): field is string => field !== undefined));
}
function record(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
/** Raw-document capability scanner also includes expanded-row templates. */
export function columnConditionPaths(document: unknown): string[] {
    const paths: string[] = [];
    const collect = (value: unknown, path: string) => {
        if (!Array.isArray(value))
            return;
        visitTableColumns(value, path, (column, own) => {
            if (Object.hasOwn(column, 'visibleWhen'))
                paths.push(`${own}/visibleWhen`);
        });
    };
    walkDocumentComponents(document, (node, path) => {
        if (node.type !== 'table')
            return;
        const props = record(node.props);
        collect(props?.columns, `${path}/props/columns`);
        collect(record(record(props?.rowExpansion)?.table)?.columns, `${path}/props/rowExpansion/table/columns`);
    });
    return paths;
}

/** Field identity used by existing header state; search is separately main-scoped. */
export function columnPrimaryFields(nodes:readonly TableColumnNode[]):Set<string>{
 return new Set(tableColumnLeaves(nodes).flatMap(column=>{
  const field=column.field;
  if(typeof field==='string')return [field];
  return 'field' in field?[field.field]:[];
 }));
}
export function columnBindingKey(binding:FieldBinding):string{
 if(typeof binding==='string')return JSON.stringify(['main',binding]);
 return 'field' in binding?JSON.stringify([binding.data,binding.field]):JSON.stringify(binding);
}
