/**
 * JSON 序列化:结构层缩进展开,叶容器压成一行。
 *
 * 规则只有一条:**不含嵌套对象/数组的容器压成一行**。于是每条字面量声明、每条 path、
 * 每个 computed 列表各占一行,而 nodes 这类结构层仍然逐层缩进。
 *
 * 理由是这份产物入库后要靠 diff 复核:`JSON.stringify(x, null, 2)` 会把一条 6 字段的
 * 字面量摊成 8 行,5000 条就是 4 万行、2MB,改一个数值在 diff 里看不出属于哪条;
 * 压成一行后是"一行一条事实",体积也降到四成。全压一行则完全没法读。
 */

type JsonScalar = string | number | boolean | null;
type JsonContainer = Json[] | { [key: string]: Json };
type Json = JsonScalar | JsonContainer;

function isContainer(value: Json): value is JsonContainer {
  return value !== null && typeof value === 'object';
}

function hasOnlyScalars(value: JsonContainer): boolean {
  return Object.values(value).every((item) => !isContainer(item));
}

function write(value: Json, indent: string): string {
  if (!isContainer(value)) return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (hasOnlyScalars(value)) return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
    const inner = indent + '  ';
    return `[\n${value.map((item) => inner + write(item, inner)).join(',\n')}\n${indent}]`;
  }

  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  if (entries.length === 0) return '{}';
  if (hasOnlyScalars(value)) {
    return `{ ${entries.map(([key, item]) => `${JSON.stringify(key)}: ${JSON.stringify(item)}`).join(', ')} }`;
  }
  const inner = indent + '  ';
  return `{\n${entries
    .map(([key, item]) => `${inner}${JSON.stringify(key)}: ${write(item, inner)}`)
    .join(',\n')}\n${indent}}`;
}

export function formatJson(value: unknown): string {
  return `${write(JSON.parse(JSON.stringify(value)) as Json, '')}\n`;
}
