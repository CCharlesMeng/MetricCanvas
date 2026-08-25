import { describe, expect, it } from 'vitest';
import { crossPageReferenceErrors, navigateErrors, type Page } from '../src';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';

function sourcePage(target: string): Page {
  const page: any = structuredClone(queryDashboard);
  page.sections[0].components[0].props.actions = [
    {
      on: 'click',
      navigate: {
        page: target,
        carryFilters: ['region-filter'],
        setFilters: { 'region-filter': 'region' }
      }
    }
  ];
  return page as Page;
}

function targetPage(): Page {
  const page: any = structuredClone(queryDashboard);
  page.id = 'sales-detail';
  return page as Page;
}

describe('navigateErrors', () => {
  it('校验嵌套 component props 中的 navigate 目标与目标筛选器', () => {
    const target = targetPage();
    expect(
      navigateErrors(
        sourcePage('sales-detail'),
        new Set(['query-dashboard', 'sales-detail']),
        new Map([['sales-detail', target]])
      )
    ).toEqual([]);

    expect(
      navigateErrors(
        sourcePage('missing-page'),
        new Set(['query-dashboard']),
        new Map()
      )
    ).toEqual([
      expect.objectContaining({
        path: '/sections/0/components/0/props/actions/0/navigate/page'
      })
    ]);

    const withoutFilter: Page = { ...target, filters: [] };
    expect(
      navigateErrors(
        sourcePage('sales-detail'),
        new Set(['sales-detail']),
        new Map([['sales-detail', withoutFilter]])
      ).map((error) => error.path)
    ).toEqual([
      '/sections/0/components/0/props/actions/0/navigate/carryFilters/0',
      '/sections/0/components/0/props/actions/0/navigate/setFilters/region-filter'
    ]);
  });

  it('setParams 要求目标页声明同名参数且类型相容', () => {
    const source: any = structuredClone(queryDashboard);
    source.schemaVersion = '5.1';
    source.sections[0].components[0].props.actions = [
      {
        on: 'click',
        navigate: {
          page: 'sales-detail',
          setParams: { code: 'region', missing: 'region' }
        }
      }
    ];
    const target: any = structuredClone(queryDashboard);
    target.id = 'sales-detail';
    target.params = [{ id: 'code', type: 'string', required: true }];

    expect(
      crossPageReferenceErrors(
        source as Page,
        new Set(['sales-detail']),
        new Map([['sales-detail', target as Page]])
      ).map((error) => error.path)
    ).toEqual(['/sections/0/components/0/props/actions/0/navigate/setParams/missing']);
  });

  it('文本组件 links 使用相同跨文档规则', () => {
    const source: any = structuredClone(queryDashboard);
    source.sections[0].components = [
      {
        id: 'detail-link',
        type: 'text',
        layout: { span: 12 },
        props: {
          links: [{ label: '详情', page: 'missing-page' }]
        }
      }
    ];
    expect(
      navigateErrors(source as Page, new Set(), new Map())
    ).toEqual([
      expect.objectContaining({
        path: '/sections/0/components/0/props/links/0/page'
      })
    ]);
  });
});
