export type MarkdownInline =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; content: MarkdownInline[] }
  | { type: 'paragraph'; content: MarkdownInline[] }
  | { type: 'quote'; content: MarkdownInline[] }
  | { type: 'code'; value: string }
  | { type: 'list'; ordered: boolean; items: MarkdownInline[][] };

/**
 * 将受限 Markdown 解析为结构化节点。调用方按节点渲染，不接收原始 HTML，
 * 因此服务端返回的标签和脚本始终只能作为文本显示。
 */
export function parseSafeMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.trimStart().startsWith('```')) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.trimStart().startsWith('```')) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      blocks.push({ type: 'code', value: body.join('\n') });
      index += index < lines.length ? 1 : 0;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/u);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        content: parseInline(heading[2]!)
      });
      index += 1;
      continue;
    }
    const list = line.match(/^\s*(?:(\d+)\.|[-*])\s+(.+)$/u);
    if (list) {
      const ordered = Boolean(list[1]);
      const items: MarkdownInline[][] = [];
      while (index < lines.length) {
        const item = lines[index]?.match(/^\s*(?:(\d+)\.|[-*])\s+(.+)$/u);
        if (!item || Boolean(item[1]) !== ordered) break;
        items.push(parseInline(item[2]!));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', content: parseInline(line.slice(2)) });
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !/^(#{1,3})\s+|^\s*(?:(?:\d+)\.|[-*])\s+|^>\s+|^\s*```/u.test(
        lines[index] ?? ''
      )
    ) {
      paragraph.push(lines[index]!.trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) });
  }
  return blocks;
}

function parseInline(source: string): MarkdownInline[] {
  const output: MarkdownInline[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/gu;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) output.push({ type: 'text', value: source.slice(cursor, start) });
    const href = match[3] ? safeHref(match[3]) : null;
    if (match[2] && href) {
      output.push({ type: 'link', value: match[2], href });
    } else if (match[4]) {
      output.push({ type: 'strong', value: match[4] });
    } else if (match[5]) {
      output.push({ type: 'code', value: match[5] });
    } else {
      output.push({ type: 'text', value: match[0] });
    }
    cursor = start + match[0].length;
  }
  if (cursor < source.length) output.push({ type: 'text', value: source.slice(cursor) });
  return output;
}

function safeHref(value: string): string | null {
  const href = value.trim();
  return /^(https?:\/\/|\/(?!\/)|#)/iu.test(href) ? href : null;
}
