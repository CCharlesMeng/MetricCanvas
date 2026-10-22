import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageFilesById } from '../../../tools/scripts/page-files.mjs';
import { pageEntry } from '../src/lib/page-entry';
import { filterPageDirectory, organizePageDirectory } from '../src/lib/page-directory';
import { headerTopics, headerScene, headerSceneHref, resolveHeaderSelection, headerCapabilityGroups, headerPlannedCapabilities } from '../fixtures/ioc-header-showcase';
import { createIocHeaderPreview } from '../src/lib/ioc-header-preview-inputs';
import { pageExternalInputs } from '../fixtures/preview-inputs';
import type { EffectiveQuery } from '@metriccanvas/page/internal';

describe('IOC 公共页头统一入口', () => {
  it('页头页面按实际文件夹发现，业务页面保留各自路径与预览适配器', () => {
    const entries = [...pageFilesById('pages')].map(([id, file]) => ({ ...pageEntry(JSON.parse(readFileSync(file, 'utf8')), id), filePath: file.slice('pages/'.length) }));
    const groups = organizePageDirectory(entries);
    const matches = filterPageDirectory(groups, '', 'all', 'all', 'all', 'capabilities/ioc-header/scenarios').flatMap(group => group.pages);
    expect(matches).toHaveLength(15);
    expect(matches.every(entry => pageExternalInputs(entry.id) === 'ioc-header')).toBe(true);
    expect(entries.filter(entry => entry.filePath.startsWith('business/dashboard/ioc/'))).toHaveLength(4);
    expect(pageExternalInputs('ioc-header-standard')).toBe('ioc-business');
  });

  it('完整演示与四个专题覆盖全部原场景，并为直接入口补充必要演示参数', () => {
    const scenes = new Set(headerTopics.flatMap(topic => [...topic.scenes]));
    expect([...scenes].map(scene => headerScene(scene)?.id).sort()).toEqual([...pageFilesById('pages')].filter(([, file]) => file.includes('/ioc-header/scenarios/')).map(([id]) => id).sort());
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
