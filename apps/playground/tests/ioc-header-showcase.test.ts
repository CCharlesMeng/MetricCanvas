import { describe, expect, it } from 'vitest';
import catalog from '../page-catalog.json';
import { headerTopics, headerScene, headerSceneHref, resolveHeaderSelection, headerCapabilityGroups, headerPlannedCapabilities } from '../src/lib/ioc-header-showcase';
import { createIocHeaderPreview } from '../src/lib/ioc-header-preview-inputs';
import { filterPageCatalog, organizePageCatalog, pageExternalInputs } from '../src/lib/page-catalog';
import type { EffectiveQuery } from '@metriccanvas/page/internal';

describe('IOC 公共页头统一入口', () => {
  it('能力与功能演示可组合筛选，且原有业务示例不进入页头集合', () => {
    const groups = organizePageCatalog(catalog.pages.map(entry => ({ id: entry.id, title: entry.displayTitle, layoutForm: 'dashboard' })));
    const matches = filterPageCatalog(groups, '', 'features', 'all', 'ioc-header', 'none');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('ioc-header');
    expect(matches[0]?.pages).toHaveLength(15);
    expect(matches[0]?.collection?.href).toBe('/ioc-header');
    expect(filterPageCatalog(groups, 'ISO周', 'features', 'all', 'ioc-header').flatMap(group => group.pages).map(entry => entry.scenario)).toEqual(['time-modes']);
    expect(groups.find(group => group.id === 'ioc')?.pages).toHaveLength(4);
  });

  it('完整演示与四个专题覆盖全部原场景，并为直接入口补充必要演示参数', () => {
    const scenes = new Set(headerTopics.flatMap(topic => [...topic.scenes]));
    expect([...scenes].map(scene => headerScene(scene)?.id).sort()).toEqual(catalog.pages.filter(entry => entry.group === 'ioc-header').map(entry => entry.id).sort());
    expect(headerTopics).toHaveLength(5);
    for (const scene of scenes) expect(pageExternalInputs(headerScene(scene)?.id)).toBe('ioc-header');
    expect(headerSceneHref('navigation-detail')).toContain('project-id=P-001');
    expect(resolveHeaderSelection('unknown', '<invalid>')).toMatchObject({ scene: 'navigation-source', topic: { id: 'overview' } });
    expect(resolveHeaderSelection('currency', 'time-modes')).toMatchObject({ scene: 'time-modes', topic: { id: 'time' } });
  });

  it('能力索引追溯全部88项且无重复，将挂起与不支持项放在独立列表', () => {
    const all = [...headerCapabilityGroups.flatMap(group => group.items), ...headerPlannedCapabilities];
    const refs = all.flatMap(item => item.refs);
    const expected = Object.entries({ H: 14, F: 24, M: 6, T: 12, L: 12, N: 8, O: 12 }).flatMap(([prefix, count]) => Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`));
    expect(refs.sort()).toEqual(expected.sort());
    expect(new Set(refs).size).toBe(88);
    expect(headerCapabilityGroups.flatMap(group => group.items).every(item => ['supported', 'integration'].includes(item.status))).toBe(true);
    expect(headerPlannedCapabilities.every(item => ['deferred', 'unsupported'].includes(item.status))).toBe(true);
    for (const item of all) expect(headerScene(item.scene), item.title).toBeDefined();
  });
});

describe('仅供页头示例使用的合成输入', () => {
  it('生效查询使用产品适配器映射，未知查询明确拒绝', async () => {
    const { dataGateway } = createIocHeaderPreview();
    const query: EffectiveQuery = { language: 'dqe', body: { dsl_list: [{ output_dims: ['ioc_header_scope'], output_metrics: ['ioc_header_count'], filter: { dims: [], metrics: [] }, order: {} }] }, fieldMappings: { scope: { queryField: 'ioc_header_scope', type: 'string', role: 'dimension' } }, filterValues: [{ target: 'dimension', queryField: 'month_code', values: ['2026-01', '2026-03'] }] };
    const result = await dataGateway.fetchData(query);
    expect(result.rows[0]?.scope).toContain('month_code=2026-01,2026-03');
    await expect(dataGateway.fetchData({ ...query, body: { dsl_list: [{ output_dims: ['unknown'], output_metrics: [] }] } })).rejects.toThrow();
  });

  it('候选严格按层级、时间与依赖处理，取消及未知维度不回退全量', async () => {
    const { dataGateway } = createIocHeaderPreview();
    const narrowed = await dataGateway.fetchDimensionValues('region-dept-code', { constraints: { 'geo-pc-code': ['R99'] } });
    expect(narrowed.kind).toBe('values');
    if (narrowed.kind === 'values') {
      expect(narrowed.candidates.map(item => item.value)).toContain('CN-BJ');
      expect(narrowed.candidates.every(item => item.value.startsWith('CN-'))).toBe(true);
    }
    expect(await dataGateway.fetchDimensionValues('unknown')).toEqual({ kind: 'unavailable' });
    const request = { filterId: 'model', dimension: 'b2_model', constraints: { dimensions: {}, times: { period: { from: '2026-06', to: '2026-06' } } } };
    expect(await dataGateway.fetchFilterCandidates(request, { signal: new AbortController().signal })).toEqual({ kind: 'denied' });
    const office = await dataGateway.fetchFilterCandidates({ ...request, filterId: 'region', dimension: 'b2_office', level: 'office' }, { signal: new AbortController().signal });
    expect(office.kind).toBe('values');
    if (office.kind === 'values') expect(office.candidates).toContainEqual({ level: 'office', value: 'same', label: '北京代表处', parent: { level: 'department', value: 'same' } });
    const controller = new AbortController(); controller.abort();
    await expect(dataGateway.fetchFilterCandidates(request, { signal: controller.signal })).rejects.toThrow();
  });

  it('期间事实是每实例合成输入，不接受跨实例修改', () => {
    const first = createIocHeaderPreview(), second = createIocHeaderPreview();
    const snapshot = first.displayInputs.getSnapshot();
    snapshot.permissionRevision = 'changed';
    expect(second.displayInputs.getSnapshot().permissionRevision).toBe('playground-ioc-synthetic');
    expect(first.displayInputs.getSnapshot().periods?.sales).toMatchObject({ latest: '2026-10', latestComplete: '2026-09' });
  });
});
