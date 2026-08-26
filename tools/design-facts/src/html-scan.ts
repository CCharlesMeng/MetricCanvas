/**
 * 极小 HTML 标签扫描器,只为 Figma 导出稿这一种形态服务。
 *
 * 之所以自己扫而不引解析库:仓里没有任何 HTML 解析依赖,而目标文件的标签词汇表极窄
 * (正文只有 div/span/img/link,head 里只有 meta/title/script,0 个注释,属性值一律双引号),
 * 手写扫描器的行为可以逐条对着实测统计核对,比引入一个新依赖更省。
 *
 * 超出该形态的输入不做 HTML5 纠错。扫描器只保证:标签边界感知引号(所以属性值里的
 * `>` 不会把标签切断),void 元素与 raw text 元素不会污染父子栈。是否真的扫全了,
 * 由 extract 侧的 `parseWarnings` 与调用方的统计断言兜底。
 */

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

/** 内容按纯文本处理、不参与父子栈的元素 */
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

export type ScannedElement = {
  /** 文档序,同时是本数组的下标 */
  index: number;
  tag: string;
  attributes: Record<string, string>;
  /** 开标签的源文本原样切片,例如 `<div class="w-[580px]">` */
  openTagSource: string;
  parentIndex: number | null;
  childIndexes: number[];
  /** 直接文本子节点的拼接结果(未解码实体) */
  rawText: string;
};

/** 标签结束位置:感知引号,使属性值内部的 `>` 不会被当成标签结尾 */
function findTagEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < html.length; i += 1) {
    const char = html[i]!;
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return i;
  }
  return -1;
}

const ATTRIBUTE_PATTERN = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;

function parseAttributes(openTagSource: string, skip: number): Record<string, string> {
  const body = openTagSource.slice(skip, openTagSource.endsWith('/>') ? -2 : -1);
  const attributes: Record<string, string> = {};
  for (const match of body.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1]!.toLowerCase();
    if (name in attributes) continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

export function scanElements(html: string): ScannedElement[] {
  const elements: ScannedElement[] = [];
  const openStack: number[] = [];
  let cursor = 0;

  const appendText = (raw: string): void => {
    const top = openStack.at(-1);
    if (top !== undefined) elements[top]!.rawText += raw;
  };

  while (cursor < html.length) {
    const lt = html.indexOf('<', cursor);
    if (lt === -1) {
      appendText(html.slice(cursor));
      break;
    }
    if (lt > cursor) appendText(html.slice(cursor, lt));

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = findTagEnd(html, lt);
      cursor = end === -1 ? html.length : end + 1;
      continue;
    }
    if (html.startsWith('</', lt)) {
      const end = findTagEnd(html, lt);
      if (end === -1) break;
      const tag = html.slice(lt + 2, end).trim().toLowerCase();
      for (let i = openStack.length - 1; i >= 0; i -= 1) {
        if (elements[openStack[i]!]!.tag === tag) {
          openStack.length = i;
          break;
        }
      }
      cursor = end + 1;
      continue;
    }

    const nameMatch = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(lt, lt + 64));
    if (nameMatch === null) {
      appendText('<');
      cursor = lt + 1;
      continue;
    }
    const end = findTagEnd(html, lt);
    if (end === -1) break;

    const openTagSource = html.slice(lt, end + 1);
    const tag = nameMatch[1]!.toLowerCase();
    const parentIndex = openStack.at(-1) ?? null;
    const element: ScannedElement = {
      index: elements.length,
      tag,
      attributes: parseAttributes(openTagSource, nameMatch[0].length),
      openTagSource,
      parentIndex,
      childIndexes: [],
      rawText: ''
    };
    elements.push(element);
    if (parentIndex !== null) elements[parentIndex]!.childIndexes.push(element.index);
    cursor = end + 1;

    if (RAW_TEXT_TAGS.has(tag)) {
      const close = new RegExp(`</${tag}\\s*>`, 'i').exec(html.slice(cursor));
      element.rawText = close === null ? html.slice(cursor) : html.slice(cursor, cursor + close.index);
      cursor += close === null ? html.length - cursor : close.index;
      continue;
    }
    if (!openTagSource.endsWith('/>') && !VOID_TAGS.has(tag)) openStack.push(element.index);
  }

  return elements;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0'
};

export function decodeEntities(raw: string): string {
  return raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}
