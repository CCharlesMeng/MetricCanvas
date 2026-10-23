import type { AiSummaryConfig, AiSummaryContextInfo } from '../types';

/**
 * 云宝助手唯一实现入口。当前为本地 mock，未连接真实云宝助手。
 * 内网只替换 generate 的函数体：自行构建 SSE、累积正文，最终返回字符串。
 * 保持同一个 aiSummary 注入对象，可跨 Report 返回复用后台任务和结果。
 */
export async function generate(question: string, contextInfo: AiSummaryContextInfo): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const dates = Object.values(contextInfo.timeFilters).map(value => {
    if (value.type === 'timePoint') return value.value;
    if (value.type === 'timeRange') return `${value.from} 至 ${value.to}`;
    return '';
  }).join('；');
  const sources = contextInfo.dataSources.map(source => {
    const rows = source.result.status === 'ready' ? source.result.rows.length : 0;
    return `${source.description}：${rows} 行（${source.result.status}）`;
  }).join('；');
  return `<p><strong>本地 Mock 分析</strong>：${escapeHtml(dates || '当前期间')}。</p>` +
    `<p>${escapeHtml(sources || '未关联数据源')}。业务要求：${escapeHtml(question.split('\n')[0] ?? '')}</p>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
}

export const aiSummary: AiSummaryConfig = { generate, throttleMs: 1000, concurrency: 2 };
