import { MAX_SEMANTIC_HTML_LENGTH } from '@metriccanvas/page';

export type SemanticHtmlTag = 'div' | 'span' | 'strong' | 'p' | 'br';

export type SemanticHtmlNode =
  | { type: 'text'; value: string }
  | {
      type: 'element';
      tag: SemanticHtmlTag;
      classes: string[];
      children: SemanticHtmlNode[];
    };

export interface SemanticHtmlDocument {
  nodes: SemanticHtmlNode[];
}

export type SemanticHtmlParseResult =
  | { ok: true; document: SemanticHtmlDocument }
  | { ok: false; error: string };

const allowedTags = new Set<SemanticHtmlTag>([
  'div',
  'span',
  'strong',
  'p',
  'br'
]);

/** 类名表达内容语义，不表达具体颜色、字号或间距。 */
const allowedClasses = new Set([
  'detail-title',
  'detail-value',
  'detail-description',
  'detail-meta',
  'tone-positive',
  'tone-negative',
  'tone-neutral'
]);

const MAX_NODES = 1_000;
const MAX_DEPTH = 12;

/**
 * 把 DQE 语义 HTML 解析成受控节点。调用方只渲染这些节点，绝不把原文
 * 交给 {@html}；未知标签、属性、类名和不闭合结构全部失败关闭。
 */
export function parseSemanticHtml(source: string): SemanticHtmlParseResult {
  if (source.length > MAX_SEMANTIC_HTML_LENGTH) {
    return { ok: false, error: `内容超过 ${MAX_SEMANTIC_HTML_LENGTH} 字符` };
  }

  const root: { children: SemanticHtmlNode[] } = { children: [] };
  const stack: Array<{
    tag?: SemanticHtmlTag;
    children: SemanticHtmlNode[];
  }> = [root];
  let cursor = 0;
  let nodeCount = 0;

  while (cursor < source.length) {
    const tagStart = source.indexOf('<', cursor);
    if (tagStart < 0) {
      const appended = appendText(source.slice(cursor));
      if (!appended.ok) return appended;
      cursor = source.length;
      break;
    }
    if (tagStart > cursor) {
      const appended = appendText(source.slice(cursor, tagStart));
      if (!appended.ok) return appended;
    }

    const tagEnd = source.indexOf('>', tagStart + 1);
    if (tagEnd < 0) return { ok: false, error: 'HTML 标签未闭合' };
    const token = source.slice(tagStart, tagEnd + 1);

    const closing = token.match(/^<\/([a-z][a-z0-9]*)\s*>$/u);
    if (closing) {
      const tag = closing[1] as SemanticHtmlTag;
      const current = stack.at(-1);
      if (stack.length === 1 || current?.tag !== tag) {
        return { ok: false, error: `HTML 结束标签不匹配:${token}` };
      }
      stack.pop();
      cursor = tagEnd + 1;
      continue;
    }

    const opening = token.match(
      /^<([a-z][a-z0-9]*)(?:\s+class=(?:"([^"]*)"|'([^']*)'))?\s*(\/?)>$/u
    );
    if (!opening) {
      return { ok: false, error: `HTML 标签或属性不受支持:${token}` };
    }
    const tag = opening[1] as SemanticHtmlTag;
    if (!allowedTags.has(tag)) {
      return { ok: false, error: `HTML 标签不受支持:${tag}` };
    }
    const classes = (opening[2] ?? opening[3] ?? '')
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    const unsupportedClass = classes.find((className) => !allowedClasses.has(className));
    if (unsupportedClass) {
      return { ok: false, error: `HTML 语义类不受支持:${unsupportedClass}` };
    }

    nodeCount += 1;
    if (nodeCount > MAX_NODES) return { ok: false, error: `HTML 节点超过 ${MAX_NODES} 个` };
    const node: Extract<SemanticHtmlNode, { type: 'element' }> = {
      type: 'element',
      tag,
      classes,
      children: []
    };
    stack.at(-1)!.children.push(node);

    const selfClosing = opening[4] === '/';
    if (tag === 'br') {
      if (!selfClosing && token !== '<br>') {
        return { ok: false, error: 'br 只能写成 <br> 或 <br/>' };
      }
    } else if (selfClosing) {
      return { ok: false, error: `HTML 标签不能自闭合:${tag}` };
    } else {
      stack.push(node);
      if (stack.length > MAX_DEPTH) {
        return { ok: false, error: `HTML 嵌套超过 ${MAX_DEPTH - 1} 层` };
      }
    }
    cursor = tagEnd + 1;
  }

  if (stack.length !== 1) {
    return { ok: false, error: `HTML 标签未闭合:${stack.at(-1)?.tag ?? ''}` };
  }
  return { ok: true, document: { nodes: root.children } };

  function appendText(value: string): { ok: true } | { ok: false; error: string } {
    if (!value) return { ok: true };
    nodeCount += 1;
    if (nodeCount > MAX_NODES) return { ok: false, error: `HTML 节点超过 ${MAX_NODES} 个` };
    stack.at(-1)!.children.push({ type: 'text', value: decodeEntities(value) });
    return { ok: true };
  }
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|#39);/gu,
    (entity) => ({
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'"
    })[entity] ?? entity
  );
}
