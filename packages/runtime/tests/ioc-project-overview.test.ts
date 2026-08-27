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
  it('声明 5.2，能力下限覆盖组合卡、分类明细、地图图例与 ratio.scale', () => {
    const page = loadPage();
    expect(page.schemaVersion).toBe('5.2');
    expect(requiredMinorVersion(document)).toBe(2);
  });

  it('声明看板布局形态，三张组合卡与 Tab 叠放在作为 backdrop 的地图之上', () => {
    const page = loadPage();
    expect(page.layoutForm).toBe('dashboard');
    expect(page.meta?.title).toBe('全球/区域作战地图');
    expect(page.sections.flatMap((section) => section.components))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'reportHeader' })]));

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
    expect(overlaid).toEqual([
      'kpi-opportunity-outline',
      'kpi-initiation-management',
      'kpi-review',
      'overview-tabs'
    ]);

    const composites = board.components.filter(
      (component) => component.type === 'compositeCard'
    );
    expect(composites.map((component) => [component.id, component.layout.span])).toEqual([
      ['kpi-opportunity-outline', 4],
      ['kpi-initiation-management', 4],
      ['kpi-review', 3]
    ]);
    expect(composites.map((component) => component.props.components.map((child) => child.type)))
      .toEqual([
        ['metricCard', 'pieChart', 'categoryBreakdown', 'gauge'],
        ['metricCard', 'pieChart', 'categoryBreakdown', 'metricCard'],
        ['metricCard', 'keyValuePanel']
      ]);
    expect(composites.map((component) => component.props.components.map((child) => child.props.variant)))
      .toEqual([
        ['compactStrip', 'compactRing', 'compactList', 'mini'],
        ['compactStack', 'compactRing', 'compactList', 'compactStrip'],
        ['compactStrip', 'counterStrip']
      ]);
  });

  it('四个比率由 ratio.scale 计算，管道支撑率仍是预计算字段', () => {
    const page = loadPage();
    const kpi = page.dataSources['kpi-summary'];
    expect(kpi?.compute).toEqual([
      expect.objectContaining({
        op: 'ratio', output: 'project-initiation-rate', scale: 100,
        onZeroDenominator: 'null'
      }),
      expect.objectContaining({
        op: 'ratio', output: 'analysis-meeting-rate', scale: 100,
        onZeroDenominator: 'null'
      }),
      expect.objectContaining({
        op: 'ratio', output: 'win-rate', scale: 100,
        onZeroDenominator: 'null'
      }),
      expect.objectContaining({
        op: 'ratio', output: 'review-rate', scale: 100,
        onZeroDenominator: 'null'
      })
    ]);
    expect(kpi?.source.type).toBe('inline');
    expect(kpi?.fields['pipeline-support-rate']?.type).toBe('number');
    for (const source of Object.values(page.dataSources)) {
      expect(source.source.type).toBe('inline');
      expect(source.compute ?? []).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ op: 'joinAggregate' })])
      );
    }
  });

  it('编排后嵌套叶子的数据源都就绪且比率按百分数刻度产出', () => {
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
      'lost-orders',
      'opportunity-tiers',
      'project-levels'
    ]) {
      expect(snapshots.get(sourceId)?.status, sourceId).toBe('ready');
    }
    const kpi = snapshots.get('kpi-summary');
    if (kpi?.status !== 'ready') throw new Error('KPI 未就绪');
    expect(kpi.rows[0]).toMatchObject({
      'project-initiation-rate': 42.857142857142854,
      'analysis-meeting-rate': 86.25,
      'win-rate': 61.53846153846154,
      'review-rate': 64.58333333333334,
      'pipeline-support-rate': 72.4
    });
  });

  it('地图使用四档图例和年度费用 tooltip，概览表按设计结构为八列', () => {
    const page = loadPage();
    const board = page.sections.find((section) => section.id === 'map-board');
    const map = board?.components.find((component) => component.type === 'mapChart');
    if (!map || map.type !== 'mapChart') throw new Error('缺少地图');
    expect(map.props.legend).toEqual({
      title: '管道支持率',
      bands: [
        { label: '0', from: 0 },
        { label: '1%~50%', from: 1 },
        { label: '51%~80%', from: 51 },
        { label: '80%以上', from: 80 }
      ]
    });
    expect(map.props.tooltipFields?.map((field) => field.label)).toEqual([
      '机会点数', '预签金额', '年度费用'
    ]);

    const tabs = board?.components.find((component) => component.type === 'tabContainer');
    if (!tabs || tabs.type !== 'tabContainer') throw new Error('缺少 Tab 容器');
    expect(tabs.props.tabs.map((tab) => tab.label)).toEqual([
      '概览', 'TOP预签项目', '丢单项目'
    ]);
    const overview = tabs.props.tabs[0]?.component;
    if (!overview || overview.type !== 'table') throw new Error('缺少概览表');
    expect(overview.props.fit).toBe('container');
    expect(overview.props.columns).toHaveLength(8);
    expect(overview.props.columns.map((column) => column.kind === 'group' ? column.title : column.title))
      .toEqual([
        '排名',
        '代表处',
        '地区部',
        '预签金额',
        '管道支撑率',
        '项目分析会召开率',
        '本月新增签单',
        '立项率'
      ]);
    expect(overview.props.columns.every((column) => column.kind === 'group' || column.width))
      .toBe(true);
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
