/**
 * JSON 的确定性表示:对象键排序,数组顺序保留,忽略对象中的 undefined。
 * 页面文档与元数据语义哈希必须使用同一规则。
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JSON 包含非有限数值');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeJson((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`;
  }
  throw new TypeError(`JSON 包含不可序列化值:${typeof value}`);
}
