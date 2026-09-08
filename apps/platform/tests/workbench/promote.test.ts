import { describe, expect, it } from 'vitest';
import { validate, versionPolicy } from '@metriccanvas/page';
import {
  adHocDefinitionsOf, DATA_APP_ROLLING_TIME_LIMITATION, isPlaceholderPageId,
  pageIdConfirmationPayload, promoteToDataApp, promoteToReport, type FormulaTrace
} from '../../src/lib/workbench/promote';
import fixtureDocuments from './fixtures/promote-cases.json';
const fixtures: Record<string, unknown>[] = fixtureDocuments;
const TRANSIENT_ID = 'ask-transient-8f2c3a1b';
const CAPTURED_AT = '2026-08-12T00:00:00+08:00';
const formulaTraces: FormulaTrace[] = [
  {
    question: '平均每单成交多少钱?',
    expression: '成交总额 / 订单数',
    referencedMetrics: ['成交总额', '订单数']
  }
];

/** 纯静态临时页面态:inline 数据源本就随修订静态保存。 */
const inlineTransientPage: Record<string, unknown> = {
  schemaVersion: versionPolicy.current,
  id: TRANSIENT_ID,
  dataSources: {
    summary: {
      fields: {
        revenue: {
          type: 'number',
          role: 'measure',
          label: '收入',
          unit: '元',
          nullable: false
        }
      },
      source: { type: 'inline', rows: [{ revenue: 128600 }] }
    }
  },
  sections: [
    {
      id: 'overview',
      components: [
        {
          id: 'revenue-card',
          type: 'metricCard',
          layout: { span: 4 },
          data: { main: 'summary' },
          props: { rows: [{ label: '收入', valueField: 'revenue' }] }
        }
      ]
    }
  ]
};

describe('沉淀为 Data App:换正式页面 id,其余原样保留', () => {
  const cases: Array<{ name: string; document: Record<string, unknown> }> = [
    {
      name: '单查询数据源',
      document: structuredClone(fixtures[0])
    },
    {
      name: '多查询数据源',
      document: structuredClone(fixtures[1])
    },
    {
      name: '声明筛选器与筛选绑定的页面(Data App 方向原样保留)',
      document: structuredClone(fixtures[2])
    },
    { name: '纯静态 inline 页面', document: inlineTransientPage }
  ];

  it.each(cases)('$name:产物过 validate 零错误且无临时 id 痕迹', ({ document }) => {
    const result = promoteToDataApp({ document, pageId: 'region-gmv-overview' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validate(result.document)).toEqual([]);
    expect(result.document.id).toBe('region-gmv-overview');
    expect(JSON.stringify(result.document)).not.toContain(TRANSIENT_ID);
    expect(JSON.stringify(result.document)).not.toContain('ask-transient');
    // 除页面 id 外逐字节一致:沉淀不夹带任何其他改写。
    expect({ ...result.document, id: TRANSIENT_ID }).toEqual(document);
  });

  it.each(cases)('$name:显式返回缺少滚动时间语义的已知限制', ({ document }) => {
    const result = promoteToDataApp({ document, pageId: 'region-gmv-overview' });
    expect(result.ok && result.knownLimitations).toEqual([
      DATA_APP_ROLLING_TIME_LIMITATION
    ]);
  });

  it('改写是纯函数:输入文档不被改动,同一输入产物逐字节一致', () => {
    const document = structuredClone(fixtures[2]);
    const before = JSON.stringify(document);
    const first = promoteToDataApp({ document, pageId: 'region-gmv-overview' });
    expect(JSON.stringify(document)).toBe(before);
    expect(JSON.stringify(first)).toBe(
      JSON.stringify(promoteToDataApp({ document, pageId: 'region-gmv-overview' }))
    );
  });
});

describe('沉淀为 Data App:临时指标设闸(ADR-0036)', () => {
  const document = structuredClone(fixtures[3]);

  it('含临时指标且未获用户接受时拒绝,并列出口径清单', () => {
    const result = promoteToDataApp({ document, pageId: 'avg-ticket-app' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'AD_HOC_DEFINITIONS_NOT_ACCEPTED',
        adHocDefinitions: [
          {
            dataSourceId: 'avg-ticket',
            alias: '客单价',
            expression: '成交总额 / 订单数',
            question: null
          }
        ]
      })
    ]);
    expect(result.issues[0]?.message).toContain('显式接受');
  });

  it('用户显式接受后放行,口径清单携带留痕的问题原文', () => {
    const result = promoteToDataApp({
      document,
      pageId: 'avg-ticket-app',
      acceptAdHocDefinitions: true,
      formulaTraces
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validate(result.document)).toEqual([]);
    expect(result.adHocDefinitions).toEqual([
      {
        dataSourceId: 'avg-ticket',
        alias: '客单价',
        expression: '成交总额 / 订单数',
        question: '平均每单成交多少钱?'
      }
    ]);
  });

  it('不含临时指标的页面无需接受动作', () => {
    const clean = structuredClone(fixtures[4]);
    const result = promoteToDataApp({ document: clean, pageId: 'region-app' });
    expect(result.ok && result.adHocDefinitions).toEqual([]);
  });
});

