import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parsePage,
  requiredMinorVersion,
  sectionBackdrop,
  type Page
} from '@metriccanvas/page';
import {
  createFilterState,
  drillThroughSearch,
  initialFilterValues,
  orchestrate,
  type PageDataSnapshots
} from '../src';

const document = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../pages/ioc-project-overview.json', import.meta.url)),
    'utf8'
  )
) as Record<string, unknown>;

function loadPage(): Page {
  const parsed = parsePage(document);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

describe('ioc-project-overview 骨架', () => {
  it('声明 5.1，能力下限覆盖 Tab / gauge / 地图层级', () => {
    const page = loadPage();
    expect(page.schemaVersion).toBe('5.1');
    expect(requiredMinorVersion(document)).toBe(1);
    expect(page.sections.flatMap((section) => section.components).map((item) => item.type)).toEqual(
      expect.arrayContaining(['gauge', 'mapChart', 'tabContainer'])
    );
  });

  it('声明看板布局形态，指标卡与 Tab 表叠放在作为 backdrop 的地图之上', () => {
    const page = loadPage();
    expect(page.layoutForm).toBe('dashboard');

    const board = page.sections.find((section) => section.id === 'map-board');
    if (!board) throw new Error('缺少地图分区');
    // 叠放要求分区没有自己的外壳，否则铺满的组件会被壳裁掉。
    expect(board.container).toBe('plain');

    const backdrop = sectionBackdrop(board);
    expect(backdrop?.id).toBe('region-map');
    expect(backdrop?.type).toBe('mapChart');

    const overlaid = board.components
      .filter((component) => component.layout.layer === undefined)
      .map((component) => component.id);
    // 冻结基线 R1-1（2026-08-25 18:0x 修订：6 → 9 个单元格）的枚举与次序。
    // 三档环形 / 四档环形 / 四档奖惩各占一个同级卡位——方案 B 已把设计稿那三张
    // 复合卡压成指标带（EX-2），协议里也没有卡内嵌组件的入口，所以既有类型
    // （pieChart(ring) / keyValuePanel）只能同级成卡位。
    expect(overlaid).toEqual([
      'kpi-opportunity-outline',
      'opportunity-tier-ring',
      'kpi-pipeline-rate',
      'kpi-initiation-management',
      'project-level-ring',
      'kpi-review',
      'review-medals',
      'overview-tabs'
    ]);
  });

  it('管道支撑率是预计算字段，计算阶段没有 joinAggregate', () => {
    const page = loadPage();
    const kpi = page.dataSources['kpi-summary'];
    expect(kpi?.compute).toBeUndefined();
    expect(kpi?.source.type).toBe('inline');
    expect(kpi?.fields['pipeline-support-rate']?.type).toBe('number');
    for (const source of Object.values(page.dataSources)) {
      expect(source.source.type).toBe('inline');
      expect(source.compute ?? []).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ op: 'joinAggregate' })])
      );
    }
  });

  it('编排后 KPI、地图与三张 Tab 表都就绪', () => {
    const page = loadPage();
    let snapshots: PageDataSnapshots = new Map();
    orchestrate(page, {
      async fetchData() {
        throw new Error('概览页骨架全部使用 inline 数据源');
      }
    }).subscribe((next) => {
      snapshots = next;
    });
    for (const sourceId of [
      'kpi-summary',
      'map-regions',
      'overview-by-office',
      'top-initiated',
      'lost-orders'
    ]) {
      expect(snapshots.get(sourceId)?.status, sourceId).toBe('ready');
    }
  });

  it('地图末级 navigate 携带筛选前缀，TOP 表 setParams 带 party-number', () => {
    const page = loadPage();
    const map = page.sections
      .flatMap((section) => section.components)
      .find((component) => component.type === 'mapChart');
    if (!map || map.type !== 'mapChart') throw new Error('缺少地图');
    const mapAction = map.props.actions?.[0];
    if (!mapAction || !('navigate' in mapAction)) throw new Error('缺少地图 navigate');

    const filters = createFilterState(initialFilterValues(page.filters ?? []));
    filters.write('region', {
      type: 'dimension',
      dimension: 'rep-office-code',
      values: ['BJ-01'],
      level: 'office'
    });
    let current = new Map();
    filters.subscribe((next) => {
      current = new Map(next);
    })();
    const listSearch = drillThroughSearch(mapAction.navigate, current, {});
    expect(listSearch).toContain('region=');
    expect(listSearch).toContain('h%3A');
    expect(listSearch).not.toContain('p:');

    const tabs = page.sections
      .flatMap((section) => section.components)
      .find((component) => component.type === 'tabContainer');
    if (!tabs || tabs.type !== 'tabContainer') throw new Error('缺少 Tab 容器');
    const initiated = tabs.props.tabs.find((tab) => tab.id === 'pre-approval-project')?.component;
    if (!initiated || initiated.type !== 'table') throw new Error('缺少 TOP 表');
    const action = initiated.props.actions?.[0];
    if (!action || !('navigate' in action)) throw new Error('缺少 TOP navigate');
    const row = page.dataSources['top-initiated']?.source.type === 'inline'
      ? page.dataSources['top-initiated'].source.rows[0]!
      : {};
    const search = drillThroughSearch(action.navigate, new Map(), row);
    const params = new URLSearchParams(search);
    expect(action.navigate.page).toBe('ioc-project-detail');
    expect(params.get('party-number')).toBe('p:PN10001');
    expect(params.get('opportunity-code')).toBe('p:OPP202604001');
  });
});
