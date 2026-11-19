const zh = {
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

const en: typeof zh = {
  trigger: title => `View metric definition for ${title}`,
  loading: 'Loading metric definitions and explanations, please wait...',
  error: 'The metric definition cannot be obtained at the moment due to busy network. Please click refresh to reload later.',
  name: 'Metric Name (Metric Code)',
  definition: 'Metric Definition',
  formula: 'Metric Formula',
  manager: 'Metric Explainer',
  updated: date => `Note: The definition of this metric was updated on ${date}.`,
  more: 'See More',
  latest: 'See Latest',
  retry: 'Reload'
};

export function metricDefinitionMessages(anchor: HTMLElement | undefined) {
  const root = anchor?.getRootNode();
  const host = root && root instanceof ShadowRoot ? root.host : undefined;
  const lang = anchor?.closest('[lang]')?.getAttribute('lang')
    || host?.closest('[lang]')?.getAttribute('lang')
    || anchor?.ownerDocument.documentElement.lang;
  return /^en(?:[-_]|$)/i.test(lang ?? '') ? en : zh;
}
