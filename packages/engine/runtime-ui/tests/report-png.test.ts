import { describe, expect, it } from 'vitest';
import { crc32, inflateSync } from 'node:zlib';
import { createPngEncoder, validatePngSize } from '../src/report-png-encoder';
import { reportExportFilename } from '../src/report-export-context';

describe('单张流式PNG', () => {
  it('跨多个块仍只有一个合法PNG，独立解压后每个像素与源一致', async () => {
    const width = 73, height = 57;
    const rgba = Uint8Array.from({ length: width * height * 4 }, (_, index) => index % 4 === 3 ? 255 : (index * 43 + Math.floor(index / (width * 4)) * 7) % 256);
    const encoder = createPngEncoder(width, height);
    for (let first = 0; first < height; first += 11) {
      const count = Math.min(11, height - first);
      encoder.push(rgba.subarray(first * width * 4, (first + count) * width * 4), count);
    }
    const blob = encoder.finish();
    expect(blob.type).toBe('image/png');
    const file = Buffer.from(await blob.arrayBuffer());
    expect([...file.subarray(0, 8)]).toEqual([137,80,78,71,13,10,26,10]);
    const kinds: string[] = [], data: Buffer[] = [];
    let offset = 8;
    while (offset < file.length) {
      const size = file.readUInt32BE(offset), kind = file.toString('ascii', offset + 4, offset + 8);
      expect(crc32(file.subarray(offset + 4, offset + 8 + size))).toBe(file.readUInt32BE(offset + 8 + size));
      kinds.push(kind);
      if (kind === 'IHDR') { expect(file.readUInt32BE(offset + 8)).toBe(width); expect(file.readUInt32BE(offset + 12)).toBe(height); }
      if (kind === 'IDAT') data.push(file.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
    }
    expect(kinds.filter(kind => kind === 'IHDR')).toHaveLength(1);
    expect(kinds.filter(kind => kind === 'IEND')).toHaveLength(1);
    expect(kinds.at(-1)).toBe('IEND');
    const rows = inflateSync(Buffer.concat(data)), stride = width * 3 + 1;
    expect(rows.length).toBe(stride * height);
    for (let y = 0; y < height; y++) {
      expect(rows[y * stride]).toBe(1);
      for (let x = 0; x < width * 3; x++) {
        const decoded = (rows[y * stride + 1 + x] + (x >= 3 ? rows[y * stride + 1 + x - 3] : 0)) & 255;
        rows[y * stride + 1 + x] = decoded;
        expect(decoded).toBe(rgba[(y * width + Math.floor(x / 3)) * 4 + x % 3]);
      }
    }
  });
  it('不输出未完成图像，拒绝多余行、非法尺寸和超出字节预算', () => {
    const encoder = createPngEncoder(1, 2);
    encoder.push(new Uint8Array([0, 0, 0, 255]), 1);
    expect(() => encoder.finish()).toThrow(/尚未全部/);
    expect(() => encoder.push(new Uint8Array(8), 2)).toThrow(/顺序/);
    encoder.push(new Uint8Array([255, 255, 255, 255]), 1);
    encoder.finish();
    expect(() => encoder.finish()).toThrow();
    expect(() => createPngEncoder(1, 1, 32)).toThrow(/128 MiB/);
    for (const [width,height] of [[0,10],[8193,1],[1000,0],[1,32768],[8192,32767]]) expect(() => validatePngSize(width,height)).toThrow(/支持范围/);
    expect(() => validatePngSize(3600,18000)).not.toThrow();
  });
  it('文件名规范为唯一png后缀，不能生成其他格式', () => {
    expect(reportExportFilename({ title:'报告/名称' },{format:'png'})).toBe('报告_名称.png');
    expect(reportExportFilename({ title:'报告' },{format:'png',filename:'长图.ZIP.PNG'})).toBe('长图.png');
    expect(reportExportFilename({ title:'报告' },{format:'png',filename:'   '})).toBe('导出报告.png');
  });
});
