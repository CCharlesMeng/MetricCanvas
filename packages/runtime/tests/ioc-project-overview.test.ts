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
  it('声明 5.4，能力下限覆盖唯一指标值入口', () => {
    const page = loadPage();
    expect(page.schemaVersion).toBe('5.4');
    expect(requiredMinorVersion(document)).toBe(4);
  });

  it('五个可见筛选按设计顺序声明，跨页 mtime 仍以 month 隐藏保留', () => {
    const page = loadPage();
    const filters = page.filters ?? [];
    expect(filters.filter((filter) => filter.visible !== false).map((filter) => filter.id))
      .toEqual(['key-office', 'as-of-date', 'region', 'project-level', 'industry-type']);

    expect(filters.find((filter) => filter.id === 'mtime')).toMatchObject({
      type: 'timePoint', granularity: 'month', default: '2026-04', visible: false
    });
    expect(filters.find((filter) => filter.id === 'as-of-date')).toMatchObject({
      type: 'timePoint', granularity: 'date', default: '2026-03-26'
    });
    expect(filters.find((filter) => filter.id === 'project-level')).toMatchObject({
      type: 'dimension', dimension: 'project-initiation-level', emptyLabel: '全部项目等级'
    });
    expect(filters.find((filter) => filter.id === 'industry-type')).toMatchObject({
      type: 'dimension', dimension: 'cloud-class', emptyLabel: '全部产业'
    });
    expect(filters.find((filter) => filter.id === 'region')).toMatchObject({
      type: 'dimension', hierarchyPicker: 'hidden', defaultLevel: 'geo', emptyLabel: '区域'
    });

    const candidateDimensions = new Set<string>();
    for (const filter of filters) {
      if (filter.type !== 'dimension') continue;
      candidateDimensions.add(filter.dimension);
      for (const level of filter.hierarchy ?? []) candidateDimensions.add(level.dimension);
    }
    expect([...candidateDimensions].sort()).toEqual([
      'cloud-class',
      'geo-pc-code',
      'project-initiation-level',
      'region-dept-code',
      'rep-office-code'
    ]);
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
    expect(board.columnTracks).toEqual([29, 29, 22]);

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
      ['kpi-opportunity-outline', 1],
      ['kpi-initiation-management', 1],
      ['kpi-review', 1]
    ]);
    expect(board.components.find((component) => component.id === 'overview-tabs')?.layout.span)
      .toBe(1);
    expect(composites.map((component) => component.props.variant)).toEqual([
      'compact', 'compact', 'compact'
    ]);
    expect(composites.map((component) => component.props.titleIcon)).toEqual([
      'opportunity', 'tieredManagement', 'review'
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

  it('紧凑呈现配方由显式闭集声明，不依赖页面 id 或业务标题分支', () => {
    const page = loadPage();
    const board = page.sections.find((section) => section.id === 'map-board');
    if (!board) throw new Error('缺少地图分区');

    const opportunity = board.components.find(
      (component) => component.id === 'kpi-opportunity-outline'
    );
    if (!opportunity || opportunity.type !== 'compositeCard') throw new Error('缺少机会点卡');
    const opportunityMetrics = opportunity.props.components.find(
      (component) => component.id === 'opportunity-summary-metrics'
    );
    if (!opportunityMetrics || opportunityMetrics.type !== 'metricCard') {
      throw new Error('缺少机会点指标');
    }
    expect(opportunityMetrics.props.rows.map((row) => [row.label, row.unit, row.changes?.length ?? 0]))
      .toEqual([
        ['机会点数', '个', 1],
        ['总预签金额', undefined, 1],
        ['年度销售预测', undefined, 0]
      ]);
    expect(opportunityMetrics.props.rows.map((row) => row.link)).toEqual([
      true, undefined, undefined
    ]);
    expect(opportunityMetrics.props.actions).toEqual([
      { on: 'click', navigate: { page: 'ioc-opportunity-analysis' } }
    ]);
    expect(opportunityMetrics.props.rows[0]?.changes?.[0]).toMatchObject({
      label: '较上月', unit: '个', field: { field: 'opportunity-cnt-mom', format: 'number' }
    });
    expect(opportunityMetrics.props.rows[1]?.changes?.[0]).toMatchObject({
      label: '较上月', field: { field: 'bidding-amount-mom', format: 'cny-adaptive' }
    });
    const opportunityRing = opportunity.props.components.find(
      (component) => component.id === 'opportunity-tier-ring'
    );
    if (!opportunityRing || opportunityRing.type !== 'pieChart') {
      throw new Error('缺少机会点分层环图');
    }
    expect(opportunityRing).toMatchObject({
      layout: { span: 3 },
      data: { main: 'opportunity-tiers' },
      props: {
        variant: 'compactRing',
        categoryField: 'tier-name',
        valueField: 'tier-cnt',
        ring: '60%',
        labelLine: false
      }
    });

    const management = board.components.find(
      (component) => component.id === 'kpi-initiation-management'
    );
    if (!management || management.type !== 'compositeCard') throw new Error('缺少分级管理卡');
    const summary = management.props.components.find((component) => component.id === 'initiation-summary');
    const rates = management.props.components.find((component) => component.id === 'project-rates');
    if (!summary || summary.type !== 'metricCard' || !rates || rates.type !== 'metricCard') {
      throw new Error('缺少分级管理指标');
    }
    expect(summary.props.rows).toHaveLength(1);
    expect(summary.props.rows[0]).toMatchObject({
      label: '已立项',
      valueField: { field: 'initiated-amount', format: 'cny-adaptive' }
    });
    expect(summary.props.rows[0]?.changes?.[0]).toMatchObject({
      label: '预签金额', tone: 'neutral',
      field: { field: 'bidding-amount', format: 'cny-adaptive' }
    });
    expect(rates.props.rows[1]).toMatchObject({
      label: '项目分析会召开率', context: '近60天'
    });
    const projectLevelRing = management.props.components.find(
      (component) => component.id === 'project-level-ring'
    );
    if (!projectLevelRing || projectLevelRing.type !== 'pieChart') {
      throw new Error('缺少项目分级环图');
    }
    expect(projectLevelRing).toMatchObject({
      layout: { span: 3 },
      data: { main: 'project-levels' },
      props: {
        variant: 'compactRing',
        categoryField: 'level-name',
        valueField: 'level-cnt',
        ring: '60%',
        labelLine: false
      }
    });

    const gauge = opportunity.props.components.find((component) => component.type === 'gauge');
    if (!gauge || gauge.type !== 'gauge') throw new Error('缺少管道支撑率');
    expect(gauge.props).toMatchObject({
      variant: 'mini', label: '年度管道\n支撑率', unit: '%',
      valueField: { field: 'pipeline-support-rate', format: 'number-1' }
    });

    const review = board.components.find((component) => component.id === 'kpi-review');
    if (!review || review.type !== 'compositeCard') throw new Error('缺少复盘卡');
    const medals = review.props.components.find((component) => component.id === 'review-medals');
    if (!medals || medals.type !== 'keyValuePanel') throw new Error('缺少奖牌计数');
    expect(medals.props.titleIcon).toBe('reward');
    expect(medals.props.items.map((item) => item.icon)).toEqual([
      'goldMedal', 'silverMedal', 'redCard', 'yellowCard'
    ]);
    expect(medals.props.items.map((item) => item.unit)).toEqual(['个', '个', '个', '个']);
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
      'pipeline-support-rate': 98.2
    });
  });

  it('地图使用四档图例和年度销售预测 tooltip，概览表按设计结构为八列', () => {
    const page = loadPage();
    const board = page.sections.find((section) => section.id === 'map-board');
    const map = board?.components.find((component) => component.type === 'mapChart');
    if (!map || map.type !== 'mapChart') throw new Error('缺少地图');
    expect(map.props.variant).toBe('regionalOverview');
    expect(map.props.pinnedSummary).toBeUndefined();
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
      '机会点数', '预签金额', '年度销售预测'
    ]);

    const compositeCards = board?.components.filter(
      (component) => component.type === 'compositeCard'
    );
    expect(compositeCards?.map((component) => component.props.dividers)).toEqual([
      false,
      false,
      false
    ]);

    const tabs = board?.components.find((component) => component.type === 'tabContainer');
    if (!tabs || tabs.type !== 'tabContainer') throw new Error('缺少 Tab 容器');
    expect(tabs.props.variant).toBe('compact');
    expect(tabs.props.tabs.map((tab) => tab.label)).toEqual([
      '概览', 'TOP预签项目', '丢单项目'
    ]);
    const overviewTab = tabs.props.tabs[0];
    const overview = overviewTab && 'component' in overviewTab
      ? overviewTab.component
      : undefined;
    if (!overview || overview.type !== 'table') throw new Error('缺少概览表');
    expect(overview.props).toMatchObject({ variant: 'embedded', bottomFade: true });
    expect(overview.props.fit).toBe('container');
    expect(overview.props.columns).toHaveLength(8);
    expect(overview.props.columns.map((column) => column.kind === 'group' ? column.title : column.title))
      .toEqual([
        '排名',
        '代表处',
        '区域',
        '预签\n金额',
        '管道\n支撑率',
        '项目分析会召开率',
        '本月新\n签单',
        '立项率'
      ]);
    expect(overview.props.columns.every((column) => column.kind === 'group' || column.width))
      .toBe(true);

    const overviewSource = page.dataSources['overview-by-office'];
    if (overviewSource?.source.type !== 'inline') throw new Error('概览数据必须是 inline');
    expect(overviewSource.source.rows).toHaveLength(8);
    expect(overviewSource.source.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const officeCodes = overviewSource.source.rows.map((row) => row['rep-office-code']);
    expect(new Set(officeCodes).size).toBe(8);
    expect(officeCodes).toEqual([
      'SH-01', 'BJ-01', 'GD-01', 'SZ-01', 'HZ-01', 'CD-01', 'SG-01', 'TJ-01'
    ]);
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
    const listParams = new URLSearchParams(listSearch);
    expect(listParams.get('mtime')).toBe('m:month:2026-04');
    expect(listParams.get('region')).toContain('h:rep-office-code:office:BJ-01');
    expect(listParams.has('as-of-date')).toBe(false);
    expect(listParams.has('project-level')).toBe(false);
    expect(listSearch).not.toContain('p:');

    const restored = createFilterState();
    restored.fromURL(listSearch);
    let restoredValues = new Map();
    restored.subscribe((next) => {
      restoredValues = new Map(next);
    })();
    expect(restoredValues.get('mtime')).toEqual({
      type: 'timePoint', granularity: 'month', value: '2026-04'
    });
    expect(restoredValues.has('as-of-date')).toBe(false);
    expect(restoredValues.has('project-level')).toBe(false);

    const tabs = page.sections
      .flatMap((section) => section.components)
      .find((component) => component.type === 'tabContainer');
    if (!tabs || tabs.type !== 'tabContainer') throw new Error('缺少 Tab 容器');
    const initiatedTab = tabs.props.tabs.find((tab) => tab.id === 'pre-approval-project');
    const initiated = initiatedTab && 'component' in initiatedTab
      ? initiatedTab.component
      : undefined;
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
