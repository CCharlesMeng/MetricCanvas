import { describe, expect, it } from 'vitest';
import { navigateErrors } from '../src/navigate';
import type { Page, Widget } from '../src/page';
import type { FilterDeclaration } from '../src/filter';
import type { NavigateInteraction } from '../src/interaction';

/** 构造带一个 navigate 柱状图的源页面(跨文档校验的被检对象) */
function sourcePage(navigate: NavigateInteraction['navigate']): Page {
  return makePage('overview', [
    { id: 'f-time', type: 'timeRange' },
    { id: 'f-region', type: 'dimension', dimension: 'region' }
  ], [
    {
      id: 'w-by-channel',
      type: 'barChart',
      position: { x: 0, y: 0, w: 6, h: 4 },
      query: { metrics: ['gmv'], dimensions: ['channel'] },
      interactions: [{ on: 'click', navigate }]
    }
  ]);
}

function makePage(id: string, filters: FilterDeclaration[], widgets: Widget[] = []): Page {
  return { formatVersion: '1.0', id, title: id, filters, layout: { type: 'grid', columns: 12 }, widgets };
}

/** 目标页:声明了 f-time / f-region / f-channel(channel 为 dimension 型) */
const detail = makePage('sales-detail', [
  { id: 'f-time', type: 'timeRange' },
  { id: 'f-region', type: 'dimension', dimension: 'region' },
  { id: 'f-channel', type: 'dimension', dimension: 'channel' }
]);

const knownIds = new Set(['overview', 'sales-detail', 'broken-page']);
// broken-page 在清单中但文档不可用(未通过自身校验),模拟"存在但无法读筛选器声明"
const pagesById = new Map([['sales-detail', detail]]);

