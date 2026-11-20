import type { UiTreeOption } from '../../types';

export type TreeSelection = 'independent' | 'descendants' | 'leaf';
export interface SelectionNode extends UiTreeOption { children?: SelectionNode[]; path: string; }

export function selectionNodes(options: readonly UiTreeOption[], ancestors: string[] = []): SelectionNode[] {
  return options.map(option => {
    const path = [...ancestors, option.label].join(' / ');
    return {...option, path, children: option.children ? selectionNodes(option.children, [...ancestors, option.label]) : undefined};
  });
}
export function flattenNodes(nodes: readonly SelectionNode[]): SelectionNode[] {
  return nodes.flatMap(node => [node, ...flattenNodes(node.children ?? [])]);
}
export function matchesNode(node: SelectionNode, keyword: string): boolean {
  const needle = keyword.trim().toLocaleLowerCase();
  return !needle || `${node.path} ${node.value}`.toLocaleLowerCase().includes(needle);
}
export function filterNodes(nodes: readonly SelectionNode[], keyword: string): SelectionNode[] {
  return nodes.flatMap(node => {
    if (matchesNode(node, keyword)) return [node];
    const children = filterNodes(node.children ?? [], keyword);
    return children.length ? [{...node, children}] : [];
  });
}
/** Keep selected exclusions editable independently of the current candidate window. */
export function withSelectedOptions(nodes: readonly SelectionNode[], values: readonly string[], keyword: string): SelectionNode[] {
  const candidates = new Map(nodes.map(node => [node.value, node]));
  const selected = new Set(values);
  const applied = [...selected].flatMap(value => {
    const candidate = candidates.get(value);
    if (candidate) return [{ ...candidate, disabled: false }];
    const fallback = { value, label: value, path: value };
    return matchesNode(fallback, keyword) ? [fallback] : [];
  });
  return [...applied, ...nodes.filter(node => !selected.has(node.value))];
}

export function selectableValues(node: SelectionNode, policy: TreeSelection): string[] {
  const own = !node.disabled && node.selectable !== false && (policy !== 'leaf' || !node.children?.length) ? [node.value] : [];
  return [...own, ...flattenNodes(node.children ?? []).filter(child => !child.disabled && child.selectable !== false && (policy !== 'leaf' || !child.children?.length)).map(child => child.value)];
}
export function selectionState(node: SelectionNode, value: readonly string[], policy: TreeSelection) {
  const targets = policy === 'independent' ? (!node.disabled && node.selectable !== false ? [node.value] : []) : selectableValues(node, policy);
  const count = targets.filter(candidate => value.includes(candidate)).length;
  return {checked: targets.length > 0 && count === targets.length, partial: count > 0 && count < targets.length, targets};
}
export function toggleSelection(value: readonly string[], node: SelectionNode, multiple: boolean, policy: TreeSelection): string[] {
  if (!multiple) return node.disabled || node.selectable === false || policy === 'leaf' && !!node.children?.length ? [...value] : [node.value];
  const state = selectionState(node, value, policy);
  return state.checked ? value.filter(candidate => !state.targets.includes(candidate)) : [...new Set([...value, ...state.targets])];
}
