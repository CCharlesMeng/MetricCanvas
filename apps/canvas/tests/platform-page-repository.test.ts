import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlatformPageRepository } from '../src/lib/platform-page-repository';

describe('平台页面仓库目录', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('从统一运行时公开目录列出已发布看板页面', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: [
            {
              id: 'demo',
              title: '经营概览',
              description: '仓库内置示例'
            }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const repository = createPlatformPageRepository('http://localhost:5174/');
    await expect(repository.list()).resolves.toEqual([
      { id: 'demo', title: '经营概览', description: '仓库内置示例' }
    ]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5174/api/runtime/pages');
  });

  it('公开目录失败时给出明确错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const repository = createPlatformPageRepository('http://localhost:5174');
    await expect(repository.list()).rejects.toThrow('页面目录加载失败:HTTP 503');
  });
});
