import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

type PdfNavigationIntent = { kind: 'window-open' | 'link'; href: string; target: string; download: string };
declare global {
  interface Window { __observePdfNavigation: (intent: PdfNavigationIntent) => Promise<void> }
}

test('页面配置驱动ShadowRoot里的PDF按钮和实际下载，无新窗口', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  const navigation: PdfNavigationIntent[] = [];
  await page.exposeFunction('__observePdfNavigation', (intent: PdfNavigationIntent) => { navigation.push(intent); });
  await page.addInitScript(() => {
    const originalOpen = window.open;
    window.open = (...args) => {
      void window.__observePdfNavigation({ kind: 'window-open', href: String(args[0] ?? ''), target: args[1] ?? '', download: '' });
      return originalOpen.apply(window, args);
    };
    document.addEventListener('click', event => {
      const link = event.composedPath().find(node => node instanceof HTMLAnchorElement);
      if (link instanceof HTMLAnchorElement) void window.__observePdfNavigation({
        kind: 'link', href: link.href, target: link.target || link.ownerDocument.querySelector('base')?.target || '', download: link.download
      });
    }, true);
  });
  let popupCount = 0;
  page.on('popup', () => popupCount++);
  await page.goto('/examples/report-pdf-download.html');
  const buttons = page.locator('[data-report-pdf-download]');
  await expect(buttons).toHaveCount(2);
  await expect(buttons.nth(0)).toHaveText('下载经营报告');
  await expect(buttons.nth(1)).toHaveText('下载 PDF');
  expect(await buttons.first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
  await expect(page.locator('[data-report-date-toolbar]').first().locator('input').first()).toBeVisible();
  const existingPages = context.pages();
  const originalUrl = page.url();
  const downloaded = page.waitForEvent('download');
  await buttons.first().click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('经营分析报告-2026-09.pdf');
  const path = await download.path();
  expect(path).not.toBeNull();
  expect((await readFile(path!)).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(buttons.first()).toHaveText('下载经营报告');
  await expect(buttons.first()).toBeEnabled();
  await expect(page.locator('[data-report-pdf-status]')).toHaveCount(0);
  await expect(page.getByText('PDF 已生成并发起下载')).toHaveCount(0);
  await expect(page.locator('[data-report-pdf-frame]')).toHaveCount(0);
  await expect(page.locator('[data-metriccanvas-export-stage]')).toHaveCount(0);
  expect(popupCount).toBe(0);
  // Assert application navigation directly; the browser can also create its own download UI.
  await expect.poll(() => navigation.filter(intent => intent.kind === 'link' && intent.download.endsWith('.pdf')).length).toBe(1);
  expect(navigation.filter(intent => intent.kind === 'window-open')).toEqual([]);
  expect(navigation.filter(intent => intent.kind === 'link')).toEqual([
    { kind: 'link', href: expect.stringMatching(/^blob:/), target: '', download: '经营分析报告-2026-09.pdf' }
  ]);
  expect(page.url()).toBe(originalUrl);
  await testInfo.attach('pdf-browser-pages', {
    body: Buffer.from(JSON.stringify(await Promise.all(context.pages().filter(candidate => !existingPages.includes(candidate)).map(async candidate => ({
      url: candidate.url(), hasOpener: !!(await candidate.opener().catch(() => null))
    }))), null, 2)), contentType: 'application/json'
  });
});

test('编码失败显示错误，恢复按钮并清理临时视图', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toDataURL = () => { throw new Error('PDF_ENCODE_FAILURE'); };
  });
  await page.goto('/examples/report-pdf-download.html');
  const button = page.locator('[data-report-pdf-download]').first();
  await button.click();
  await expect(button).toHaveText('下载失败，重试');
  await expect(button).toHaveAttribute('title', /PDF_ENCODE_FAILURE/);
  await expect(button).toBeEnabled();
  await expect(page.locator('[data-report-pdf-frame]')).toHaveCount(0);
  await expect(page.locator('[data-metriccanvas-export-stage]')).toHaveCount(0);
});

test('准备期间可取消，不发起下载', async ({ page }) => {
  let downloadCount = 0;
  page.on('download', () => downloadCount++);
  await page.goto('/examples/report-pdf-download.html');
  await expect(page.locator('[data-report-pdf-download]')).toHaveCount(2);
  await page.evaluate(async () => {
    const root = document.querySelector('[data-metriccanvas-runtime]')!.shadowRoot!;
    root.querySelector<HTMLButtonElement>('[data-report-pdf-download]')!.click();
    await Promise.resolve();
    root.querySelector<HTMLButtonElement>('[data-report-pdf-cancel]')!.click();
  });
  await expect(page.locator('[data-report-pdf-download]').first()).toHaveText('下载经营报告');
  await expect(page.locator('[data-report-pdf-status]')).toHaveCount(0);
  await expect(page.locator('[data-report-pdf-download]').first()).toBeEnabled();
  await expect(page.locator('[data-metriccanvas-export-stage]')).toHaveCount(0);
  expect(downloadCount).toBe(0);
});
