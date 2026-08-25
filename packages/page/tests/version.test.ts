import { describe, expect, it } from 'vitest';
import {
  PAGE_SCHEMA_MAJOR,
  capabilityFloorErrors,
  pageCapabilities,
  requiredMinorVersion,
  supportedVersions,
  versionErrors,
  versionPolicy
} from '../src/version';

const doc = (schemaVersion: unknown): unknown => ({ schemaVersion });

describe('MAJOR.MINOR 版本判定', () => {
  it('接受当前主版本内不高于 current 的任意次版本', () => {
    expect(supportedVersions()).toEqual(['5.0', '5.1']);
    expect(versionErrors(doc('5.0'))).toEqual([]);
    expect(versionErrors(doc('5.1'))).toEqual([]);
  });

  it('拒绝更高的次版本并说明原因', () => {
    const [error] = versionErrors(doc('5.9'));
    expect(error).toMatchObject({ type: 'SCHEMA_ERROR', path: '/schemaVersion' });
    expect(error?.message).toContain('高于运行时当前次版本');
  });

  it('拒绝其它主版本，且不提供自动迁移', () => {
    for (const version of ['4.0', '2.0', '1.0', '6.0']) {
      const [error] = versionErrors(doc(version));
      expect(error).toMatchObject({ type: 'SCHEMA_ERROR', path: '/schemaVersion' });
      expect(error?.message).toContain('跨主版本不提供自动迁移');
    }
  });

  it('缺失、非字符串与畸形 schemaVersion 的处理', () => {
    expect(versionErrors(doc(undefined))).toEqual([]);
    expect(versionErrors(doc(1))).toEqual([]);
    expect(versionErrors(null)).toEqual([]);
    expect(versionErrors(doc('5'))).toHaveLength(1);
    expect(versionErrors(doc('5.0.1'))).toHaveLength(1);
  });

  it('current 与主版本、次版本一致', () => {
    expect(versionPolicy.current).toBe(`${PAGE_SCHEMA_MAJOR}.${versionPolicy.minor}`);
    expect(versionPolicy.major).toBe(PAGE_SCHEMA_MAJOR);
  });
});

describe('能力表', () => {
  it('每个能力都登记了引入次版本，且不超过当前次版本', () => {
    const ids = Object.keys(pageCapabilities);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const minor = versionPolicy.capabilities[id as keyof typeof pageCapabilities];
      expect(minor, `能力 ${id} 未登记引入次版本`).toBeTypeOf('number');
      expect(minor).toBeLessThanOrEqual(versionPolicy.minor);
    }
  });

  it('versionPolicy.capabilities 与能力表逐条对齐', () => {
    expect(Object.keys(versionPolicy.capabilities).sort()).toEqual(
      Object.keys(pageCapabilities).sort()
    );
  });
});

const basePage = (overrides: Record<string, unknown>): unknown => ({
  schemaVersion: '5.0',
  id: 'demo',
  dataSources: {},
  sections: [],
  ...overrides
});