describe('navigateErrors:跨文档校验(由 validate CLI 组合调用)', () => {
  it('目标页存在、carryFilters 与 setFilters 均命中目标页筛选器,无错误', () => {
    const page = sourcePage({
      page: 'sales-detail',
      carryFilters: ['f-time', 'f-region'],
      setFilters: { 'f-channel': '$dimension.channel' }
    });
    expect(navigateErrors(page, knownIds, pagesById)).toEqual([]);
  });

  it('navigate 指向不存在的页面,报 SCHEMA_ERROR 定位到 navigate/page', () => {
    const page = sourcePage({ page: 'no-such-page' });
    const errors = navigateErrors(page, knownIds, pagesById);
    expect(errors).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/interactions/0/navigate/page'
      })
    ]);
    expect(errors[0].message).toContain('no-such-page');
  });

  it('carryFilters 的 id 在目标页没有同名筛选器,报 SCHEMA_ERROR 定位到该项', () => {
    const page = sourcePage({ page: 'sales-detail', carryFilters: ['f-time', 'f-region'] });
    const detailWithoutRegion = makePage('sales-detail', [{ id: 'f-time', type: 'timeRange' }]);
    const errors = navigateErrors(page, knownIds, new Map([['sales-detail', detailWithoutRegion]]));
    expect(errors).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/interactions/0/navigate/carryFilters/1'
      })
    ]);
    expect(errors[0].message).toContain('f-region');
  });

  it('setFilters 的目标筛选器 id 在目标页不存在,报 SCHEMA_ERROR 定位到该键', () => {
    const page = sourcePage({ page: 'sales-detail', setFilters: { 'f-shop': '$dimension.channel' } });
    const errors = navigateErrors(page, knownIds, pagesById);
    expect(errors).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/interactions/0/navigate/setFilters/f-shop'
      })
    ]);
    expect(errors[0].message).toContain('f-shop');
  });

  it('setFilters 的目标筛选器不是 dimension 型(点击值写不进时间筛选器),报 SCHEMA_ERROR', () => {
    const page = sourcePage({ page: 'sales-detail', setFilters: { 'f-time': '$dimension.channel' } });
    expect(navigateErrors(page, knownIds, pagesById)).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/interactions/0/navigate/setFilters/f-time'
      })
    ]);
  });

  it('setFilters 占位维度与目标筛选器约束的维度不一致,报 SCHEMA_ERROR', () => {
    const page = sourcePage({ page: 'sales-detail', setFilters: { 'f-region': '$dimension.channel' } });
    const errors = navigateErrors(page, knownIds, pagesById);
    expect(errors).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/interactions/0/navigate/setFilters/f-region'
      })
    ]);
    expect(errors[0].message).toContain('region');
  });

  it('目标页在清单中但文档不可用(自身校验未过),只做存在性校验、不误报筛选器错误', () => {
    const page = sourcePage({
      page: 'broken-page',
      carryFilters: ['f-time'],
      setFilters: { 'f-anything': '$dimension.channel' }
    });
    expect(navigateErrors(page, knownIds, pagesById)).toEqual([]);
  });

  /** 构造带一个文本组件的源页面(文本带参链接与 navigate 共用跨文档校验) */
  function textPage(links: Array<{ label: string; page: string; carryFilters?: string[] }>): Page {
    return makePage('overview', [
      { id: 'f-time', type: 'timeRange' },
      { id: 'f-region', type: 'dimension', dimension: 'region' }
    ], [
      {
        id: 'w-intro',
        type: 'text',
        position: { x: 0, y: 0, w: 12, h: 1 },
        body: '说明文案',
        links
      }
    ]);
  }

  it('文本链接目标页存在且 carryFilters 命中目标页同名筛选器,无错误', () => {
    const page = textPage([
      { label: '查看明细', page: 'sales-detail', carryFilters: ['f-time', 'f-region'] }
    ]);
    expect(navigateErrors(page, knownIds, pagesById)).toEqual([]);
  });

  it('文本链接指向不存在的页面,报 SCHEMA_ERROR 定位到 links/page', () => {
    const page = textPage([{ label: '查看明细', page: 'no-such-page' }]);
    const errors = navigateErrors(page, knownIds, pagesById);
    expect(errors).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/links/0/page'
      })
    ]);
    expect(errors[0].message).toContain('no-such-page');
  });

  it('文本链接 carryFilters 的 id 在目标页没有同名筛选器,报 SCHEMA_ERROR 定位到该项', () => {
    const page = textPage([
      { label: '查看明细', page: 'sales-detail', carryFilters: ['f-time', 'f-region'] }
    ]);
    const detailWithoutRegion = makePage('sales-detail', [{ id: 'f-time', type: 'timeRange' }]);
    const errors = navigateErrors(page, knownIds, new Map([['sales-detail', detailWithoutRegion]]));
    expect(errors).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/links/0/carryFilters/1'
      })
    ]);
    expect(errors[0].message).toContain('f-region');
  });

  it('文本链接目标页在清单中但文档不可用,只做存在性校验、不误报筛选器错误', () => {
    const page = textPage([
      { label: '查看明细', page: 'broken-page', carryFilters: ['f-anything'] }
    ]);
    expect(navigateErrors(page, knownIds, pagesById)).toEqual([]);
  });

  it('地图组件的 navigate 交互沿用图表类跨文档校验规则', () => {
    const page = makePage('overview', [], [
      {
        id: 'w-map',
        type: 'mapChart',
        position: { x: 0, y: 0, w: 8, h: 5 },
        display: { map: 'china' },
        query: { metrics: ['gmv'], dimensions: ['region'] },
        interactions: [{ on: 'click', navigate: { page: 'no-such-page' } }]
      }
    ]);
    expect(navigateErrors(page, knownIds, pagesById)).toEqual([
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/widgets/0/interactions/0/navigate/page'
      })
    ]);
  });

  it('页内下钻交互(writeFilter)不参与跨文档校验', () => {
    const page = makePage('overview', [{ id: 'f-region', type: 'dimension', dimension: 'region' }], [
      {
        id: 'w-by-region',
        type: 'barChart',
        position: { x: 0, y: 0, w: 6, h: 4 },
        query: { metrics: ['gmv'], dimensions: ['region'] },
        interactions: [{ on: 'click', writeFilter: 'f-region', value: '$dimension.region' }]
      }
    ]);
    expect(navigateErrors(page, knownIds, pagesById)).toEqual([]);
  });
});
