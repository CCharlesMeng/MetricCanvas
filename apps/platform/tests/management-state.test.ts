import { describe, expect, it } from 'vitest';
import {
  formatStructuredJson,
  runtimePreviewUrl,
  selectRevisionComparison,
  type RevisionAudit
} from '../src/lib/management-state';

const revisions: RevisionAudit[] = [
  {
    revisionId: 'revision-3',
    revisionNumber: 3,
    baseRevisionId: 'revision-2',
    contentHash: 'hash-3',
    metadataVersion: 'catalog-2',
    createdBy: 'developer-1',
    createdAt: '2026-07-21T01:00:00.000Z'
  },
  {
    revisionId: 'revision-1',
    revisionNumber: 1,
    baseRevisionId: null,
    contentHash: 'hash-1',
    metadataVersion: 'catalog-1',
    createdBy: 'developer-1',
    createdAt: '2026-07-19T01:00:00.000Z'
  },
  {
    revisionId: 'revision-2',
    revisionNumber: 2,
    baseRevisionId: 'revision-1',
    contentHash: 'hash-2',
    metadataVersion: 'catalog-1',
    createdBy: 'developer-1',
    createdAt: '2026-07-20T01:00:00.000Z'
  }
];

describe('管理界面修订状态', () => {
  it('按基线 id 而非传输顺序确定比较对象', () => {
    expect(selectRevisionComparison(revisions, 'revision-3')).toMatchObject({
      selected: { revisionId: 'revision-3' },
      base: { revisionId: 'revision-2' }
    });
    expect(selectRevisionComparison(revisions, 'revision-1')).toMatchObject({
      selected: { revisionId: 'revision-1' },
      base: null
    });
  });

  it('把预览固定到运行时中的精确修订', () => {
    expect(runtimePreviewUrl('http://localhost:5173/', '销售 / 总额', 'revision / 2')).toBe(
      'http://localhost:5173/pages/%E9%94%80%E5%94%AE%20%2F%20%E6%80%BB%E9%A2%9D?revision=revision%20%2F%202'
    );
  });

  it('以稳定键顺序显示结构化 JSON 差异', () => {
    expect(formatStructuredJson({ z: [{ b: 2, a: 1 }], a: 'first' })).toBe(
      '{\n  "a": "first",\n  "z": [\n    {\n      "a": 1,\n      "b": 2\n    }\n  ]\n}'
    );
  });
});