describe('沉淀为报告:保留查询定义与内嵌初始行,去掉筛选绑定', () => {
  it('筛选绑定全部移除,查询定义与采集时点的初始行逐字节保留', () => {
    const document = structuredClone(fixtures[2]);
    const result = promoteToReport({ document, pageId: 'region-gmv-report' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(validate(result.document)).toEqual([]);
    expect(result.document.id).toBe('region-gmv-report');
    expect(JSON.stringify(result.document)).not.toContain('ask-transient');
    expect(JSON.stringify(result.document)).not.toContain('filterBindings');

    const source = (result.document.dataSources as Record<string, never>)['region-gmv'] as {
      fields: unknown;
      source: { type: string; initial: unknown; query: Record<string, unknown> };
    };
    const original = fixtureDocuments[2]!.dataSources['region-gmv']!;
    // 查询定义保留(口径溯源),仅少了 filterBindings;初始行冻结在采集时点。
    expect(source.source.query).toEqual({
      language: 'dqe',
      body: original.source.query.body
    });
    expect(source.source.initial).toEqual(original.source.initial);
    expect(source.fields).toEqual(original.fields);
    expect(result.frozenAt).toEqual([
      { dataSourceId: 'region-gmv', capturedAt: CAPTURED_AT }
    ]);
    // 不引入新的数据源类型或渲染路径:仍是既有 query + 内嵌初始行机制。
    expect(source.source.type).toBe('query');
  });

  const okCases: Array<{ name: string; document: Record<string, unknown> }> = [
    {
      name: '无筛选绑定的查询页面(改写幂等)',
      document: structuredClone(fixtures[4])
    },
    {
      name: '含临时指标的查询页面(报告保留口径溯源,不设闸)',
      document: structuredClone(fixtures[3])
    },
    { name: '纯静态 inline 页面(原样保留)', document: inlineTransientPage }
  ];

  it.each(okCases)('$name:产物过 validate 零错误', ({ document }) => {
    const result = promoteToReport({ document, pageId: 'frozen-report' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validate(result.document)).toEqual([]);
    expect(result.document.id).toBe('frozen-report');
    expect(JSON.stringify(result.document)).not.toContain(TRANSIENT_ID);
  });

  it('查询数据源缺少内嵌初始行时拒绝:默认状态会重新查询,无从冻结', () => {
    const document = structuredClone(fixtures[5]);
    const result = promoteToReport({ document, pageId: 'broken-report' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'REPORT_INITIAL_ROWS_MISSING',
        dataSourceId: 'region-gmv-live'
      })
    ]);
  });

  it('改写是纯函数:输入文档不被改动,同一输入产物逐字节一致', () => {
    const document = structuredClone(fixtures[2]);
    const before = JSON.stringify(document);
    const first = promoteToReport({ document, pageId: 'region-gmv-report' });
    expect(JSON.stringify(document)).toBe(before);
    expect(JSON.stringify(first)).toBe(
      JSON.stringify(promoteToReport({ document, pageId: 'region-gmv-report' }))
    );
  });
});

describe('正式页面 id 的确认与校验(复用 confirm_page_id 机制的判定)', () => {
  const document = structuredClone(fixtures[4]);
  const promoteBoth = (pageId: string) => [
    promoteToDataApp({ document, pageId }),
    promoteToReport({ document, pageId })
  ];

  it.each([
    { pageId: '__page_id__' },
    { pageId: '<page-id>' },
    { pageId: 'TODO' },
    { pageId: '待确认' }
  ])('占位符 id 两个方向都拒绝:$pageId', ({ pageId }) => {
    expect(isPlaceholderPageId(pageId)).toBe(true);
    for (const result of promoteBoth(pageId)) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.issues[0]?.code).toBe('PAGE_ID_PLACEHOLDER');
    }
  });

  it('目标 id 与临时页面 id 相同两个方向都拒绝', () => {
    for (const result of promoteBoth(TRANSIENT_ID)) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.issues[0]?.code).toBe('PAGE_ID_UNCHANGED');
    }
  });

  it('不符合页面 id 规范的目标 id 由出口 validate 拒绝', () => {
    for (const result of promoteBoth('Region-GMV')) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.issues[0]?.code).toBe('PAGE_VALIDATION_FAILED');
      expect(result.issues[0]?.errors?.some((error) => error.path === '/id')).toBe(true);
    }
  });

  it('确认载荷与 confirm_page_id 交互同源:稳定路径与不可变更事实', () => {
    const promoted = promoteToDataApp({ document, pageId: 'region-gmv-overview' });
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    expect(pageIdConfirmationPayload(promoted.document, 'region-gmv-overview')).toEqual({
      pageId: 'region-gmv-overview',
      title: 'region-gmv-overview',
      stablePath: '/pages/region-gmv-overview',
      immutableAfterSave: true,
      schemaVersion: versionPolicy.current
    });
  });
});

describe('临时指标扫描:文档是唯一真源,留痕只补充问题原文', () => {
  it('跨数据源扫描 formula 项;指标名字符串不是临时指标', () => {
    const document = structuredClone(fixtures[6]);
    expect(adHocDefinitionsOf(document)).toEqual([
      {
        dataSourceId: 'avg-ticket',
        alias: '客单价',
        expression: '成交总额 / 订单数',
        question: null
      }
    ]);
    expect(adHocDefinitionsOf(document, formulaTraces)[0]?.question).toBe(
      '平均每单成交多少钱?'
    );
  });

  it('inline 页面没有查询体,不产生临时指标', () => {
    expect(adHocDefinitionsOf(inlineTransientPage)).toEqual([]);
  });
});
