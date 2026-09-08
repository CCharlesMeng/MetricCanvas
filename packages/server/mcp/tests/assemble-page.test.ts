import { describe, expect, it } from 'vitest';
import {
  componentCatalogEntry,
  validate,
  versionPolicy,
  type DqeQueryDefinition,
  type FilterDeclaration
} from '@metriccanvas/page';
import {
  assembleTransientPage,
  resultShapeOfUnit,
  scopeGroupsOfUnits,
  type AssembleTransientPageInput,
  type DataRequestUnitScope,
  type ExecutedDataRequestUnit,
  type TransientPageDocument
} from '../src';

function dqeQuery(
  outputDims: string[],
  outputMetrics: string[],
  filterBindings?: DqeQueryDefinition['filterBindings']
): DqeQueryDefinition {
  return {
    language: 'dqe',
    body: {
      dsl_list: [
        {
          output_dims: outputDims,
          output_metrics: outputMetrics,
          filter: { dims: [], metrics: [] },
          order: {}
        }
      ]
    },
    ...(filterBindings === undefined ? {} : { filterBindings })
  };
}

const gmvField = {
  queryField: '成交总额',
  type: 'number',
  role: 'measure',
  label: '成交总额',
  unit: '元',
  nullable: false
} as const;

/** 单行汇总:0 维度 2 度量,总结意图。 */
const gmvSummaryUnit: ExecutedDataRequestUnit = {
  dataSourceId: 'gmv-summary',
  title: '成交总额概览',
  fields: {
    gmv: gmvField,
    orderCount: {
      queryField: '订单数',
      type: 'number',
      role: 'measure',
      label: '订单数',
      nullable: false
    }
  },
  query: dqeQuery([], ['成交总额', '订单数']),
  initial: {
    capturedAt: '2026-08-12T00:00:00+08:00',
    rows: [{ 成交总额: 1286000, 订单数: 320 }],
    totalCount: 1
  },
  intent: 'summary'
};

/** 时间维度 + 度量,趋势意图。 */
const monthlyGmvUnit: ExecutedDataRequestUnit = {
  dataSourceId: 'monthly-gmv',
  title: '月度成交总额趋势',
  fields: {
    month: {
      queryField: '月份',
      type: 'date',
      role: 'dimension',
      label: '月份',
      nullable: false
    },
    gmv: gmvField
  },
  query: dqeQuery(['月份'], ['成交总额']),
  initial: {
    capturedAt: '2026-08-12T00:00:00+08:00',
    rows: [
      { 月份: '2026-03-01', 成交总额: 980000 },
      { 月份: '2026-04-01', 成交总额: 1020000 },
      { 月份: '2026-05-01', 成交总额: 1110000 },
      { 月份: '2026-06-01', 成交总额: 1054000 },
      { 月份: '2026-07-01', 成交总额: 1207000 },
      { 月份: '2026-08-01', 成交总额: 1286000 }
    ],
    totalCount: 6
  },
  intent: 'trend'
};

/** 类别维度 + 度量,对比意图。 */
const regionGmvUnit: ExecutedDataRequestUnit = {
  dataSourceId: 'region-gmv',
  title: '区域成交对比',
  fields: {
    region: {
      queryField: '区域',
      type: 'string',
      role: 'dimension',
      label: '区域',
      nullable: false
    },
    gmv: gmvField
  },
  query: dqeQuery(['区域'], ['成交总额']),
  initial: {
    capturedAt: '2026-08-12T00:00:00+08:00',
    rows: [
      { 区域: '华东', 成交总额: 520000 },
      { 区域: '华北', 成交总额: 430000 },
      { 区域: '华南', 成交总额: 336000 }
    ],
    totalCount: 3
  },
  intent: 'comparison'
};

/** 未带内嵌初始行的取数单元:行数未知。 */
const noInitialRegionUnit: ExecutedDataRequestUnit = {
  dataSourceId: 'region-gmv-live',
  title: '区域成交(实时)',
  fields: regionGmvUnit.fields,
  query: dqeQuery(['区域'], ['成交总额']),
  intent: 'comparison'
};

function assembled(input: AssembleTransientPageInput) {
  const result = assembleTransientPage(input);
  if (!result.ok) {
    throw new Error(`装配失败:${JSON.stringify(result.issues)}`);
  }
  return result.document;
}

