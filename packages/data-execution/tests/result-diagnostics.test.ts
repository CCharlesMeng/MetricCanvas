import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { DataSnapshot, EffectiveQuery, QueryDataSource } from '@metriccanvas/page/internal';
import fixture from '../../../pages/query-numeric-tolerance.json';
import { checkOrdinaryRange, correctedPageIndex } from '../src/source-program/range-policy';
import { computedSnapshots } from '../src/compute/snapshots';
import { createSourceProgram } from '../src/source-program/session';
import { initialFilterValues } from '../src/filter-values';

afterEach(() => vi.restoreAllMocks());

function page() {
  const parsed = parsePage(structuredClone(fixture));
  if (!parsed.ok) throw Error('fixture');
  return parsed.page;
}

describe('结果总数不一致仅告警', () => {
  it.each([0, 2])('完整结果保留返回行与上游总数 %s，计算阶段不再次拒绝', totalCount => {
    const source = page().dataSources.samples as QueryDataSource;
    if (source.source.type !== 'query') throw Error('fixture');
    source.source.resultScope = 'complete';
    const snapshot: DataSnapshot = { status: 'ready', rows: [{ sample: 'A', value: 1 }], totalCount };
    expect(checkOrdinaryRange(source, snapshot)).toBe(snapshot);
    expect(computedSnapshots(new Map([['samples', { ...source, compute: [] }]]), new Map([['samples', snapshot]])).get('samples'))
      .toEqual(snapshot);
  });

  it('非法总数和超过请求上限仍保留错误分类', () => {
    const source = page().dataSources.samples;
    expect(checkOrdinaryRange(source, { status: 'ready', rows: [], totalCount: -1 }).status).toBe('error');
    expect(checkOrdinaryRange(source, { status: 'ready', rows: [{}], totalCount: 1 }, 0).status).toBe('error');
  });

  it('分页返回了数据时不因错误总数丢弃当前窗口', () => {
    const query = { pagination: { offset: 20, limit: 10 } } as EffectiveQuery;
    expect(correctedPageIndex(query, { status: 'ready', rows: [{ sample: 'A' }], totalCount: 0 })).toBeUndefined();
    expect(correctedPageIndex(query, { status: 'empty', totalCount: 15 })).toBe(1);
  });

  it('真实执行路径打印可定位告警，保留全部数据并回填 initial', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loaded = page();
    const source = loaded.dataSources.samples as QueryDataSource;
    source.source.resultScope = 'complete';
    delete source.source.initial;
    const rows = [{ sample: 'A', value: 1, target: 100, amount: 1, details: [] }];
    const program = createSourceProgram(loaded, { gateway: { async fetchData() { return { rows, totalCount: 0 }; } } });
    const updates = [];
    try {
      for await (const update of program.read({ roots: ['samples'], conditions: initialFilterValues(loaded.filters ?? []) })) updates.push(update);
    } finally { program.dispose(); }
    expect(updates.at(-1)?.snapshot).toMatchObject({ status: 'ready', totalCount: 0, rows: [{ sample: 'A' }] });
    expect(updates[0].initial).toMatchObject({ totalCount: 0, rows: expect.any(Array) });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('TOTAL_COUNT_MISMATCH'), expect.objectContaining({
      pageId: loaded.id, dataSourceIds: ['samples'], rowCount: 1, totalCount: 0
    }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('"sample":"A"');
  });

  it('源级错误打印定位信息，内部仍保留错误态', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = page();
    const program = createSourceProgram(loaded, { gateway: { async fetchData() {
      throw Object.assign(new Error('响应缺少映射字段:容错数值'), { code: 'DQE_FIELD_MAPPING_ERROR' });
    } } });
    const updates = [];
    try {
      for await (const update of program.read({ roots: ['samples'], conditions: new Map() })) updates.push(update);
    } finally { program.dispose(); }
    expect(updates.at(-1)?.snapshot.status).toBe('error');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('DQE_FIELD_MAPPING_ERROR'), expect.objectContaining({
      pageId: loaded.id, dataSourceId: 'samples', message: '响应缺少映射字段:容错数值', components: expect.any(Array)
    }));
  });

  it('总数小于分页窗口时仍只请求一次，不写入不合法的第一页 initial', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loaded = page(), source = loaded.dataSources.samples as QueryDataSource;
    delete source.source.initial;
    delete source.source.resultScope;
    source.source.query.body!.dsl_list[0].order = { offset: 0, limit: 10 };
    loaded.sections = loaded.sections.map(section => ({ ...section, components: section.components.filter(component => component.type === 'table') }));
    const table = loaded.sections[0].components[0];
    if (table.type !== 'table') throw Error('fixture');
    table.props.pagination = { mode: 'query' };
    const fetchData = vi.fn(async () => ({ rows: [{ sample: 'A', value: 1, target: 100, amount: 1, details: [] }], totalCount: 0 }));
    const program = createSourceProgram(loaded, { gateway: { fetchData } });
    const updates = [];
    try {
      for await (const update of program.read({ roots: ['samples'], conditions: new Map() })) updates.push(update);
    } finally { program.dispose(); }
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(updates.at(-1)?.snapshot).toMatchObject({ status: 'ready', rows: [{ sample: 'A' }], totalCount: 0 });
    expect(updates.every(update => update.initial === undefined && update.viewCorrection === undefined)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('正常分页窗口小于业务总数不误报告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = page().dataSources.samples as QueryDataSource;
    delete source.source.resultScope;
    const snapshot: DataSnapshot = { status: 'ready', rows: [{}], totalCount: 100 };
    expect(checkOrdinaryRange(source, snapshot, 10, { dataSourceIds: ['samples'], pagination: { offset: 10, limit: 10 } })).toBe(snapshot);
    expect(warn).not.toHaveBeenCalled();
    checkOrdinaryRange(source, { ...snapshot, totalCount: 10 }, 10, { dataSourceIds: ['samples'], pagination: { offset: 10, limit: 10 } });
    expect(warn).toHaveBeenCalledOnce();
  });
});
