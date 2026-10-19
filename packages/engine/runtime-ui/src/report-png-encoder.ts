import { Zlib } from 'fflate';

export const PNG_FILE_LIMIT = 128 * 1024 * 1024;
export const PNG_MAX_WIDTH = 8192;
export const PNG_MAX_HEIGHT = 32_767;
export const PNG_MAX_PIXELS = 128 * 1024 * 1024;
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function chunk(kind: string, bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(bytes.length + 12);
  const view = new DataView(output.buffer);
  view.setUint32(0, bytes.length);
  output.set(Array.from(kind, char => char.charCodeAt(0)), 4);
  output.set(bytes, 8);
  let crc = 0xffffffff;
  for (let index = 4; index < output.length - 4; index++) crc = crcTable[(crc ^ output[index]) & 255] ^ (crc >>> 8);
  view.setUint32(output.length - 4, (crc ^ 0xffffffff) >>> 0);
  return output;
}

export function validatePngSize(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width > PNG_MAX_WIDTH || height > PNG_MAX_HEIGHT || width * height > PNG_MAX_PIXELS) {
    throw Error('当前报告尺寸超出图片导出支持范围');
  }
}

/** One PNG, one zlib stream. Only bounded RGBA strips and compressed file chunks are retained.
 * Opaque screenshots use RGB8 + Sub filtering; row filtering never depends on block boundaries.
 */
export function createPngEncoder(width: number, height: number, byteLimit = PNG_FILE_LIMIT) {
  validatePngSize(width, height);
  const parts: Uint8Array<ArrayBuffer>[] = [signature];
  let bytes = signature.length, rows = 0, finished = false, failed = false;
  const append = (part: Uint8Array<ArrayBuffer>) => {
    bytes += part.length;
    if (bytes > byteLimit) { failed = true; parts.length = 0; throw Error('图片文件超过 128 MiB 导出上限'); }
    parts.push(part);
  };
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  header[8] = 8; header[9] = 2;
  append(chunk('IHDR', header));
  const compressor = new Zlib({ level: 3 }, data => { if (data.length) append(chunk('IDAT', data)); });
  return {
    get rows() { return rows; },
    push(rgba: Uint8ClampedArray | Uint8Array, rowCount: number) {
      if (finished || failed || !Number.isInteger(rowCount) || rowCount < 1 || rows + rowCount > height || rgba.length !== width * rowCount * 4) throw Error('图片像素行数或编码顺序无效');
      const stride = width * 3 + 1;
      // Avoid allocating an entire bitmap-sized second RGB buffer.
      for (let first = 0; first < rowCount; first += 16) {
        const count = Math.min(16, rowCount - first);
        const filtered = new Uint8Array(stride * count);
        for (let row = 0; row < count; row++) {
          let dest = row * stride;
          filtered[dest++] = 1;
          for (let x = 0; x < width; x++) {
            const source = ((first + row) * width + x) * 4;
            for (let channel = 0; channel < 3; channel++) filtered[dest++] = rgba[source + channel] - (x ? rgba[source - 4 + channel] : 0);
          }
        }
        compressor.push(filtered, false);
      }
      rows += rowCount;
    },
    finish(): Blob {
      if (finished || failed || rows !== height) throw Error('图片像素尚未全部编码');
      finished = true;
      compressor.push(new Uint8Array(), true);
      append(chunk('IEND', new Uint8Array()));
      const result = new Blob(parts, { type: 'image/png' });
      parts.length = 0;
      return result;
    }
  };
}
