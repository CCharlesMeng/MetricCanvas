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
  type AssembleTransientPageInput,
  type ExecutedDataRequestUnit
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
  it('多取数单元装配:组件按意图选择,宽度取目录 defaultSpan,分区用 container 表达外观', () => {
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
    for (const component of components) {
      expect(component.layout.span).toBe(
        componentCatalogEntry(component.type).defaultSpan
      );
    }
    expect(components.map((component) => component.data.main)).toEqual([
      'gmv-summary',
      'monthly-gmv',
      'region-gmv'
    ]);
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