/** 分区里绑定了页面数据源的组件;页头不绑数据源,不参与数据源断言。 */
function boundDataSources(
  section: TransientPageDocument['sections'][number]
): string[] {
  return section.components.flatMap((component) =>
    'data' in component ? [component.data.main] : []
  );
}

/** 承载取数单元的内容分区;页面级页头分区不在其中。 */
function contentSections(
  document: TransientPageDocument
): TransientPageDocument['sections'] {
  return document.sections.filter((section) => section.id !== 'header');
}

describe('临时页面态装配:结果形状推导', () => {
  it('由结果字段契约与内嵌初始行推导,不读样例值语义', () => {
    expect(resultShapeOfUnit(monthlyGmvUnit)).toEqual({
      dimensionCount: 1,
      measureCount: 1,
      rowCount: 6,
      hasTimeDimension: true
    });
    expect(resultShapeOfUnit(noInitialRegionUnit)).toEqual({
      dimensionCount: 1,
      measureCount: 1,
      hasTimeDimension: false
    });
  });
});

describe('临时页面态装配:产出 5.0 页面文档并通过 validate', () => {
  it('多取数单元装配:组件按意图选择,宽度按分区装箱铺满,分区用 container 表达外观', () => {
    const document = assembled({
      pageId: 'ask-transient-demo',
      description: '问数产生的临时页面态',
      units: [gmvSummaryUnit, monthlyGmvUnit, regionGmvUnit],
      sectionTitle: '问数结果',
      container: 'panel'
    });

    expect(validate(document)).toEqual([]);
    expect(document.schemaVersion).toBe(versionPolicy.current);
    expect(document.id).toBe('ask-transient-demo');
    expect(Object.keys(document.dataSources)).toEqual([
      'gmv-summary',
      'monthly-gmv',
      'region-gmv'
    ]);

    // 单元未声明口径,页头无从派生,页面只有内容分区。
    const section = document.sections[0]!;
    expect(section.container).toBe('panel');
    expect('variant' in section).toBe(false);
    expect('layout' in section).toBe(false);

    const components = section.components;
    expect(components.map((component) => component.type)).toEqual([
      'metricCard',
      'lineChart',
      'barChart'
    ]);
    // 比例基线 3 + 8 一行装得下、缩放到 3 + 9;柱状图换行后独占整行。
    expect(components.map((component) => component.layout.span)).toEqual([3, 9, 12]);
    expect(boundDataSources(section)).toEqual([
      'gmv-summary',
      'monthly-gmv',
      'region-gmv'
    ]);
  });

  it('页头由口径派生:业务域作标题,全页共用的时间窗口作数据窗口', () => {
    const document = assembled({
      pageId: 'ask-transient-header',
      description: '2026 年上半年销售分析月报',
      units: [
        withScope(gmvSummaryUnit, { groupBy: [] }),
        withScope(regionGmvUnit, { groupBy: ['区域'] })
      ],
      container: 'panel'
    });
    expect(validate(document)).toEqual([]);
    expect(document.sections[0]).toEqual({
      id: 'header',
      container: 'plain',
      components: [
        {
          id: 'page-header',
          type: 'reportHeader',
          layout: { span: 12 },
          props: {
            title: '销售分析',
            asOf: { label: '数据窗口', value: '2026-01-01 ~ 2026-06-30(月)' }
          }
        }
      ]
    });
    expect(document.sections.slice(1).map((section) => section.title)).toEqual([
      '总量',
      '按区域'
    ]);
  });

  /**
   * 页头不用问题原文:部分可答时问句里含缺口指标(ADR-0036),拿它作标题
   * 等于让页面承诺自己没有的数字。
   */
  it('页头不重复页面说明,页面说明只进 meta.description', () => {
    const document = assembled({
      pageId: 'ask-transient-header-not-question',
      description: '最近半年的成交总额和 NPS 走势?',
      units: [withScope(regionGmvUnit, { groupBy: ['区域'] })],
      container: 'panel'
    });
    expect(JSON.stringify(document.sections)).not.toContain('NPS');
    expect(document.meta?.description).toBe('最近半年的成交总额和 NPS 走势?');
  });

  it('任一单元未声明口径时不产出页头:页头内容全部由口径派生', () => {
    const document = assembled({
      pageId: 'ask-transient-no-header',
      description: '问数产生的临时页面态',
      units: [regionGmvUnit],
      container: 'panel'
    });
    expect(document.sections.map((section) => section.id)).toEqual(['main']);
  });

  it('各口径组时间窗口不同时页头不写数据窗口', () => {
    const document = assembled({
      pageId: 'ask-transient-header-mixed-time',
      units: [
        withScope(regionGmvUnit, { groupBy: ['区域'] }),
        withScope(
          { ...noInitialRegionUnit, initial: regionGmvUnit.initial },
          { groupBy: ['区域'], timeRange: '2025-01-01 ~ 2025-06-30' }
        )
      ],
      container: 'panel'
    });
    expect(document.sections[0]!.components[0]!.props).toEqual({ title: '销售分析' });
  });

  const validCases: Array<{ name: string; input: AssembleTransientPageInput }> = [
    {
      name: '单取数单元:汇总指标卡',
      input: { pageId: 'ask-kpi-only', units: [gmvSummaryUnit] }
    },
    {
      name: '单取数单元:趋势折线图',
      input: { pageId: 'ask-trend-only', units: [monthlyGmvUnit] }
    },
    {
      name: '单取数单元:对比柱状图,分区容器 card',
      input: { pageId: 'ask-region-only', units: [regionGmvUnit], container: 'card' }
    },
    {
      name: '无内嵌初始行的取数单元',
      input: { pageId: 'ask-live-region', units: [noInitialRegionUnit] }
    },
    {
      name: '钉住明细表',
      input: {
        pageId: 'ask-pinned-table',
        units: [{ ...regionGmvUnit, pinnedComponent: 'table' }]
      }
    },
    {
      name: '声明筛选器并保留查询定义自带的筛选绑定',
      input: {
        pageId: 'ask-with-filter',
        filters: [
          { id: 'region-filter', type: 'dimension', dimension: 'region', label: '区域' }
        ] satisfies FilterDeclaration[],
        units: [
          {
            ...regionGmvUnit,
            query: dqeQuery(['区域'], ['成交总额'], {
              'region-filter': { target: 'dimension', queryField: '区域' }
            })
          }
        ]
      }
    }
  ];

  it.each(validCases)('装配产物通过 validate 零错误:$name', ({ input }) => {
    const result = assembleTransientPage(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(validate(result.document)).toEqual([]);
  });

  it('装配是确定性的:同一输入产出逐字节一致的文档', () => {
    const input: AssembleTransientPageInput = {
      pageId: 'ask-deterministic',
      units: [gmvSummaryUnit, monthlyGmvUnit],
      container: 'plain'
    };
    expect(JSON.stringify(assembleTransientPage(input))).toBe(
      JSON.stringify(assembleTransientPage(input))
    );
  });

  it('文档只包含输入声明的筛选器,不产生隐式引用', () => {
    const noFilterDocument = assembled({
      pageId: 'ask-no-filter',
      units: [regionGmvUnit]
    });
    expect(noFilterDocument.filters).toBeUndefined();

    const filters: FilterDeclaration[] = [
      { id: 'region-filter', type: 'dimension', dimension: 'region' }
    ];
    const document = assembled({
      pageId: 'ask-filter-echo',
      filters,
      units: [
        {
          ...regionGmvUnit,
          query: dqeQuery(['区域'], ['成交总额'], {
            'region-filter': { target: 'dimension', queryField: '区域' }
          })
        }
      ]
    });
    expect(document.filters).toEqual(filters);
  });
});

/** 给取数单元挂上口径;未指定的要素取同一份缺省,便于只让一项不同。 */
function withScope(
  unit: ExecutedDataRequestUnit,
  scope: Partial<DataRequestUnitScope> & Pick<DataRequestUnitScope, 'groupBy'>
): ExecutedDataRequestUnit {
  return {
    ...unit,
    scope: {
      businessDomain: '销售分析',
      timeRange: '2026-01-01 ~ 2026-06-30',
      granularity: 'month',
      filters: [],
      ...scope
    }
  };
}

describe('临时页面态装配:口径组作为分区边界(ADR-0055)', () => {
  it('口径一致的页面仍是单个分区,标题用调用方给的 sectionTitle', () => {
    const document = assembled({
      pageId: 'ask-transient-scope-one',
      units: [
        withScope(regionGmvUnit, { groupBy: ['区域'] }),
        withScope(
          { ...noInitialRegionUnit, initial: regionGmvUnit.initial },
          { groupBy: ['区域'] }
        )
      ],
      sectionTitle: '问数结果',
      container: 'panel'
    });
    const sections = contentSections(document);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ id: 'main', title: '问数结果' });
    expect(sections[0]!.components).toHaveLength(2);
  });

  it('跨口径的页面一组一个分区,标题只写各组之间真正不同的口径要素', () => {
    const document = assembled({
      pageId: 'ask-transient-scope-many',
      units: [
        withScope(gmvSummaryUnit, { groupBy: [] }),
        withScope(monthlyGmvUnit, { groupBy: ['月份'] }),
        withScope(regionGmvUnit, { groupBy: ['区域'] })
      ],
      sectionTitle: '问数结果',
      container: 'panel'
    });
    expect(validate(document)).toEqual([]);
    const sections = contentSections(document);
    // 三组共用同一业务域、同一时间窗口,标题因此只落在分组维度上。
    expect(sections.map((section) => [section.id, section.title])).toEqual([
      ['scope-1', '总量'],
      ['scope-2', '按月份'],
      ['scope-3', '按区域']
    ]);
    expect(sections.map(boundDataSources)).toEqual([
      ['gmv-summary'],
      ['monthly-gmv'],
      ['region-gmv']
    ]);
    // 每个口径组只有一个组件,装箱把它铺满整行。
    expect(
      sections.flatMap((section) =>
        section.components.map((component) => component.layout.span)
      )
    ).toEqual([12, 12, 12]);
    // 分区外观仍由 container 单一声明,逐分区一致(ADR-0038)。
    expect(sections.every((section) => section.container === 'panel')).toBe(true);
  });

  it('只有时间窗口不同时,标题写到时间与粒度上', () => {
    const document = assembled({
      pageId: 'ask-transient-scope-time',
      units: [
        withScope(regionGmvUnit, { groupBy: ['区域'] }),
        withScope(
          { ...noInitialRegionUnit, initial: regionGmvUnit.initial },
          { groupBy: ['区域'], timeRange: '2025-01-01 ~ 2025-06-30' }
        )
      ],
      container: 'panel'
    });
    expect(contentSections(document).map((section) => section.title)).toEqual([
      '按区域 · 2026-01-01 ~ 2026-06-30(月)',
      '按区域 · 2025-01-01 ~ 2025-06-30(月)'
    ]);
  });

  it('分组维度只是声明顺序不同不构成两个口径组', () => {
    const twoDimUnit: ExecutedDataRequestUnit = {
      ...regionGmvUnit,
      dataSourceId: 'region-month-gmv',
      fields: { region: regionGmvUnit.fields.region!, month: monthlyGmvUnit.fields.month!, gmv: gmvField },
      query: dqeQuery(['区域', '月份'], ['成交总额']),
      initial: {
        capturedAt: '2026-08-12T00:00:00+08:00',
        rows: [{ 区域: '华东', 月份: '2026-03-01', 成交总额: 520000 }],
        totalCount: 1
      }
    };
    const document = assembled({
      pageId: 'ask-transient-scope-order',
      units: [
        withScope(twoDimUnit, { groupBy: ['区域', '月份'] }),
        withScope(
          { ...twoDimUnit, dataSourceId: 'month-region-gmv' },
          { groupBy: ['月份', '区域'] }
        )
      ],
      sectionTitle: '问数结果',
      container: 'panel'
    });
    expect(contentSections(document)).toHaveLength(1);
  });

  it('口径组文案是完整口径:分区标题与问数回复共用这一份', () => {
    const groups = scopeGroupsOfUnits([
      withScope(gmvSummaryUnit, { groupBy: [] }),
      withScope(regionGmvUnit, { groupBy: ['区域'] }),
      withScope(
        { ...noInitialRegionUnit, initial: regionGmvUnit.initial },
        { groupBy: ['区域'], filters: [{ dimension: '渠道', values: ['直销', '分销'] }] }
      )
    ]);
    expect(groups?.map((group) => group.label)).toEqual([
      '销售分析 · 总量 · 2026-01-01 ~ 2026-06-30(月)',
      '销售分析 · 按区域 · 2026-01-01 ~ 2026-06-30(月)',
      '销售分析 · 按区域 · 2026-01-01 ~ 2026-06-30(月) · 渠道=直销、分销'
    ]);
    expect(groups?.map((group) => group.dataSourceIds)).toEqual([
      ['gmv-summary'],
      ['region-gmv'],
      ['region-gmv-live']
    ]);
    // 任一单元缺口径时不产生分组:调用方据此退回单分区。
    expect(scopeGroupsOfUnits([regionGmvUnit])).toBeNull();
  });

  it('任一单元未声明口径时整体退回单分区', () => {
    const document = assembled({
      pageId: 'ask-transient-scope-partial',
      units: [withScope(gmvSummaryUnit, { groupBy: [] }), regionGmvUnit],
      sectionTitle: '问数结果',
      container: 'panel'
    });
    expect(document.sections).toHaveLength(1);
    expect(document.sections[0]!.components).toHaveLength(2);
  });
});

