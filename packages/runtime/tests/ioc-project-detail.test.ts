import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePage, requiredMinorVersion, type Page } from '@metriccanvas/page';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { resolvePageParams } from '../src/page-params';

/**
 * IOC 项目详情页骨架的回归:页面文档 + 计算阶段 + 页面参数三者合起来
 * 是否真的产出可渲染的内容。`pnpm validate` 只证明结构与不变式成立,
 * 证明不了「小计行真的算出来了」。
 */

const document = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../pages/ioc-project-detail.json', import.meta.url)),
    'utf8'
  )
) as Record<string, unknown>;

function loadPage(search: string): Page {
  const declared = parsePage(document);
  if (!declared.ok) throw new Error(JSON.stringify(declared.errors));
  const params = resolvePageParams(search, declared.page.params ?? []);
  expect(params.missing).toEqual([]);
  const parsed = parsePage(document, { textValues: { values: params.values } });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

function snapshotsOf(page: Page): PageDataSnapshots {
  let snapshots: PageDataSnapshots = new Map();
  orchestrate(page, {
    async fetchData() {
      throw new Error('详情页骨架全部使用 inline 数据源');
    }
  }).subscribe((next) => {
    snapshots = next;
  });
  return snapshots;
}

function readyRows(snapshots: PageDataSnapshots, sourceId: string) {
  const snapshot = snapshots.get(sourceId);
  if (snapshot?.status !== 'ready') {
    throw new Error(`数据源 ${sourceId} 未就绪:${snapshot?.status}`);
  }
  return snapshot.rows;
}

describe('ioc-project-detail 骨架', () => {
  it('声明 5.2 看板形态，基本信息与项目规范性按 3:9 并排', () => {
    const page = loadPage('');
    expect(page.schemaVersion).toBe('5.2');
    expect(requiredMinorVersion(document)).toBe(2);
    expect(page.layoutForm).toBe('dashboard');
    expect(page.sections.map((section) => section.id)).toEqual([
      'page-header',
      'project-profile',
      'sales-forecast',
      'project-narrative'
    ]);

    const profile = page.sections.find((section) => section.id === 'project-profile');
    expect(profile?.container).toBeUndefined();
    expect(profile?.title).toBeUndefined();
    expect(
      profile?.components.map((component) => [
        component.id,
        component.layout.span,
        component.props.title
      ])
    ).toEqual([
      ['basics-panel', 3, '项目基本信息'],
      ['project-norms', 9, '项目规范性']
    ]);

    const norms = profile?.components.find((component) => component.id === 'project-norms');
    expect(norms?.type).toBe('compositeCard');
    expect(
      norms?.type === 'compositeCard'
        ? norms.props.components.map((component) => [
            component.id, component.type, component.layout.span, component.props.title
          ])
        : undefined
    ).toEqual([
      ['operation-norm-panel', 'keyValuePanel', 12, '项目运作规范性'],
      ['customer-relation-panel', 'keyValuePanel', 12, '客户关系规范性']
    ]);

    const narrative = page.sections.find((section) => section.id === 'project-narrative');
    expect(narrative?.components.map((component) => component.id)).toEqual([
      'project-background',
      'project-objectives',
      'competitor-update',
      'latest-analysis-meeting',
      'risk-management',
      'project-progress'
    ]);
    expect(narrative?.components.every((component) => component.layout.span === 12)).toBe(
      true
    );
  });

  it('页面参数默认值让页面独立可渲染，URL 取值覆盖默认值', () => {
    const header = loadPage('').sections[0]!.components[0]!;
    expect(header.props).toMatchObject({
      title: 'XX 云迁移项目',
      badge: 'OPP202604001',
      asOf: { label: '数据月份', value: '202604' },
      tags: ['已立项', 'L1', '战略客户', '运营商']
    });

    const overridden = loadPage('page-title=p%3A%E8%BF%81%E7%A7%BB%E4%B8%80%E6%9C%9F')
      .sections[0]!.components[0]!;
    expect(overridden.props).toMatchObject({ title: '迁移一期' });
  });

  it('销售预测表按业务类型产出小计行，并在末尾产出全局合计行', () => {
    const rows = readyRows(snapshotsOf(loadPage('')), 'sales-forecast');

    expect(rows.map((row) => [row['business-type'], row['row-kind']])).toEqual([
      ['弹性云服务 ECS', null],
      ['弹性云服务 ECS', null],
      ['弹性云服务 ECS合计', 'subtotal'],
      ['云数据库 GaussDB', null],
      ['云数据库 GaussDB', null],
      ['云数据库 GaussDB合计', 'subtotal'],
      ['合计', 'total']
    ]);

    const details = rows.filter((row) => row['row-kind'] === null);
    const total = rows.at(-1)!;
    expect(total['object-forecast-jan']).toBe(
      details.reduce((sum, row) => sum + Number(row['object-forecast-jan']), 0)
    );
  });

  it('客户关系规范性行转列为一行，专题交流缺失时取技术交流', () => {
    const rows = readyRows(snapshotsOf(loadPage('')), 'customer-relation');

    expect(rows).toEqual([
      {
        'high-level-visit-count': 5,
        'company-visit-count': 3,
        'workshop-exchange-count': 2,
        'summit-meeting-count': null,
        'circle-activities-count': 4
      }
    ]);
  });

  it('基本信息与长文本来自同一条记录', () => {
    const rows = readyRows(snapshotsOf(loadPage('')), 'project-detail');

    expect(rows).toHaveLength(1);
    expect(rows[0]!['party-company-name']).toBe('XX 科技有限公司');
    expect(String(rows[0]!['project-risks'])).toContain('迁移窗口审批');
    for (const field of [
      'project-background',
      'project-objectives',
      'project-help-required',
      'competitor-update',
      'project-risks',
      'project-progress',
      'latest-analysis-meeting-topic',
      'latest-analysis-meeting-conclusion'
    ]) {
      expect(rows[0]).toHaveProperty(field);
    }
    expect(String(rows[0]!['latest-analysis-meeting-display'])).toContain('2026-04-10');
    expect(String(rows[0]!['risk-management-display'])).toContain('困难求助');
  });
});
