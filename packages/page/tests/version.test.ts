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
    expect(supportedVersions()).toEqual(['5.0', '5.1', '5.2', '5.3', '5.4']);
    expect(versionErrors(doc('5.0'))).toEqual([]);
    expect(versionErrors(doc('5.1'))).toEqual([]);
    expect(versionErrors(doc('5.2'))).toEqual([]);
    expect(versionErrors(doc('5.3'))).toEqual([]);
    expect(versionErrors(doc('5.4'))).toEqual([]);
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

  it('5.2 的六条能力各自登记并定位到使用点', () => {
    const page = basePage({
      dataSources: {
        pipeline: {
          fields: { rate: { type: 'number', role: 'measure' } },
          compute: [{ op: 'ratio', numerator: 'a', denominator: 'b', output: 'rate', scale: 100 }],
          source: { type: 'inline', rows: [] }
        }
      },
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'summary-card',
              type: 'compositeCard',
              layout: { span: 4 },
              props: {
                components: [
                  {
                    id: 'tier-breakdown',
                    type: 'categoryBreakdown',
                    layout: { span: 6 },
                    data: { main: 'pipeline' },
                    props: { categoryField: 'tier', columns: [{ label: '数量', field: 'count' }] }
                  },
                  {
                    id: 'basics',
                    type: 'keyValuePanel',
                    layout: { span: 6 },
                    data: { main: 'pipeline' },
                    props: { columns: 1, items: [] }
                  }
                ]
              }
            },
            {
              id: 'map',
              type: 'mapChart',
              layout: { span: 8 },
              data: { main: 'pipeline' },
              props: {
                nameField: 'name',
                valueField: 'rate',
                map: 'china',
                legend: { title: '管道支持率', bands: [{ label: '0', from: 0 }] },
                tooltipFields: [{ label: '机会点数', field: 'count' }]
              }
            }
          ]
        }
      ]
    });
    expect(requiredMinorVersion(page)).toBe(2);
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/dataSources/pipeline/compute',
      '/dataSources/pipeline/compute/0/scale',
      '/sections/0/components/0',
      '/sections/0/components/0/props/components/0',
      '/sections/0/components/0/props/components/1',
      '/sections/0/components/0/props/components/1/props/columns',
      '/sections/0/components/1/props/legend',
      '/sections/0/components/1/props/tooltipFields'
    ]);
  });

  it('组合卡内的子组件参与能力探测', () => {
    const page = basePage({
      schemaVersion: '5.2',
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'summary-card',
              type: 'compositeCard',
              layout: { span: 4 },
              props: {
                components: [
                  {
                    id: 'nested-title',
                    type: 'metricCard',
                    layout: { span: 12 },
                    data: { main: 'a' },
                    props: { title: { param: 'code' }, rows: [] }
                  }
                ]
              }
            }
          ]
        }
      ]
    });
    // 声明 5.2 仍要能看见卡内的 5.1 文本取值引用，说明遍历确实走进了容器。
    expect(requiredMinorVersion(page)).toBe(2);
    expect(
      pageCapabilities['text-value-reference'].usedAt(page)
    ).toEqual(['/sections/0/components/0/props/components/0/props/title']);
  });

  it('keyValuePanel 的 2/3/4 列不是 5.2 能力', () => {
    const page = basePage({
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'basics',
              type: 'keyValuePanel',
              layout: { span: 12 },
              data: { main: 'a' },
              props: { columns: 3, items: [] }
            }
          ]
        }
      ]
    });
    expect(pageCapabilities['key-value-panel-single-column'].usedAt(page)).toEqual([]);
  });

  it('5.3 的分区列轨与筛选空态文案分别定位到使用点', () => {
    const page = basePage({
      filters: [
        {
          id: 'industry',
          type: 'dimension',
          dimension: 'cloud-class',
          emptyLabel: '全部产业',
          hierarchyPicker: 'hidden'
        }
      ],
      sections: [
        {
          id: 'weighted',
          columnTracks: [29, 29, 22],
          components: [
            {
              id: 'summary',
              type: 'metricCard',
              layout: { span: 1 },
              data: { main: 'a' },
              props: { rows: [] }
            }
          ]
        }
      ]
    });
    expect(requiredMinorVersion(page)).toBe(3);
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/filters/0/emptyLabel',
      '/filters/0/hierarchyPicker',
      '/sections/0/columnTracks'
    ]);

    (page as { schemaVersion: string }).schemaVersion = '5.3';
    expect(capabilityFloorErrors(page)).toEqual([]);
  });

  it('5.3 的显式紧凑呈现、单位、指标上下文与地域摘要分别定位到使用点', () => {
    const page = basePage({
      schemaVersion: '5.2',
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'card', type: 'compositeCard', layout: { span: 4 },
              props: {
                variant: 'compact',
                titleIcon: 'opportunity',
                components: [{
                  id: 'metric', type: 'metricCard', layout: { span: 12 }, data: { main: 'a' },
                  props: { rows: [{ label: '召开率', context: '近60天', valueField: 'rate' }] }
                }]
              }
            },
            {
              id: 'panel', type: 'keyValuePanel', layout: { span: 4 }, data: { main: 'a' },
              props: {
                titleIcon: 'reward',
                items: [{ label: '金牌', field: 'gold', unit: '个', icon: 'goldMedal' }]
              }
            },
            {
              id: 'map', type: 'mapChart', layout: { span: 4 }, data: { main: 'a' },
              props: {
                variant: 'regionalOverview', nameField: 'name', valueField: 'rate', map: 'world',
                pinnedSummary: {
                  matchField: 'code', matchValue: 'R99', titleField: 'name',
                  fields: [{ label: '支撑率', field: 'rate' }]
                }
              }
            },
            {
              id: 'tabs', type: 'tabContainer', layout: { span: 4 },
              props: {
                variant: 'compact',
                tabs: [{
                  id: 'one', label: '概览',
                  component: {
                    id: 'grid', type: 'table', layout: { span: 12 }, data: { main: 'a' },
                    props: { variant: 'embedded', bottomFade: true, columns: [{ field: 'name' }] }
                  }
                }]
              }
            }
          ]
        }
      ]
    });

    expect(requiredMinorVersion(page)).toBe(3);
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/sections/0/components/0/props/components/0/props/rows/0/context',
      '/sections/0/components/0/props/titleIcon',
      '/sections/0/components/0/props/variant',
      '/sections/0/components/1/props/items/0/icon',
      '/sections/0/components/1/props/items/0/unit',
      '/sections/0/components/1/props/titleIcon',
      '/sections/0/components/2/props/pinnedSummary',
      '/sections/0/components/2/props/variant',
      '/sections/0/components/3/props/tabs/0/component/props/bottomFade',
      '/sections/0/components/3/props/tabs/0/component/props/variant',
      '/sections/0/components/3/props/variant'
    ]);
  });

  it('5.3 的项目详情还原呈现档与六列面板均受能力下限约束', () => {
    const page = basePage({
      schemaVersion: '5.2',
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'header', type: 'reportHeader', layout: { span: 12 },
              props: { title: '项目详情', variant: 'projectDetail' }
            },
            {
              id: 'summary', type: 'keyValuePanel', layout: { span: 3 }, data: { main: 'a' },
              props: { columns: 2, items: [], variant: 'detailSummary' }
            },
            {
              id: 'matrix', type: 'keyValuePanel', layout: { span: 3 }, data: { main: 'a' },
              props: { columns: 6, items: [], variant: 'detailNormMatrix' }
            },
            {
              id: 'norms', type: 'compositeCard', layout: { span: 6 },
              props: { components: [], variant: 'projectNorms' }
            },
            {
              id: 'forecast', type: 'table', layout: { span: 12 }, data: { main: 'a' },
              props: { columns: [], variant: 'forecastMatrix' }
            },
            ...['narrativeShort', 'narrativeMeeting', 'narrativeRisk', 'narrativeProgress'].map(
              (variant, index) => ({
                id: `narrative-${index}`,
                type: 'fieldText',
                layout: { span: 12 },
                data: { main: 'a' },
                props: { field: 'text', variant }
              })
            )
          ]
        }
      ]
    });

    expect(requiredMinorVersion(page)).toBe(3);
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/sections/0/components/0/props/variant',
      '/sections/0/components/1/props/variant',
      '/sections/0/components/2/props/columns',
      '/sections/0/components/2/props/variant',
      '/sections/0/components/3/props/variant',
      '/sections/0/components/4/props/variant',
      '/sections/0/components/5/props/variant',
      '/sections/0/components/6/props/variant',
      '/sections/0/components/7/props/variant',
      '/sections/0/components/8/props/variant'
    ]);

    (page as { schemaVersion: string }).schemaVersion = '5.3';
    expect(capabilityFloorErrors(page)).toEqual([]);
  });

  it('5.4 的值级链接、多表 Tab、紧凑页头与 metricGrid 各自定位', () => {
    const table = (id: string) => ({
      id, type: 'table', layout: { span: 12 }, data: { main: 'a' },
      props: { columns: [{ field: 'name' }] }
    });
    const page = basePage({
      schemaVersion: '5.3',
      dashboardToolbar: { variant: 'compact', readOnly: true, note: '演示' },
      sections: [{
        id: 'body',
        components: [
          {
            id: 'card', type: 'compositeCard', layout: { span: 4 },
            props: {
              variant: 'metricGrid',
              components: [{
                id: 'metric', type: 'metricCard', layout: { span: 12 }, data: { main: 'a' },
                props: {
                  rows: [{ label: '机会点数', valueField: 'value', link: true }],
                  actions: [{ on: 'click', navigate: { page: 'detail' } }]
                }
              }]
            }
          },
          {
            id: 'tabs', type: 'tabContainer', layout: { span: 8 },
            props: {
              variant: 'analysisStack',
              tabs: [{ id: 'one', label: '概览', components: [table('a'), table('b')] }]
            }
          }
        ]
      }]
    });

    expect(requiredMinorVersion(page)).toBe(4);
    expect(capabilityFloorErrors(page).map((error) => error.path).sort()).toEqual([
      '/dashboardToolbar',
      '/sections/0/components/0/props/components/0/props/rows/0/link',
      '/sections/0/components/0/props/variant',
      '/sections/0/components/1/props/tabs/0/components',
      '/sections/0/components/1/props/variant'
    ]);

    (page as { schemaVersion: string }).schemaVersion = '5.4';
    expect(capabilityFloorErrors(page)).toEqual([]);
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
