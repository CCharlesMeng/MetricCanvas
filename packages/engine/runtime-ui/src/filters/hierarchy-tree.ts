import { canonicalizeJson, type FilterHierarchyLevel } from '@metriccanvas/page/internal';
import type { UiTreeOption } from '@metriccanvas/ui';
import type { DimensionValuesSnapshot, FilterCandidate } from '../../../runtime/src';
import { validFilterCandidates } from '../../../runtime/src/filter-candidates';

/** Explicit pickers remain opt-in; a single hierarchy chooses its level in the tree. */
export function usesHierarchyTree(display: string, mode?: string, picker?: string): boolean {
  return (display === 'tree' || display === 'select') && mode === 'single' && picker === undefined;
}

export function hierarchyNodeKey(level: string, value: string): string {
  return JSON.stringify([level, value]);
}

function invalidTree(): DimensionValuesSnapshot {
  return { status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR', message: '候选层级无效或回执不一致' } };
}

/** Wait for every level; do not turn failed or conflicting receipts into a selectable partial tree. */
export function hierarchyTreeSnapshot(levels: readonly FilterHierarchyLevel[], receipts: Readonly<Record<string, DimensionValuesSnapshot>>, structural = true): DimensionValuesSnapshot {
  if (!structural) receipts = legacyHierarchyReceipts(levels, receipts);
  const batches = levels.map(level => receipts[level.id] ?? { status: 'loading' } as const);
  const pending = batches.find(batch => batch.status !== 'ready' && batch.status !== 'empty');
  if (pending) return pending;
  const candidates = new Map<string, FilterCandidate>();
  for (const batch of batches) {
    if (batch.status !== 'ready') continue;
    for (const candidate of batch.candidates) {
      const key = hierarchyNodeKey(candidate.level!, candidate.value);
      const previous = candidates.get(key);
      if (previous && canonicalizeJson(previous) !== canonicalizeJson(candidate)) return invalidTree();
      candidates.set(key, candidate);
    }
  }
  const nodes = [...candidates.values()];
  if (!validFilterCandidates(nodes, levels.map(level => level.id))) return invalidTree();
  if (levels.some((level, index) => batches[index]!.status === 'empty' && nodes.some(node => node.level === level.id))) return invalidTree();
  return nodes.length ? { status: 'ready', candidates: nodes } : { status: 'empty' };
}

/** Legacy receipts are scoped to a declared level; do not invent cross-level parent relations. */
function legacyHierarchyReceipts(levels: readonly FilterHierarchyLevel[], receipts: Readonly<Record<string, DimensionValuesSnapshot>>): Record<string, DimensionValuesSnapshot> {
  return Object.fromEntries(levels.map(level => {
    const snapshot = receipts[level.id];
    if (snapshot?.status !== 'ready') return [level.id, snapshot ?? { status: 'loading' }];
    return [level.id, { status: 'ready', candidates: snapshot.candidates.map(candidate => ({
      ...candidate, level: level.id,
      ...(candidate.parentValue ? { parent: { level: level.id, value: candidate.parentValue } } : {})
    })) }];
  }));
}

/** UI identities include level; raw business values never change or acquire an encoded prefix. */
export function hierarchyTreeOptions(snapshot: DimensionValuesSnapshot, level: string, values: readonly string[], groupLevels?: readonly FilterHierarchyLevel[]): UiTreeOption[] {
  const candidates = snapshot.status === 'ready' ? snapshot.candidates : [];
  const nodes = new Map<string, UiTreeOption>();
  for (const candidate of candidates) {
    const key = hierarchyNodeKey(candidate.level!, candidate.value);
    nodes.set(key, { value: key, label: candidate.label, disabled: candidate.disabled, children: [] });
  }
  const roots: UiTreeOption[] = [];
  for (const candidate of candidates) {
    const node = nodes.get(hierarchyNodeKey(candidate.level!, candidate.value))!;
    const parent = candidate.parent && nodes.get(hierarchyNodeKey(candidate.parent.level, candidate.parent.value));
    if (parent) parent.children!.push(node);
    else roots.push(node);
  }
  for (const value of values) {
    const key = hierarchyNodeKey(level, value);
    if (!nodes.has(key)) roots.push({ value: key, label: value, disabled: true });
  }
  return groupLevels ? groupedHierarchyOptions(roots, groupLevels) : roots;
}

function groupedHierarchyOptions(roots: UiTreeOption[], levels: readonly FilterHierarchyLevel[]): UiTreeOption[] {
  return levels.map(level => ({
    value: JSON.stringify(['level', level.id, null]), label: level.label ?? level.id, selectable: false,
    children: roots.filter(node => JSON.parse(node.value)[0] === level.id)
  })).filter(group => group.children.length > 0);
}

export function hierarchyTreeSelection(snapshot: DimensionValuesSnapshot, keys: readonly string[], currentLevel: string): { level: string; values: string[] } | undefined {
  if (!keys.length) return { level: currentLevel, values: [] };
  if (keys.length !== 1 || snapshot.status !== 'ready') return;
  const selected = snapshot.candidates.find(candidate => hierarchyNodeKey(candidate.level!, candidate.value) === keys[0]);
  if (!selected?.level || selected.disabled) return;
  return { level: selected.level, values: [selected.value] };
}

export function hierarchyTreeStatus(snapshot: DimensionValuesSnapshot): string | undefined {
  if (snapshot.status === 'ready') return;
  if (snapshot.status === 'error') return `候选项加载失败(${snapshot.error.code})`;
  const labels = { idle: '候选项加载中…', loading: '候选项加载中…', empty: '无候选项', unavailable: '候选项不可用', denied: '无权访问候选项', unconfigured: '候选能力未配置' };
  return labels[snapshot.status];
}