describe('能力下限推算', () => {
  it('只用 5.0 结构的文档要求次版本 0', () => {
    expect(requiredMinorVersion(basePage({}))).toBe(0);
    expect(capabilityFloorErrors(basePage({}))).toEqual([]);
  });

  it('顶层 params 把下限抬到 5.1', () => {
    const page = basePage({ params: [{ id: 'code', type: 'string', required: true }] });
    expect(requiredMinorVersion(page)).toBe(1);
    expect(capabilityFloorErrors(page)).toEqual([
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/params' })
    ]);
  });

  it('文本取值引用按形状识别，定位到引用所在位置', () => {
    const page = basePage({
      sections: [
        {
          id: 'head',
          components: [
            { id: 'title', type: 'reportHeader', layout: { span: 12 }, props: { title: { param: 'code' } } }
          ]
        }
      ]
    });
    expect(capabilityFloorErrors(page)).toEqual([
      expect.objectContaining({
        path: '/sections/0/components/0/props/title'
      })
    ]);
  });

  it('按角色分组的局部显式字段上的可折叠声明同样被探测到', () => {
    const page = basePage({
      dataSources: {
        forecast: {
          fields: {
            measures: { amount: { queryField: '金额', type: 'number', collapsible: true } }
          },
          source: { type: 'query' }
        }
      }
    });
    expect(capabilityFloorErrors(page).map((error) => error.path)).toEqual([
      '/dataSources/forecast/fields/measures/amount/collapsible'
    ]);
  });

  it('数据源计算阶段、可折叠度量与表格呈现属性都被登记', () => {
    const page = basePage({
      dataSources: {
        forecast: {
          fields: { amount: { type: 'number', role: 'measure', collapsible: true } },
          compute: [{ op: 'grandTotal' }],
          source: { type: 'inline', rows: [] }
        }
      },
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'grid',
              type: 'table',
              layout: { span: 12 },
              data: { main: 'forecast' },
              props: { columns: [], rowKindField: 'row-kind', mergeBy: 'business-type' }
            }
          ]
        }
      ]
    });
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/dataSources/forecast/compute',
      '/dataSources/forecast/fields/amount/collapsible',
      '/sections/0/components/0/props/mergeBy',
      '/sections/0/components/0/props/rowKindField'
    ]);
  });

  it('两个新组件各自登记', () => {
    const page = basePage({
      sections: [
        {
          id: 'body',
          components: [
            { id: 'panel', type: 'keyValuePanel', layout: { span: 12 }, data: { main: 'a' }, props: { items: [] } },
            { id: 'note', type: 'fieldText', layout: { span: 12 }, data: { main: 'a' }, props: { field: 'x' } }
          ]
        }
      ]
    });
    expect(capabilityFloorErrors(page).map((error) => error.path)).toEqual([
      '/sections/0/components/0',
      '/sections/0/components/1'
    ]);
  });

  it('新筛选器类型、层级、级联、相对时间与列 link 都登记为 5.1', () => {
    const page = basePage({
      filters: [
        { id: 'flag', type: 'boolean' },
        { id: 'month', type: 'timePoint', granularity: 'month' },
        { id: 'amount', type: 'numberRange' },
        { id: 'keyword', type: 'search' },
        {
          id: 'region',
          type: 'dimension',
          dimension: 'geo',
          hierarchy: [
            { id: 'geo', dimension: 'geo' },
            { id: 'office', dimension: 'office' }
          ],
          dependsOn: 'flag'
        },
        {
          id: 'range',
          type: 'timeRange',
          default: { unit: 'month', range: { kind: 'lastN', n: 3 }, includeCurrent: true }
        }
      ],
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'grid',
              type: 'table',
              layout: { span: 12 },
              data: { main: 'a' },
              props: { columns: [{ field: 'name', link: true }] }
            }
          ]
        }
      ]
    });
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/filters/0',
      '/filters/1',
      '/filters/2',
      '/filters/3',
      '/filters/4/dependsOn',
      '/filters/4/hierarchy',
      '/filters/5/default',
      '/sections/0/components/0/props/columns/0/link'
    ]);
  });

  it('Tab、gauge 与地图层级下钻各自登记', () => {
    const page = basePage({
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'rate',
              type: 'gauge',
              layout: { span: 2 },
              data: { main: 'a' },
              props: { valueField: 'rate' }
            },
            {
              id: 'tabs',
              type: 'tabContainer',
              layout: { span: 4 },
              props: {
                tabs: [
                  {
                    id: 'one',
                    label: '概览',
                    component: {
                      id: 'grid',
                      type: 'table',
                      layout: { span: 12 },
                      data: { main: 'a' },
                      props: { columns: [{ field: 'name', link: true }] }
                    }
                  }
                ]
              }
            },
            {
              id: 'map',
              type: 'mapChart',
              layout: { span: 8 },
              data: { main: 'a' },
              props: {
                nameField: 'name',
                valueField: 'value',
                map: 'world',
                hierarchyFilter: 'region'
              }
            }
          ]
        }
      ]
    });
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/sections/0/components/0',
      '/sections/0/components/1',
      '/sections/0/components/1/props/tabs/0/component/props/columns/0/link',
      '/sections/0/components/2/props/hierarchyFilter'
    ]);
  });

  it('声明 5.1 后不再报能力下限错误', () => {
    const page = basePage({
      schemaVersion: '5.1',
      params: [{ id: 'code', type: 'string', required: true }]
    });
    expect(capabilityFloorErrors(page)).toEqual([]);
  });

  it('跨主版本声明交给 versionErrors，能力下限不重复报错', () => {
    const page = basePage({ schemaVersion: '4.0', params: [{ id: 'code' }] });
    expect(capabilityFloorErrors(page)).toEqual([]);
  });
});
