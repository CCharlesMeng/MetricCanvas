import type {
  FieldBinding,
  FieldDefinition,
  TableColumn,
  TableColumnNode
} from '@metriccanvas/page';

export type TableHeaderCell =
  | {
      kind: 'group';
      key: string;
      title: string;
      colspan: number;
      rowspan: 1;
    }
  | {
      kind: 'field';
      key: string;
      title: string;
      colspan: 1;
      rowspan: number;
      column: TableColumn;
    };

export interface TableColumnLayout {
  leaves: TableColumn[];
  headerRows: TableHeaderCell[][];
}

/**
 * 将递归列树翻译为表体叶子顺序和 HTML 多层表头网格。
 * 空列组不产出表头单元格,避免生成 colspan=0。
 */
export function buildTableColumnLayout(
  columns: TableColumnNode[],
  fields: Record<string, FieldDefinition> = {}
): TableColumnLayout {
  const leaves: TableColumn[] = [];
  collectLeaves(columns, leaves);

  const depth = columns.reduce((max, column) => Math.max(max, renderDepth(column)), 0);
  if (depth === 0) return { leaves, headerRows: [] };

  const headerRows: TableHeaderCell[][] = Array.from({ length: depth }, () => []);
  columns.forEach((column, index) =>
    appendHeaderCell(column, 0, depth, `${index}`, headerRows, fields)
  );

  return { leaves, headerRows };
}

function collectLeaves(nodes: TableColumnNode[], leaves: TableColumn[]): void {
  for (const node of nodes) {
    if (node.kind === 'group') collectLeaves(node.children, leaves);
    else leaves.push(node);
  }
}

function renderDepth(node: TableColumnNode): number {
  if (node.kind !== 'group') return 1;
  const childDepth = node.children.reduce(
    (max, child) => Math.max(max, renderDepth(child)),
    0
  );
  return childDepth === 0 ? 0 : childDepth + 1;
}

function leafCount(node: TableColumnNode): number {
  if (node.kind !== 'group') return 1;
  return node.children.reduce((count, child) => count + leafCount(child), 0);
}

function appendHeaderCell(
  node: TableColumnNode,
  rowIndex: number,
  totalDepth: number,
  path: string,
  rows: TableHeaderCell[][],
  fields: Record<string, FieldDefinition>
): void {
  if (node.kind === 'group') {
    const colspan = leafCount(node);
    if (colspan === 0) return;
    rows[rowIndex].push({
      kind: 'group',
      key: `group:${path}:${node.id}`,
      title: node.title,
      colspan,
      rowspan: 1
    });
    node.children.forEach((child, index) =>
      appendHeaderCell(child, rowIndex + 1, totalDepth, `${path}.${index}`, rows, fields)
    );
    return;
  }

  rows[rowIndex].push({
    kind: 'field',
    key: `field:${path}:${fieldName(node.field)}`,
    title: node.title ?? fields[fieldName(node.field)]?.label ?? fieldName(node.field),
    colspan: 1,
    rowspan: totalDepth - rowIndex,
    column: node
  });
}

function fieldName(binding: FieldBinding): string {
  return typeof binding === 'string' ? binding : binding.field;
}
