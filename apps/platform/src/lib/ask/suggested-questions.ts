/**
 * 工作台空态的建议问题(工作台与按需验证共读这一份,不允许手抄第二份)。
 *
 * 每条问题都必须满足以下约束,否则点下去走不到「真实取数 + 可渲染文档」:
 * - 指标名、维度名与维度取值逐字取自语义面(tools/dqe-sim/src/semantic-surface.ts);
 * - 时间口径写成具体年月:相对时间由模型补全会让取数核对阻塞等确认
 *   (orchestrator 的 model_completed_time 触发条件),体验上「点一下就出页面」不成立;
 * - 一条问题只落在一个业务域:同一取数单元不能跨域组合,且跨域没有共用的非时间维度;
 * - 避开跨域同名指标的裸称「客户数」(会触发消歧阻塞),要用域内唯一的别名
 *   「在用客户数」(运营分析)/「在册客户数」(客户经营);
 * - 避开组件目录(packages/page 的 componentCatalog)的名称与别名,例如「表格」
 *   「折线图」「趋势图」:那些词会被识别为显式点名组件,把展示形态写死。
 *
 * minComponents 是该问题应铺开的视角数下限:多指标问题由首轮多取数单元
 * (model-port.ts 的首轮提示词)兑现,一个指标一个组件。
 */
export interface SuggestedQuestion {
  question: string;
  minComponents: number;
}

export const SUGGESTED_QUESTIONS: readonly SuggestedQuestion[] = [
  {
    question: '2026年上半年各区域的Tokens消耗量、计费Tokens量、Tokens请求量和在用客户数对比情况如何？',
    minComponents: 4
  },
  {
    question:
      '2026年上半年各客户级别的在册客户数、新增客户数、流失客户数和客户留存率对比情况如何？',
    minComponents: 4
  },
  {
    question: '2026年上半年每个月的Tokens消耗量、计费Tokens量和Tokens请求量走势如何？',
    minComponents: 3
  },
  {
    question: '2026年7月各区域的Tokens消耗量是多少？',
    minComponents: 1
  },
  {
    question: '2026年上半年每个月的新增客户数走势如何？',
    minComponents: 1
  }
];
