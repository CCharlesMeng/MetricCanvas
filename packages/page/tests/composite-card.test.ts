import { describe, expect, it } from 'vitest';
import {
  componentCatalogEntry,
  parsePage,
  requiredMinorVersion,
  validate,
  versionPolicy
} from '../src';

/**
 * 5.2 批次的协议判定:组合卡(容器)、分类明细(叶子)与同批的字段级增量。
 * 每一项一条正向、一条反向;组合卡的结构不变量逐条钉住报错文案,因为
 * 「白名单外的子组件」在 ajv 侧只会摊成一堆判别联合分支错误。
 */

function cardPage(): any {
  return structuredClone({
    schemaVersion: '5.2',
    id: 'composite-probe',
    dataSources: {
      tiers: {
        fields: {
          tier: { type: 'string', role: 'dimension', label: '分层' },
          count: { type: 'number', role: 'measure', label: '机会点数' },
          amount: { type: 'money', role: 'measure', currency: 'CNY', label: '预签金额' }
        },
        source: {
          type: 'inline',
          rows: [
            { tier: '卓越', count: 12, amount: 3200000 },
            { tier: '战略', count: 8, amount: 1800000 }
          ]
        }
      }
    },
    sections: [
      {
        id: 'top',
        components: [
          {
            id: 'opportunity-card',
            type: 'compositeCard',
            layout: { span: 4 },
            props: {
              title: '机会点概况',
              dividers: true,
              components: [
                {
                  id: 'opportunity-total',
                  type: 'metricCard',
                  layout: { span: 12 },
                  data: { main: 'tiers' },
                  props: { rows: [{ label: '机会点数', valueField: 'count' }] }
                },
                {
                  id: 'opportunity-pie',
                  type: 'pieChart',
                  layout: { span: 6 },
                  data: { main: 'tiers' },
                  props: { categoryField: 'tier', valueField: 'count', ring: '60%' }
                },
                {
                  id: 'opportunity-breakdown',
                  type: 'categoryBreakdown',
                  layout: { span: 6 },
                  data: { main: 'tiers' },
                  props: {
                    categoryLabel: '分层',
                    categoryField: 'tier',
                    swatches: true,
                    columns: [
                      { label: '机会点数', field: 'count' },
                      { label: '预签金额', field: { data: 'main', field: 'amount', format: 'cny-adaptive' } }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  });
}

const card = (page: any) => page.sections[0].components[0];
const children = (page: any) => card(page).props.components;

function messagesAt(page: any, path: string): string[] {
  return validate(page)
    .filter((error) => error.path === path)
    .map((error) => error.message);
}

describe('组合卡', () => {
  it('接受一张装了指标卡、饼图与分类明细的卡，并进入组件目录', () => {
    const parsed = parsePage(cardPage());
    expect(parsed.errors).toEqual([]);
    expect(parsed.ok).toBe(true);

    const entry = componentCatalogEntry('compositeCard');
    expect(entry.label).toBe('组合卡');
    expect(entry.requiredProps).toContain('components[].type');
    expect(componentCatalogEntry('categoryBreakdown').requiredProps).toEqual([
      'categoryField',
      'columns[].label',
      'columns[].field'
    ]);
  });

  it('只接受受控的标题图标，不接受任意资源路径', () => {
    const page = cardPage();
    page.schemaVersion = '5.3';
    card(page).props.titleIcon = 'opportunity';
    expect(parsePage(page).errors).toEqual([]);

    card(page).props.titleIcon = '/assets/custom.svg';
    expect(parsePage(page).errors.some((error) => error.path.endsWith('/props/titleIcon'))).toBe(true);
  });

  it('子组件白名单外的类型被拒绝，并说出白名单', () => {
    const page = cardPage();
    children(page)[0] = {
      id: 'inner-table',
      type: 'table',
      layout: { span: 12 },
      data: { main: 'tiers' },
      props: { columns: [{ field: 'tier' }] }
    };
    expect(messagesAt(page, '/sections/0/components/0/props/components/0')).toEqual([
      '组合卡子组件不在白名单内:table；当前只准入 metricCard / pieChart / gauge / keyValuePanel / categoryBreakdown'
    ]);
  });

  it('卡内不得再嵌套组合卡或 Tab 容器', () => {
    for (const type of ['compositeCard', 'tabContainer']) {
      const page = cardPage();
      children(page)[0] = { id: 'inner-container', type, layout: { span: 12 }, props: {} };
      expect(messagesAt(page, '/sections/0/components/0/props/components/0')).toEqual([
        `组合卡内不得再嵌套容器组件:${type}；页面树最深到「分区 → 组合卡 → 组件」三层`
      ]);
    }
  });

  it('至少要有一个子组件', () => {
    const page = cardPage();
    card(page).props.components = [];
    expect(messagesAt(page, '/sections/0/components/0/props/components')).toEqual([
      '组合卡至少要有一个子组件'
    ]);
  });

  it('纯容器不得声明 data 或 actions', () => {
    const page = cardPage();
    card(page).data = { main: 'tiers' };
    card(page).props.actions = [{ writeFilter: 'x', field: 'tier' }];
    expect(messagesAt(page, '/sections/0/components/0/data')).toEqual([
      '组合卡是纯容器，自己不承载数据，不得声明 data；数据由子组件各自声明'
    ]);
    expect(messagesAt(page, '/sections/0/components/0/props/actions')).toEqual([
      '组合卡是纯容器，不承载交互，不得声明 actions；卡里哪个数字可点由那个数字所属的子组件自己声明'
    ]);
  });

  it('卡内禁止叠放层：layer 是分区内的层次，卡内没有分区可铺满', () => {
    const page = cardPage();
    children(page)[0].layout.layer = 'backdrop';
    expect(
      messagesAt(page, '/sections/0/components/0/props/components/0/layout/layer')
    ).toEqual(['layout.layer 只能声明在内容分区的顶层组件上']);
  });

  it('子组件 id 与顶层组件一起判重', () => {
    const page = cardPage();
    children(page)[1].id = 'opportunity-total';
    expect(
      messagesAt(page, '/sections/0/components/0/props/components/1/id')
    ).toEqual(['component id 重复:opportunity-total']);
  });

  it('卡内子组件的数据槽与字段绑定照常判定', () => {
    const page = cardPage();
    children(page)[0].props.rows[0].valueField = 'tier';
    expect(
      messagesAt(page, '/sections/0/components/0/props/components/0/props/rows/0/valueField')
    ).toEqual(['字段 tier 的 role 为 dimension，此处要求 measure']);
  });

  it('组合卡是 5.2 能力，声明 5.1 的文档使用它即触发能力下限', () => {
    const page = cardPage();
    page.schemaVersion = '5.1';
    expect(validate(page)).toContainEqual(
      expect.objectContaining({ path: '/sections/0/components/0' })
    );
  });
});

describe('分类明细', () => {
  it('类别列必须是 dimension，度量列必须是 measure', () => {
    const page = cardPage();
    const breakdown = children(page)[2];
    breakdown.props.categoryField = 'count';
    breakdown.props.columns[0].field = 'tier';
    const base = '/sections/0/components/0/props/components/2/props';
    expect(messagesAt(page, `${base}/categoryField`)).toEqual([
      '字段 count 的 role 为 measure，此处要求 dimension'
    ]);
    expect(messagesAt(page, `${base}/columns/0/field`)).toEqual([
      '字段 tier 的 role 为 dimension，此处要求 measure'
    ]);
  });

  it('同色同序：开了色点就必须与同页某个饼图绑同一个类别字段', () => {
    const page = cardPage();
    // 饼图改绑另一批类别取值，色点便没有可同色的扇区。
    page.dataSources.other = structuredClone(page.dataSources.tiers);
    children(page)[1].data = { main: 'other' };
    expect(
      messagesAt(page, '/sections/0/components/0/props/components/2/props/swatches')
    ).toEqual([
      '色点按类别取值取色，要求同页有饼图绑定同一个类别字段:tiers.tier 没有配对的饼图；不需要与扇区同色时去掉 swatches'
    ]);
  });

  it('不开色点时不要求配对饼图', () => {
    const page = cardPage();
    children(page).splice(1, 1);
    children(page)[1].props.swatches = false;
    expect(validate(page)).toEqual([]);
  });

  it('类别列列头三种表达各自成立：不写、文本、false', () => {
    const withoutLabel = cardPage();
    delete children(withoutLabel)[2].props.categoryLabel;
    expect(validate(withoutLabel)).toEqual([]);

    // 文本档由 cardPage 本身承载（categoryLabel: '分层'）。
    expect(validate(cardPage())).toEqual([]);

    const withoutHeader = cardPage();
    children(withoutHeader)[2].props.categoryLabel = false;
    expect(validate(withoutHeader)).toEqual([]);
  });

  it('列头不接受字符串哨兵：空串与 true 都不是「不要列头」的写法', () => {
    const base = '/sections/0/components/0/props/components/2/props/categoryLabel';
    for (const value of ['', true]) {
      const page = cardPage();
      children(page)[2].props.categoryLabel = value;
      expect(validate(page)).toContainEqual(
        expect.objectContaining({ path: base })
      );
    }
  });

  /*
   * 「这一列不要列头」是既有能力的表达面扩展,不单独登记为能力:它只能出现在
   * 分类明细上,而分类明细本身就是 5.2 能力,任何用到它的文档所需的最低次版本
   * 已经是 2。单独登记一条永远不会独立生效的能力只会让能力表变长。
   */
  it('列头表达面不是新能力：用了 false 的文档所需最低次版本仍是分类明细那一档', () => {
    const page = cardPage();
    children(page)[2].props.categoryLabel = false;
    expect(requiredMinorVersion(page)).toBe(
      versionPolicy.capabilities['category-breakdown-component']
    );
  });

  it('同色同序按「同数据源同字段」判定，换一个同名字段的数据源不算配对', () => {
    const page = cardPage();
    page.dataSources.other = structuredClone(page.dataSources.tiers);
    children(page)[2].data = { main: 'other' };
    expect(
      messagesAt(page, '/sections/0/components/0/props/components/2/props/swatches')
    ).toEqual([
      '色点按类别取值取色，要求同页有饼图绑定同一个类别字段:other.tier 没有配对的饼图；不需要与扇区同色时去掉 swatches'
    ]);
  });
});

describe('地图图例与 tooltip 扩展字段', () => {
  function mapPage(): any {
    return structuredClone({
      schemaVersion: '5.2',
      id: 'map-probe',
      dataSources: {
        regions: {
          fields: {
            name: { type: 'string', role: 'dimension', label: '地区部' },
            rate: { type: 'number', role: 'measure', label: '管道支持率' },
            count: { type: 'number', role: 'measure', label: '机会点数' }
          },
          source: { type: 'inline', rows: [{ name: '中国', rate: 72.4, count: 18 }] }
        }
      },
      sections: [
        {
          id: 'board',
          components: [
            {
              id: 'map',
              type: 'mapChart',
              layout: { span: 12 },
              data: { main: 'regions' },
              props: {
                nameField: 'name',
                valueField: 'rate',
                map: 'china',
                legend: {
                  title: '管道支持率',
                  bands: [
                    { label: '0', from: 0 },
                    { label: '1%~50%', from: 1 },
                    { label: '51%~80%', from: 51 },
                    { label: '80%以上', from: 81 }
                  ]
                },
                tooltipFields: [{ label: '机会点数', field: 'count' }]
              }
            }
          ]
        }
      ]
    });
  }

  it('接受「标题 + 四档」图例与 tooltip 扩展字段', () => {
    expect(validate(mapPage())).toEqual([]);
  });

  it('档位下界必须严格递增', () => {
    const page = mapPage();
    page.sections[0].components[0].props.legend.bands[2].from = 1;
    expect(messagesAt(page, '/sections/0/components/0/props/legend/bands/2/from')).toEqual([
      '图例档位下界必须严格递增:第 3 档 1 不大于第 2 档 1'
    ]);
  });

  it('tooltip 扩展字段必须引用本组件数据槽里的字段', () => {
    const page = mapPage();
    page.sections[0].components[0].props.tooltipFields[0].field = 'missing';
    expect(
      messagesAt(page, '/sections/0/components/0/props/tooltipFields/0/field')
    ).toEqual(['字段 missing 不在数据槽 main 的数据源 regions 中']);
  });

  it('地域摘要按稳定维度值匹配，且所有绑定都经过字段契约校验', () => {
    const page = mapPage();
    page.schemaVersion = '5.3';
    page.sections[0].components[0].props.variant = 'regionalOverview';
    page.sections[0].components[0].props.pinnedSummary = {
      matchField: 'name',
      matchValue: '中国',
      titleField: 'name',
      fields: [{ label: '管道支持率', field: 'rate' }]
    };
    expect(validate(page)).toEqual([]);

    page.sections[0].components[0].props.pinnedSummary.fields[0].field = 'missing';
    expect(
      messagesAt(page, '/sections/0/components/0/props/pinnedSummary/fields/0/field')
    ).toEqual(['字段 missing 不在数据槽 main 的数据源 regions 中']);
  });

  it('地域摘要只属于 regionalOverview，匹配值类型与字段标签必须有效', () => {
    const page = mapPage();
    page.schemaVersion = '5.3';
    page.sections[0].components[0].props.pinnedSummary = {
      matchField: 'name',
      matchValue: '中国',
      titleField: 'name',
      fields: [
        { label: '管道支持率', field: 'rate' },
        { label: '管道支持率', field: 'amount' }
      ]
    };
    expect(
      messagesAt(page, '/sections/0/components/0/props/pinnedSummary')
    ).toEqual(['pinnedSummary 只能用于 variant: regionalOverview 的地图']);
    expect(
      messagesAt(page, '/sections/0/components/0/props/pinnedSummary/fields/1/label')
    ).toEqual(['地域摘要字段标签重复:管道支持率']);

    page.sections[0].components[0].props.variant = 'regionalOverview';
    page.sections[0].components[0].props.pinnedSummary.matchValue = 42;
    expect(
      messagesAt(page, '/sections/0/components/0/props/pinnedSummary/matchValue')
    ).toEqual(['匹配值不符合字段 name 的类型 string']);
  });

});

describe('同批的字段级增量', () => {
  function panelPage(columns: unknown): any {
    return structuredClone({
      schemaVersion: '5.2',
      id: 'panel-probe',
      dataSources: {
        detail: {
          fields: { owner: { type: 'string', role: 'dimension', label: '责任人' } },
          source: { type: 'inline', rows: [{ owner: '张三' }] }
        }
      },
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'basics',
              type: 'keyValuePanel',
              layout: { span: 3 },
              data: { main: 'detail' },
              props: { columns, items: [{ label: '责任人', field: 'owner' }] }
            }
          ]
        }
      ]
    });
  }

  it('keyValuePanel 的列数闭集接受 1，仍拒绝闭集外的取值', () => {
    expect(validate(panelPage(1))).toEqual([]);
    expect(validate(panelPage(5))).toContainEqual(
      expect.objectContaining({ path: '/sections/0/components/0/props/columns' })
    );
  });

  function ratioPage(scale: unknown): any {
    const page: any = {
      schemaVersion: '5.2',
      id: 'ratio-probe',
      dataSources: {
        pipeline: {
          fields: {
            won: { type: 'number', role: 'measure', label: '赢单' },
            total: { type: 'number', role: 'measure', label: '总数' },
            rate: { type: 'number', role: 'measure', label: '赢单率' }
          },
          compute: [
            {
              op: 'ratio',
              numerator: 'won',
              denominator: 'total',
              output: 'rate',
              onZeroDenominator: 'null'
            }
          ],
          source: { type: 'inline', rows: [{ won: 3, total: 12 }] }
        }
      },
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'rate-card',
              type: 'metricCard',
              layout: { span: 3 },
              data: { main: 'pipeline' },
              props: { rows: [{ label: '赢单率', valueField: 'rate' }] }
            }
          ]
        }
      ]
    };
    if (scale !== undefined) page.dataSources.pipeline.compute[0].scale = scale;
    return structuredClone(page);
  }

  it('ratio 的 scale 是只有 100 的闭集，开放数值等于在算子里引入乘法表达式', () => {
    expect(validate(ratioPage(undefined))).toEqual([]);
    expect(validate(ratioPage(100))).toEqual([]);
    expect(validate(ratioPage(1000))).toContainEqual(
      expect.objectContaining({ path: '/dataSources/pipeline/compute/0/scale' })
    );
  });
});
