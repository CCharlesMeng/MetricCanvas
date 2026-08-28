import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readRuntimeRevision } from '../src/lib/server/runtime-revision.server';

const getPublishedRevision = vi.fn();
const getRevision = vi.fn();

describe('运行时精确修订读取的部署角色边界', () => {
  beforeEach(() => {
    getPublishedRevision.mockReset();
    getRevision.mockReset();
  });

  it('reader 不能经精确修订端点读取未发布修订', async () => {
    getPublishedRevision.mockResolvedValue({
      ok: false,
      error: { code: 'REVISION_NOT_PUBLISHED', message: '修订未发布' }
    });
    getRevision.mockResolvedValue({
      ok: true,
      revision: { document: { meta: { title: '未发布' } } }
    });

    const result = await readRuntimeRevision(
      { role: 'reader', lifecycle: { getPublishedRevision } },
      { pageId: 'page-1', revisionId: 'revision-draft' }
    );

    expect(getPublishedRevision).toHaveBeenCalledWith({
      pageId: 'page-1',
      revisionId: 'revision-draft'
    });
    expect(getRevision).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it('authoring 保留精确修订预览', async () => {
    getRevision.mockResolvedValue({
      ok: true,
      revision: { document: { meta: { title: '未发布预览' } } }
    });

    const result = await readRuntimeRevision(
      { role: 'authoring', lifecycle: { getRevision } },
      { pageId: 'page-1', revisionId: 'revision-draft' }
    );

    expect(getRevision).toHaveBeenCalledOnce();
    expect(getPublishedRevision).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});
