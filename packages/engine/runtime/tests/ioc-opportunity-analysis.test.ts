import { versionPolicy } from '@metriccanvas/page';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import { flattenPageComponents, requiredMinorVersion } from '@metriccanvas/page/internal';
import { orchestrate, type PageDataSnapshots } from '../src';

const document = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../pages/business/dashboard/ioc/opportunity/ioc-opportunity-analysis.json', import.meta.url)),
    'utf8'
  )
) as Record<string, unknown>;

function loadPage(): Page {
  const parsed = parsePage(document);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

async function snapshotsOf(page: Page): Promise<PageDataSnapshots> {
  let snapshots: PageDataSnapshots = new Map();
  const gateway:import('../src').RuntimeDataGateway={
    async fetchFilterCandidates(){return {kind:'values',candidates:[{value:'R',label:'合成地区部',level:'region-dept'}]};},
    // Structural Region candidates must authorize a fresh query, even at the default scope.
    async fetchData(_query,context) {
      const source=page.dataSources[context?.dataSourceIds?.[0]??''];
      if(source?.source.type!=='query'||!source.source.initial)throw new Error('Missing synthetic source');
      const rows=source.source.initial.rows;
      return {rows,totalCount:rows.length};
    }
  };
  const stream=orchestrate(page,gateway);
  const stop=stream.subscribe(next=>{for(const [id,snapshot] of next)if(snapshot.status==='ready')snapshots=new Map(snapshots).set(id,snapshot);});
  try {
    await vi.waitFor(()=>expect(snapshots.get('region-analysis')?.status).toBe('ready'));
    stream.setActiveTabs({'opportunity-region-tabs':'office'});
    await vi.waitFor(()=>expect(snapshots.get('office-analysis')?.status).toBe('ready'));
  } finally {stop();}
  return snapshots;
}

describe('ioc-opportunity-analysis 页面契约', () => {
  it('声明统一紧凑可操作页头和七个已下推的筛选位', () => {
    const page = loadPage();
    expect(page.schemaVersion).toBe(versionPolicy.current);
    expect(requiredMinorVersion(document)).toBe(41);
    expect(page.layout).toBe('dashboard');
    expect(page.meta).toMatchObject({
      title: '机会点数',
      description: expect.stringContaining('合成演示数据')
    });
    expect(page.dashboardToolbar).toBeUndefined();
    expect(page.iocHeader).toMatchObject({
      presentation:{layout:'inline',density:'compact'},
      note: '合成演示数据，非生产口径；七个筛选位均已下推到查询'
    });
    expect(page.filters?.map((filter) => filter.id)).toEqual([
      'key-office', 'as-of-date', 'industry', 'region', 'customer-category', 'trade', 'pre-sign-amount'
    ]);
  });

  it('页面数据源全部走受控查询，默认筛选取得完整候选后执行查询并渲染', async () => {
    const page = loadPage();
    expect(Object.keys(page.dataSources)).toEqual([
      'opportunity-metrics', 'region-analysis', 'office-analysis'
    ]);
    expect(Object.values(page.dataSources).every((source) => source.source.type === 'query')).toBe(true);

    const snapshots = await snapshotsOf(page);
    for (const sourceId of Object.keys(page.dataSources)) {
      expect(snapshots.get(sourceId)?.status, sourceId).toBe('ready');
    }
  });

  it('指标区按 2:2:3:3 排列四张 metricGrid，合计二十个标签值单位', () => {
    const page = loadPage();
    const metrics = page.sections.find((section) => section.id === 'opportunity-metrics');
    expect(metrics?.container).toBe('plain');
    expect(metrics?.columnTracks).toEqual([2, 2, 3, 3]);
    expect(metrics?.components).toHaveLength(4);
    expect(metrics?.components.every(
      (component) => component.type === 'compositeCard' && component.props.variant === 'metricGrid'
    )).toBe(true);

    const cards = metrics?.components ?? [];
    for (const card of cards) {
      if (card.type !== 'compositeCard') throw new Error('指标区必须全部使用 compositeCard');
      expect(card.props.dividers).toBe(true);
    }
    expect(cards.slice(0, 2).map((card) => card.type === 'compositeCard'
      ? card.props.components.map((child) => [child.layout.span, child.type === 'metricCard' ? child.props.variant : undefined])
      : [])
    ).toEqual([
      [[12, 'compactStrip'], [12, 'compactStrip']],
      [[12, 'compactStrip'], [12, 'compactStrip']]
    ]);
    expect(cards.slice(2).map((card) => card.type === 'compositeCard'
      ? card.props.components.map((child) => [child.layout.span, child.type === 'metricCard' ? child.props.variant : undefined])
      : [])
    ).toEqual([
      [[4, 'compactStack'], [4, 'compactStack'], [4, 'compactStack']],
      [[4, 'compactStack'], [4, 'compactStack'], [4, 'compactStack']]
    ]);

    const rows = (metrics?.components ?? []).flatMap((component) =>
      component.type === 'compositeCard'
        ? component.props.components.flatMap((child) => child.type === 'metricCard' ? child.props.rows : [])
        : []
    );
    expect(rows).toHaveLength(20);
    expect(rows.map((row) => row.label)).toEqual([
      '机会点个数', '管道支撑率', '预签金额', '本年度销售预测',
      '公有云机会点数', '公有云管道支撑率', '混合云机会点数', '混合云管道支撑率',
      '华为云机会点', '管道支撑率', '政企机会点', '管道支撑率', '运营商机会点', '管道支撑率',
      '即将超期机会点', '预签金额', '超期机会点', '预签金额', '未更新机会点', '预签金额'
    ]);
    expect(rows.map((row) => row.unit)).toEqual([
      '个', '%', '亿', '亿', '个', '%', '个', '%', '个', '%', '个', '%', '个', '%', '个', '亿', '个', '亿', '个', '亿'
    ]);
  });

  it('地区部与代表处页签均顺序声明三张表', () => {
    const page = loadPage();
    const tabs = page.sections
      .find((section) => section.id === 'opportunity-regions')
      ?.components[0];
    expect(tabs?.type).toBe('tabContainer');
    if (tabs?.type !== 'tabContainer') throw new Error('缺少分区 Tab');
    expect(tabs.props.variant).toBe('analysisStack');
    expect(tabs.props.tabs.map((tab) => tab.label)).toEqual(['地区部', '代表处']);
    for (const tab of tabs.props.tabs) {
      if (!('components' in tab)) throw new Error(`${tab.id} 未声明多表列表`);
      expect(tab.components.map((component) => component.props.title)).toEqual([
        '机会点总览', '按BG类型看机会点', '机会点销售预测'
      ]);
    }
  });

  it('首版不声明无内容的详情弹窗或页内打开动作', () => {
    const page = loadPage();
    const components = flattenPageComponents(page);
    expect(components.map((component) => component.id)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/modal|detail-dialog/u)])
    );
    expect(components.every((component) =>
      component.type !== 'metricCard' || component.props.rows.every((row) => row.link !== true)
    )).toBe(true);
  });
});
