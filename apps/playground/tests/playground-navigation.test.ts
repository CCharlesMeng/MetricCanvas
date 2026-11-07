import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizePageDocument } from '@metriccanvas/page';
import { createPlaygroundNavigation, resolvePlaygroundTarget } from '../src/lib/playground-navigation';

const baseURL = 'http://localhost:5173/pages/source';
const rawTarget = JSON.parse(readFileSync(new URL('../../../pages/capabilities/navigation/playground-route-target.json', import.meta.url), 'utf8'));
const normalizedTarget = normalizePageDocument({ ...rawTarget, id: 'detail' });
if (!normalizedTarget.ok) throw new Error('路由目标演示必须有效');
const document = normalizedTarget.document;
function fixture() {
  const pages = { has: (id: string) => ['detail', '中文页面'].includes(id), load: vi.fn(async () => document) };
  const visit = vi.fn();
  const navigation = createPlaygroundNavigation(pages, { baseURL: () => baseURL, visit, rememberSource: true });
  return { pages, visit, navigation };
}

describe('Playground 按 URL 末段自动定位 Pages', () => {
  it.each([
    '/operation-map/detail?project-id=P001&regions=a&regions=b#summary',
    'https://business.example/operation-map/detail?project-id=P001&regions=a&regions=b#summary',
    '../detail/?project-id=P001&regions=a&regions=b#summary'
  ])('自动匹配 %s，保留重复参数与锚点', (href) => {
    const { pages } = fixture();
    expect(resolvePlaygroundTarget(href, baseURL, pages)).toEqual({
      kind: 'page', pageId: 'detail', href: '/pages/detail?project-id=P001&regions=a&regions=b#summary'
    });
  });

  it('解码中文末段，页面不按标题或相似名称匹配', () => {
    const { pages } = fixture();
    expect(resolvePlaygroundTarget('/app/%E4%B8%AD%E6%96%87%E9%A1%B5%E9%9D%A2/', baseURL, pages))
      .toMatchObject({ kind: 'page', pageId: '中文页面' });
    expect(resolvePlaygroundTarget('/app/detail-copy', baseURL, pages).kind).toBe('missing');
    expect(resolvePlaygroundTarget('/app/%2Fdetail', baseURL, pages).kind).toBe('missing');
  });

  it.each(['/app/missing?x=0&x=false#anchor', '/', '/app/%E0%A4%A'])('找不到时生成保留完整目标的诊断链接：%s', (href) => {
    const { pages, navigation, visit } = fixture();
    const target = resolvePlaygroundTarget(href, baseURL, pages);
    expect(target.kind).toBe('missing');
    const diagnostic = new URL(target.href, baseURL);
    expect(diagnostic.pathname).toBe('/navigation-target');
    expect(diagnostic.searchParams.get('href')).toBe(new URL(href, baseURL).href);
    expect(navigation.navigate?.({ href: target.href })).toBe(true);
    expect(visit).toHaveBeenCalledWith(target.href);
    expect(pages.load).not.toHaveBeenCalled();
  });

  it('原生锚点不进入页面匹配', () => {
    const { pages, navigation, visit } = fixture();
    expect(resolvePlaygroundTarget('#summary', baseURL, pages)).toEqual({ kind: 'native', href: '#summary' });
    expect(navigation.navigate?.({ href: '#summary' })).toBe(false);
    expect(visit).not.toHaveBeenCalled();
  });

  it('目标声明和真实链接使用同一匹配规则，单击切换本地页；来源由注入的浏览器跟踪器承接', async () => {
    const { pages, navigation, visit } = fixture();
    const href = '/operation-map/detail?project-id=P001#summary';
    const controller = new AbortController();
    const contract = await navigation.resolveTargetInputs?.(href, { signal: controller.signal });
    expect(pages.load).toHaveBeenCalledWith('detail');
    expect(contract).toMatchObject({ pageId: 'detail', params: [{ id: 'region', type: 'dimension', multiple: true }, { id: 'project-id', required: true }] });
    const localHref = navigation.resolveHref!(href);
    expect(navigation.navigate?.({ href: localHref, sourcePageId: 'source', sourceSearch: 'filter=north' })).toBe(true);
    expect(visit).toHaveBeenCalledWith('/pages/detail?project-id=P001#summary');
  });

  it('即时预览没有来源跟踪器时仍可切页', () => {
    const { pages, visit } = fixture();
    const navigation = createPlaygroundNavigation(pages, { baseURL: () => baseURL, visit });
    navigation.navigate?.({ href: '/pages/detail', sourcePageId: 'draft' });
    expect(visit).toHaveBeenCalledWith('/pages/detail');
  });

  it('缺目标、原生锚点与已取消请求不加载声明；迟到响应被丢弃', async () => {
    const { pages, navigation } = fixture();
    const controller = new AbortController();
    expect(await navigation.resolveTargetInputs?.('/app/missing', { signal: controller.signal })).toBeUndefined();
    expect(await navigation.resolveTargetInputs?.('#summary', { signal: controller.signal })).toBeUndefined();
    controller.abort();
    expect(await navigation.resolveTargetInputs?.('/app/detail', { signal: controller.signal })).toBeUndefined();
    expect(pages.load).not.toHaveBeenCalled();
    const pending = new AbortController();
    pages.load.mockImplementationOnce(async () => { pending.abort(); return document; });
    expect(await navigation.resolveTargetInputs?.('/app/detail', { signal: pending.signal })).toBeUndefined();
  });

  it('加载失败保留拒绝语义，不接管未解析的外部或无关地址', async () => {
    const { pages, navigation, visit } = fixture();
    pages.load.mockRejectedValueOnce(new Error('读取失败'));
    await expect(navigation.resolveTargetInputs?.('/app/detail', { signal: new AbortController().signal })).rejects.toThrow('读取失败');
    expect(navigation.navigate?.({ href: 'https://other.example/pages/detail' })).toBe(false);
    expect(navigation.navigate?.({ href: '/files' })).toBe(false);
    expect(visit).not.toHaveBeenCalled();
  });
});
