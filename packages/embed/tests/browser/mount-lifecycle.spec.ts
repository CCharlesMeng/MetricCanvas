import { expect, test } from '@playwright/test';
import type { RuntimeEvent } from '../../src/types';

test('读取挂载配置失败不留下根节点，随后仍可正常挂载', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
  const error = await page.evaluate(() => {
    window.runtime.destroy();
    const options = { document: window.pageDocument };
    Object.defineProperty(options, 'onEvent', { get() { throw new Error('callback unavailable'); } });
    try { MetricCanvas.mount('#dashboard', options); }
    catch (cause) { return String(cause); }
    return '';
  });
  expect(error).toContain('callback unavailable');
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
  await page.evaluate(() => { window.runtime = MetricCanvas.mount('#dashboard', { document: window.pageDocument }); });
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(1);
});

test('生命周期示例连续 mount 保持一个根，ES 与 global 共享实例', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/mount-lifecycle.html');
  await expect(page.getByText('1 次 mount，1 个实例', { exact: true })).toBeVisible();
  const shared = await page.evaluate(async () => {
    const entry = '/dist/metriccanvas-runtime.es.js';
    const esm = await import(entry);
    const response = await fetch('/pages/embed-mount-lifecycle.json');
    const document = await response.json();
    const root = window.document.querySelector('[data-metriccanvas-runtime]');
    const original = window.runtime;
    for (let count = 0; count < 20; count++) {
      if (esm.mount('#dashboard', { document }) !== original) return false;
    }
    return root === window.document.querySelector('[data-metriccanvas-runtime]');
  });
  expect(shared).toBe(true);
  await page.getByRole('button', { name: '再次 mount' }).click({ clickCount: 3 });
  await expect(page.getByText('4 次 mount，1 个实例', { exact: true })).toBeVisible();
  await expect(page.getByText('4', { exact: true })).toBeVisible();
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(1);
  await page.getByRole('button', { name: '销毁', exact: true }).click();
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
  await page.getByRole('button', { name: '再次 mount' }).click();
  await expect(page.getByText('5 次 mount，1 个实例', { exact: true })).toBeVisible();
  await expect(page.getByText('5', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('重复 mount 使用最新文档和事件回调，省略回调时清除旧回调', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
  await page.evaluate(() => {
    window.runtime.destroy();
    window.queryEvents = [];
    window.runtime = MetricCanvas.mount('#dashboard', {
      document: window.pageDocument,
      onEvent: event => window.queryEvents.push(event)
    });
  });
  await expect.poll(() => page.evaluate(() => window.queryEvents.some(event => event.type === 'ready'))).toBe(true);

  await page.evaluate(() => {
    window.queryEvents = [];
    const container = document.querySelector<HTMLElement>('#dashboard')!;
    const next = structuredClone(window.pageDocument);
    next.id = 'repeated-mount';
    next.sections[0].components[0].props.title = '重复挂载更新后的页面';
    if (MetricCanvas.mount(container, {
      document: next,
      onEvent: event => {
        if (event.type === 'ready') document.body.dataset.latestReady = event.pageId;
      }
    }) !== window.runtime) throw new Error('重复挂载必须返回同一个句柄');
  });
  await expect(page.getByRole('heading', { name: '重复挂载更新后的页面' })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-latest-ready', 'repeated-mount');
  expect(await page.evaluate(() => window.queryEvents)).toEqual([]);

  await page.evaluate(() => {
    window.runtime.update({ document: { ...window.pageDocument, id: 'handle-update' } });
  });
  await expect(page.locator('body')).toHaveAttribute('data-latest-ready', 'handle-update');

  await page.evaluate(() => {
    delete document.body.dataset.latestReady;
    MetricCanvas.mount('#dashboard', { document: window.pageDocument });
  });
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-latest-ready');
  expect(await page.evaluate(() => window.queryEvents)).toEqual([]);
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(1);
});

test('不同容器独立挂载，销毁后重挂载不受旧句柄影响', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
  const handles = await page.evaluate(() => {
    const second = document.createElement('div');
    document.body.append(second);
    const independent = MetricCanvas.mount(second, { document: window.pageDocument });
    const old = window.runtime;
    old.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document: window.pageDocument });
    old.destroy();
    let destroyedUpdateRejected = false;
    try { old.update({ document: window.pageDocument }); }
    catch (error) { destroyedUpdateRejected = error instanceof Error && error.name === 'MetricCanvasMountError'; }
    independent.destroy();
    return { independent: independent !== old, fresh: window.runtime !== old, destroyedUpdateRejected };
  });
  expect(handles).toEqual({ independent: true, fresh: true, destroyedUpdateRejected: true });
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
});

