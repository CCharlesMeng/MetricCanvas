import { describe, expect, it } from 'vitest';
import { fileNameErrors } from '../src/file-name';

describe('fileNameErrors:页面文件名与 Page.id 一致(切片1 评审遗留)', () => {
  it('文件名(去扩展名)与 id 一致时无错误', () => {
    expect(fileNameErrors('demo.json', { id: 'demo' })).toEqual([]);
  });

  it('文件名与 id 不一致时报 SCHEMA_ERROR,定位到 /id', () => {
    const errors = fileNameErrors('demo.json', { id: 'other-page' });
    expect(errors).toEqual([expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/id' })]);
    expect(errors[0].message).toContain('demo');
    expect(errors[0].message).toContain('other-page');
  });

  it('文档没有字符串 id 时不重复报错(缺 id 由结构校验负责)', () => {
    expect(fileNameErrors('demo.json', {})).toEqual([]);
    expect(fileNameErrors('demo.json', null)).toEqual([]);
  });
});
