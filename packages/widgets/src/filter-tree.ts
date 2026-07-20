/**
 * 树选筛选器的建树纯逻辑(与渲染分离,可独立测试):
 * 一期按候选值的 '/' 分隔符约定建层级(见 CONTEXT.md「维度」词条),
 * 完整路径即维度值本身;无分隔符的候选值退化为根层平面复选。
 * 层级元数据由数据服务供给后,只需替换建树输入,组件契约不变。
 */
export interface FilterTreeNode {
  /** 当前层级段文案 */
  label: string;
  /** 完整路径;仅当它本身是候选值时非空 */
  value: string | null;
  path: string;
  children: FilterTreeNode[];
  /** 本节点与后代中出现在候选项里的完整值(父节点复选批量作用于这些值) */
  leaves: string[];
}

export function buildFilterTree(options: string[]): FilterTreeNode[] {
  const roots: FilterTreeNode[] = [];
  const byPath = new Map<string, FilterTreeNode>();
  for (const option of options) {
    const segments = option.split('/');
    let path = '';
    let siblings = roots;
    let node: FilterTreeNode | undefined;
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment;
      node = byPath.get(path);
      if (!node) {
        node = { label: segment, value: null, path, children: [], leaves: [] };
        byPath.set(path, node);
        siblings.push(node);
      }
      node.leaves.push(option);
      siblings = node.children;
    }
    node!.value = option;
  }
  return roots;
}

/** 节点勾选态:全部候选值选中 / 部分选中(半选)/ 全未选 */
export function nodeState(
  node: FilterTreeNode,
  selected: ReadonlySet<string>
): 'all' | 'some' | 'none' {
  const count = node.leaves.filter((leaf) => selected.has(leaf)).length;
  return count === 0 ? 'none' : count === node.leaves.length ? 'all' : 'some';
}

/** 节点复选切换后的新选中值:全选态则整棵摘除,否则补齐本节点全部候选值 */
export function toggleNodeValues(
  node: FilterTreeNode,
  value: readonly string[],
  selected: ReadonlySet<string>
): string[] {
  if (nodeState(node, selected) === 'all') {
    const drop = new Set(node.leaves);
    return value.filter((v) => !drop.has(v));
  }
  return [...new Set([...value, ...node.leaves])];
}