test('宿主持有 30 个已销毁句柄时，页面、渲染根和事件回调仍可回收', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
  const samples = await page.evaluateHandle(async () => {
    window.runtime.destroy();
    const target = document.querySelector<HTMLElement>('#dashboard')!;

    async function mountAndDestroy(index: number) {
      const pageDocument = structuredClone(window.pageDocument);
      pageDocument.id = 'collection-' + index;
      const payload = { lastPage: '' };
      let ready!: () => void;
      const initialized = new Promise<void>(resolve => { ready = resolve; });
      function onEvent(event: RuntimeEvent) {
        if (event.type !== 'ready') return;
        payload.lastPage = event.pageId;
        ready();
      }

      const handle = MetricCanvas.mount(target, { document: pageDocument, onEvent });
      await initialized;
      const root = target.querySelector('[data-metriccanvas-runtime]')!;
      if (!root.shadowRoot?.querySelector('.section-grid') || payload.lastPage !== pageDocument.id) {
        throw new Error('页面未渲染或事件回调未执行');
      }
      handle.destroy();
      return {
        handle,
        pageDocument: new WeakRef(pageDocument),
        root: new WeakRef(root),
        onEvent: new WeakRef(onEvent),
        payload: new WeakRef(payload)
      };
    }

    const results = [];
    for (let index = 0; index < 30; index++) results.push(await mountAndDestroy(index));
    return results;
  });
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
  const cdp = await page.context().newCDPSession(page);
  await expect.poll(async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    return samples.evaluate(results => ({
      heldHandles: results.filter(sample => typeof sample.handle.destroy === 'function').length,
      documents: results.filter(sample => sample.pageDocument.deref()).length,
      roots: results.filter(sample => sample.root.deref()).length,
      callbacks: results.filter(sample => sample.onEvent.deref()).length,
      payloads: results.filter(sample => sample.payload.deref()).length
    }));
  }).toEqual({ heldHandles: 30, documents: 0, roots: 0, callbacks: 0, payloads: 0 });
});

test('卸载回调安排重挂载时，旧句柄只移除自己的根', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
  const result = await page.evaluate(async () => {
    window.runtime.destroy();
    const target = document.querySelector<HTMLElement>('#dashboard')!;
    const options = { document: window.pageDocument };
    let subscribed!: () => void;
    let remount!: () => void;
    const initialized = new Promise<void>(resolve => { subscribed = resolve; });
    const remounted = new Promise<void>(resolve => { remount = resolve; });
    const old = MetricCanvas.mount(target, {
      ...options,
      displayInputs: {
        getSnapshot: () => ({ permissionRevision: 'fixture', timeZone: 'UTC', permissions: {}, values: {}, periods: {} }),
        subscribe() {
          subscribed();
          return () => queueMicrotask(() => {
            window.runtime = MetricCanvas.mount(target, options);
            remount();
          });
        }
      }
    });
    await initialized;
    const previous = target.querySelector('[data-metriccanvas-runtime]')!;
    old.destroy();
    await remounted;
    old.destroy();
    return {
      remounted: window.runtime !== old,
      oldRootRemoved: !previous.isConnected,
      remainingRoots: target.querySelectorAll('[data-metriccanvas-runtime]').length
    };
  });
  expect(result).toEqual({ remounted: true, oldRootRemoved: true, remainingRoots: 1 });
  await expect(page.getByRole('heading', { name: '独立 HTML 经营概览' })).toBeVisible();
});
