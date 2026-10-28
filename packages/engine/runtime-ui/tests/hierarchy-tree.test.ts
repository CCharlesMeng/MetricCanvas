import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageFilesById } from '../../../../tools/scripts/page-files.mjs';
import type { FilterHierarchyLevel } from '@metriccanvas/page/internal';
import type { DimensionValuesSnapshot } from '../../runtime/src';
import { hierarchyTreeOptions, hierarchyTreeSelection, hierarchyTreeSnapshot, usesHierarchyTree } from '../src/filters/hierarchy-tree';

const levels: FilterHierarchyLevel[] = [
  { id: 'region', dimension: 'region' }, { id: 'office', dimension: 'office' }
];
const ready: DimensionValuesSnapshot = { status: 'ready', candidates: [
  { level: 'region', value: 'same', label: '华东' },
  { level: 'office', value: 'same', label: '上海', parent: { level: 'region', value: 'same' } },
  { level: 'office', value: 'disabled', label: '禁用', disabled: true, parent: { level: 'region', value: 'same' } }
] };

it('all actual IOC Header region defaults use one single tree; map-owned explicit pickers remain opt-in', () => {
  let checked = 0;
  for (const file of pageFilesById('pages').values()) {
    const document = JSON.parse(readFileSync(file, 'utf8'));
    if (!document.iocHeader?.filterIds?.includes('region') && !document.dashboardToolbar) continue;
    const region = document.filters?.find((filter: { id: string }) => filter.id === 'region');
    if (!region?.hierarchy || region.hierarchyPicker !== undefined) continue;
    expect(region.selection?.mode, file).toBe('single');
    expect(usesHierarchyTree(region.display ?? 'select', region.selection?.mode, region.hierarchyPicker), file).toBe(true);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});

it('single structural trees use one dropdown by default; explicit legacy pickers and multiple keep their behavior', () => {
  expect(usesHierarchyTree('tree', 'single', undefined)).toBe(true);
  expect(usesHierarchyTree('select', 'single', undefined)).toBe(true);
  expect(usesHierarchyTree('tree', 'single', 'tabs')).toBe(false);
  expect(usesHierarchyTree('tree', 'single', 'hidden')).toBe(false);
  expect(usesHierarchyTree('tree', 'multiple', undefined)).toBe(false);
  expect(usesHierarchyTree('tabs', 'single', undefined)).toBe(false);
});

it('legacy single hierarchies use declared level groups without fabricating regional ownership or changing raw codes', () => {
  const snapshot = hierarchyTreeSnapshot(levels, {
    region: { status: 'ready', candidates: [{ value: 'same', label: '华东' }] },
    office: { status: 'ready', candidates: [{ value: 'same', label: '上海' }] }
  }, false);
  const options = hierarchyTreeOptions(snapshot, 'region', [], levels);
  expect(options.map(node => node.label)).toEqual(['region', 'office']);
  expect(options[0]!.selectable).toBe(false);
  expect(options[0]!.children![0]!.children).toEqual([]);
  expect(hierarchyTreeSelection(snapshot, [options[1]!.children![0]!.value], 'region')).toEqual({ level: 'office', values: ['same'] });
  expect(hierarchyTreeSelection(snapshot, [options[0]!.value], 'region')).toBeUndefined();
});

it('deduplicates complete per-level receipts and atomically selects level plus raw value, including same codes across levels', () => {
  const snapshot = hierarchyTreeSnapshot(levels, { region: ready, office: ready });
  const options = hierarchyTreeOptions(snapshot, 'region', []);
  expect(options).toHaveLength(1);
  const parent = options[0]!, child = parent.children![0]!;
  expect(parent.label).toBe('华东');
  expect(child.label).toBe('上海');
  expect(parent.value).not.toBe(child.value);
  expect(hierarchyTreeSelection(snapshot, [parent.value], 'office')).toEqual({ level: 'region', values: ['same'] });
  expect(hierarchyTreeSelection(snapshot, [child.value], 'region')).toEqual({ level: 'office', values: ['same'] });
  expect(hierarchyTreeSelection(snapshot, [], 'office')).toEqual({ level: 'office', values: [] });
  expect(hierarchyTreeSelection(snapshot, [options[0]!.children![1]!.value], 'region')).toBeUndefined();
  expect(hierarchyTreeSelection(snapshot, ['stale-key'], 'region')).toBeUndefined();
});

it.each(['loading', 'denied', 'unavailable', 'unconfigured', 'empty'] as const)('does not expose a partial tree when a level is %s', (status) => {
  const snapshot = hierarchyTreeSnapshot(levels, { region: ready, office: { status } });
  if (status === 'empty') expect(snapshot.status).toBe('error');
  else expect(snapshot.status).toBe(status);
  expect(hierarchyTreeSelection(snapshot, ['anything'], 'region')).toBeUndefined();
});

it('rejects conflicting or malformed receipts; keeps raw selected labels during failures', () => {
  const conflict: DimensionValuesSnapshot = { status: 'ready', candidates: [{ level: 'region', value: 'same', label: 'different' }] };
  expect(hierarchyTreeSnapshot(levels, { region: ready, office: conflict }).status).toBe('error');
  const orphan: DimensionValuesSnapshot = { status: 'ready', candidates: [ready.candidates[1]!] };
  expect(hierarchyTreeSnapshot(levels, { region: orphan, office: orphan }).status).toBe('error');
  expect(hierarchyTreeOptions({ status: 'loading' }, 'office', ['raw/code'])[0]).toMatchObject({ label: 'raw/code', disabled: true });
});
