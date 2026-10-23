import { parseSemanticHtml } from '../../../../widgets/src/shared/semantic-html';
import type { AiSummarySnapshot } from '../types';
import type { AiSummaryProps } from '@metriccanvas/page/internal';

export function exportSummarySnapshot(props: AiSummaryProps, snapshot?: AiSummarySnapshot): AiSummarySnapshot {
  if (snapshot) return snapshot;
  if (props.mode === 'provided') {
    try { return summaryContent(props.body ?? ''); }
    catch { return { status: 'empty' }; }
  }
  return { status: 'empty' };
}

/** 摘要的容错仅在这里；其他 semanticHtml 消费者继续遵守原来的严格契约。 */
export function summaryContent(source: string): Extract<AiSummarySnapshot, {status:'ready'}> {
  if (!source.trim()) throw new Error('AI 总结没有返回正文');
  if (!source.includes('<')) return { status: 'ready', text: source, format: 'text' };
  if (parseSemanticHtml(source).ok) return { status: 'ready', text: source, format: 'semanticHtml' };
  const text = summaryPlainText(source);
  if (!text.trim()) throw new Error('AI 总结没有可展示的文字');
  return { status: 'ready', text, format: 'text' };
}

/** 不创建 DOM、不加载资源、不执行内容；不合规标签仅用于提取文字与段落分隔。 */
export function summaryPlainText(source: string): string {
  return source
    .replace(/<!--[^]*?(?:-->|$)/gu, '')
    .replace(/<(script|style|template|iframe|object)\b[^>]*>[^]*?(?:<\/\1\s*>|$)/giu, '')
    .replace(/<\/?(?:p|div|section|article|h[1-6]|li|ul|ol|br)\b[^>]*>/giu, '\n')
    .replace(/<\/?[a-z][^>]*(?:>|$)/giu, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/giu, decodeEntity)
    .replace(/\n[ \t]*\n+/gu, '\n')
    .trim();
}

function decodeEntity(entity: string, name: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  if (named[name]) return named[name];
  const code = name.toLowerCase().startsWith('#x') ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
}
