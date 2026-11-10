/** Transport windows retain UTF-16 source offsets and JSON UTF-8 size bounds. */
export function textWindows(text: string): Array<{text: string; start: number; end: number; length: number}> {
  const result: Array<{text: string; start: number; end: number; length: number}> = [];
  let start = 0, end = 0, bytes = 0;
  for (const point of text) {
    const size = Buffer.byteLength(JSON.stringify(point)) - 2;
    if (bytes + size > 750 && end > start) {
      result.push({text: text.slice(start, end), start, end, length: text.length});
      start = end; bytes = 0;
    }
    bytes += size; end += point.length;
  }
  if (end > start) result.push({text: text.slice(start, end), start, end, length: text.length});
  return result;
}
