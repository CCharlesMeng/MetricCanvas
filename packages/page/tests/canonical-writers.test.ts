import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { normalizePageDocument } from '../src/index';

it('当前页面与样例使用受支持版本/layout，旧兼容夹具明确隔离', () => {
  for (const directory of ['pages', 'packages/page/fixtures/contract-valid']) {
    for (const name of readdirSync(directory).filter(name => name.endsWith('.json'))) {
      const raw = JSON.parse(readFileSync(join(directory, name), 'utf8'));
      const normalized = normalizePageDocument(raw);
      expect(normalized.ok, name).toBe(true);
      if (name.startsWith('legacy-layout-')) {
        expect(raw.schemaVersion).toBe('6.0');
        expect(raw).toHaveProperty('layoutForm');
      } else {
        expect(['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8', '6.9', '6.10'], name).toContain(raw.schemaVersion);
        expect(raw, name).not.toHaveProperty('layoutForm');
        if (normalized.ok) expect(normalized.document, name).toEqual(raw);
      }
    }
  }
});

it('64项黄金矩阵保留原始旧输入，包括缺省和双字段', () => {
  const matrix = JSON.parse(readFileSync('contracts/metriccanvas/page/conformance/layout-compatibility.json', 'utf8'));
  expect(matrix.cases).toHaveLength(64);
  for (const item of matrix.cases) expect(normalizePageDocument(item.input)).toEqual(item.expected);
  const legacy = matrix.cases.filter((item: {input:{schemaVersion:string}}) => item.input.schemaVersion === '6.0');
  expect(legacy).toHaveLength(8);
  expect(legacy[0].input).not.toHaveProperty('layout');
  expect(legacy[0].input).not.toHaveProperty('layoutForm');
  expect(legacy[2].input).toMatchObject({ layoutForm: 'dashboard' });
  expect(legacy[2].input).not.toHaveProperty('layout');
});