describe('临时页面态装配:钉住组件不被改写', () => {
  it('钉住明细表后不被对比意图改写成柱状图', () => {
    const document = assembled({
      pageId: 'ask-pinned',
      units: [{ ...regionGmvUnit, pinnedComponent: 'table', intent: 'comparison' }]
    });
    const [component] = document.sections[0]!.components;
    expect(component?.type).toBe('table');
    expect(component?.layout.span).toBe(componentCatalogEntry('table').defaultSpan);
  });

  it('钉住组件被硬闸拒绝时装配失败而不是换组件', () => {
    const result = assembleTransientPage({
      pageId: 'ask-pinned-rejected',
      units: [{ ...gmvSummaryUnit, pinnedComponent: 'pieChart' }]
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'PINNED_COMPONENT_REJECTED',
        dataSourceId: 'gmv-summary'
      })
    ]);
    expect(result.issues[0]?.message).toContain('不得自动改写');
  });
});

describe('临时页面态装配:失败路径', () => {
  it('没有任何组件通过硬闸时装配失败并说明原因', () => {
    const semanticOnlyUnit: ExecutedDataRequestUnit = {
      dataSourceId: 'insight-note',
      fields: {
        note: { queryField: '说明', type: 'semanticHtml', role: 'detail', nullable: false }
      },
      query: dqeQuery(['说明'], [])
    };
    const result = assembleTransientPage({
      pageId: 'ask-no-candidate',
      units: [semanticOnlyUnit]
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'COMPONENT_GATE_REJECTED',
        dataSourceId: 'insight-note'
      })
    ]);
  });

  it('数据源名重复时装配失败:一个取数单元对应一个页面数据源', () => {
    const result = assembleTransientPage({
      pageId: 'ask-duplicate',
      units: [regionGmvUnit, { ...monthlyGmvUnit, dataSourceId: 'region-gmv' }]
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_DATA_SOURCE_NAME',
        dataSourceId: 'region-gmv'
      })
    ]);
  });

  it('查询定义的筛选绑定引用未声明筛选器时,出口 validate 拒绝并透传原始错误', () => {
    const result = assembleTransientPage({
      pageId: 'ask-unbound-filter',
      units: [
        {
          ...regionGmvUnit,
          query: dqeQuery(['区域'], ['成交总额'], {
            'region-filter': { target: 'dimension', queryField: '区域' }
          })
        }
      ]
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('PAGE_VALIDATION_FAILED');
    expect(
      result.issues[0]?.errors?.some((error) => error.type === 'FILTER_BINDING_ERROR')
    ).toBe(true);
  });

  it('结果字段契约与 DQE 输出不一致时,出口 validate 拒绝并透传映射错误', () => {
    const result = assembleTransientPage({
      pageId: 'ask-broken-mapping',
      units: [
        {
          ...noInitialRegionUnit,
          query: dqeQuery(['区域'], ['GMV'])
        }
      ]
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('PAGE_VALIDATION_FAILED');
    expect(
      result.issues[0]?.errors?.some((error) => error.type === 'QUERY_MAPPING_ERROR')
    ).toBe(true);
  });

  it('没有取数单元时装配失败而不是产出空分区页面', () => {
    const result = assembleTransientPage({ pageId: 'ask-empty', units: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('PAGE_VALIDATION_FAILED');
  });
});
