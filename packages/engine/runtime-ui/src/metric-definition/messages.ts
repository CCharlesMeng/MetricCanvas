export const metricDefinitionMessages = {
  trigger: (title: string) => `查看${title}的指标定义`,
  loading: '正在加载指标的定义和解释，请稍等…',
  error: '网络出小差了，暂时没办法获取到指标的定义，请点击刷新重新加载。',
  name: '指标名称（指标编码）',
  definition: '指标定义',
  formula: '计算公式',
  manager: '指标解释人',
  updated: (date: string) => `注：此指标在 ${date} 进行了指标定义更新`,
  more: '查看更多',
  latest: '查看最新指标定义',
  retry: '重新加载'
};
