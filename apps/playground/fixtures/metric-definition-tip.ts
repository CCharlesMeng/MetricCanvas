import type { MetricDefinition, RuntimeDataGateway } from '@metriccanvas/engine';

export function createMetricDefinitionPreview(origin: string): RuntimeDataGateway {
  const url = new URL('/pages/metric-card-primary-detail', origin).href;
  const definitions: MetricDefinition[] = [
    { code: 'ZB0000377', name: '销售毛利率', definition: '报告期内销售毛利占销售收入的比重。', formula: '（销售收入 − 销售成本）÷ 销售收入 × 100%', manager: '经营分析组（模拟）', latestUpdateTime: '26年11月1日', url },
    {
      code: 'DEMO-REVENUE',
      name: '销售收入',
      definition: `报告期内按示例口径确认的销售收入总额，以收入确认日期为准，按页面筛选后的组织范围汇总。

统计范围包括已确认的商品及服务收入。尚未达到收入确认条件的合同金额、预收款和未交付订单不计入。

报告期内确认的退货、折让和冲销按调整金额计入。跨期调整以对应的收入确认记录为准。

同一笔业务可能有多条收入确认记录，汇总使用确认记录的金额。各组织的内部交易按示例口径抵消。

不同币种统一折算为页面展示币种。指标卡显示四舍五入后的数值，明细与汇总按原始金额计算。

选择季度或年度时，汇总所选统计期间内的记录。切换组织后，按选中的组织范围重新计算。`,
      formula: '按报告期汇总已确认销售收入',
      manager: '经营分析组（模拟）',
      latestUpdateTime: null,
      url
    },
    { code: 'DEMO-RETRY', name: '框架执行率', definition: '报告期内累计框架执行金额占约定金额的比重。', formula: '累计框架执行金额 ÷ 框架约定金额', manager: '商务运营组（模拟）', latestUpdateTime: null, url },
    { code: 'DEMO-NO-LINK', name: '闭环率', definition: '报告期内完成闭环的事项占比。', formula: '已闭环事项 ÷ 全部事项', manager: '运营组（模拟）', latestUpdateTime: null, url: null },
    ...[
      { code: 'DEMO-TOTAL-CLOSURE', name: '总闭环率', definition: '各类决策事项已闭环的比例。' },
      { code: 'DEMO-BUSINESS-DECISION-CLOSURE', name: '商务决策意见闭环率', definition: '商务决策意见已闭环的比例。' },
      { code: 'DEMO-CONTRACT-DECISION-CLOSURE', name: '合同决策意见闭环率', definition: '合同决策意见已闭环的比例。' },
      { code: 'DEMO-HIGH-RISK-CONTRACT', name: '重大/高风险合同签署率', definition: '签署合同中被认定为重大或高风险的比例。' },
      { code: 'DEMO-PROHIBITED-CLAUSE', name: '禁止类条款签署率', definition: '签署合同中含有禁止类条款的比例。' },
      { code: 'DEMO-FRAMEWORK-EXECUTION', name: '框架执行率', definition: '累计框架执行金额占约定金额的比例。' }
    ].map(definition => ({ ...definition, formula: '示例分子 ÷ 示例分母', manager: '运营组（模拟）', latestUpdateTime: null, url }))
  ];
  let retryDemoPending = true;

  return {
    async fetchData() { throw new Error('合成指标卡使用内联数值'); },
    async fetchMetricDefinitions(codes, { signal } = {}) {
      await delay(signal);
      if (retryDemoPending && codes.includes('DEMO-RETRY')) {
        retryDemoPending = false;
        throw new Error('模拟指标定义请求首次失败');
      }
      return definitions.filter(definition => codes.includes(definition.code));
    }
  };
}

async function delay(signal: AbortSignal | undefined) {
  signal?.throwIfAborted();
  let abort: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 400);
      abort = () => { clearTimeout(timer); reject(signal?.reason); };
      signal?.addEventListener('abort', abort, { once: true });
    });
  } finally {
    if (abort) signal?.removeEventListener('abort', abort);
  }
}
