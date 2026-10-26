import { visitTableColumns } from './columns';
export type ColumnTarget = {
    kind: 'tableColumn';
    id: string;
    indices: number[];
    expanded?: boolean;
};
type Node = Record<string, any>;
/** Declaration indices are never indices in a visibility projection. */
export function columnEditTarget(props: Node, target: ColumnTarget): Node | undefined {
    let nodes = target.expanded ? props.rowExpansion?.table?.columns : props.columns;
    if (!target.indices.length)
        return;
    let column: Node | undefined;
    for (const index of target.indices) {
        if (!Number.isInteger(index) || index < 0 || !Array.isArray(nodes))
            return;
        column = nodes[index];
        nodes = column?.children;
    }
    return column;
}
export function columnEditTargets(id: string, props: Node): Array<{
    target: ColumnTarget;
    label: string;
    enabled: boolean;
}> {
    const targets: Array<{
        target: ColumnTarget;
        label: string;
        enabled: boolean;
    }> = [];
    function collect(nodes: Node[], expanded = false) {
        visitTableColumns(nodes, '', (node, path) => {
            const indices = path.split('/').filter(part => part && part !== 'children').map(Number);
            targets.push({ target: { kind: 'tableColumn', id, indices, ...(expanded ? { expanded } : {}) }, label: `${id} · ${expanded ? '子表' : '表格'}列 ${indices.map(index => index + 1).join('.')} · ${node.title ?? node.id ?? ''}`, enabled: false });
        });
    }
    collect(props.columns ?? []);
    if (props.rowExpansion)
        collect(props.rowExpansion.table.columns, true);
    return targets;
}
