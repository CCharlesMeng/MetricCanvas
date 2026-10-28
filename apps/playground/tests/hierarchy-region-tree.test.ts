import { expect, it } from 'vitest';
import { createHierarchyGateway } from '../fixtures/hierarchy-gateway';
import { createDqeSimServer, DQE_EXECUTE_PATH } from '../../../tools/dqe-sim/src/server';
import { hierarchyFixture } from '../../../packages/engine/runtime/tests/hierarchy-fixture';
import { createFilterState, type FilterValues } from '../../../packages/engine/runtime/src/filter-state';
import { filterCandidatesRequest } from '../../../packages/engine/runtime/src/filter-candidates';
import { resolveHierarchySelection } from '../../../packages/engine/runtime/src/table/hierarchy-selection';
import { hierarchyTreeOptions, hierarchyTreeSelection, hierarchyTreeSnapshot, usesHierarchyTree } from '../../../packages/engine/runtime-ui/src/filters/hierarchy-tree';

it('the actual Playground page chooses an office inside one tree and resolves its parent over Sim HTTP', async () => {
  const server = createDqeSimServer({ logger: false });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('server address');
    const gateway = createHierarchyGateway(`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`);
    const { page, table, filters } = hierarchyFixture();
    const region = page.filters!.find(filter => filter.id === 'region')!;
    if (region.type !== 'dimension') throw Error('region declaration');
    expect(page.iocHeader!.filterIds).toContain(region.id);
    expect(usesHierarchyTree(region.display!, region.selection?.mode, region.hierarchyPicker)).toBe(true);
    const signal = new AbortController().signal;
    const receipts: Record<string, import('@metriccanvas/engine').DimensionValuesSnapshot> = {};
    for (const level of region.hierarchy!) {
      const result = await gateway.fetchFilterCandidates(filterCandidatesRequest(region, page.filters!, filters, level.id), { signal });
      if (result.kind !== 'values') throw Error(result.kind);
      receipts[level.id] = { status: 'ready', candidates: result.candidates };
    }
    const snapshot = hierarchyTreeSnapshot(region.hierarchy!, receipts);
    expect(snapshot.status).toBe('ready');
    const tree = hierarchyTreeOptions(snapshot, 'region-dept', []);
    const shanghai = tree.find(node => node.label === '华东')!.children!.find(node => node.label === '上海')!;
    const next = hierarchyTreeSelection(snapshot, [shanghai.value], 'region-dept')!;
    expect(next).toEqual({ level: 'office', values: ['O101'] });
    const state = createFilterState(filters, page.filters);
    const changes: FilterValues[] = [];
    const stop = state.subscribe(values => changes.push(values));
    state.write('region', { type: 'dimension', dimension: 'h_office', ...next });
    stop();
    expect(changes).toHaveLength(2);
    expect(state.toURL()).toContain('region=O101');
    expect(state.toURL()).toContain('region.level=office');
    expect(await resolveHierarchySelection(page, table, gateway, { filters: changes[1]!, params: new Map() }, signal)).toMatchObject({ status: 'selected', parentValue: 'R01', childValue: 'O101' });
    expect(tree.map(node => node.label)).toContain('定位无结果（异常验收）');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
