import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { RuntimeEvent } from '../../src/types';

const document = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/navigation/url-input-cleanup.json', import.meta.url), 'utf8'));

declare global {
  interface Window {
    cleanupProbe: { replacements: number; searches: string[]; events: string[] };
  }
}

async function open(page: Page, mode: string, url: string, adapter = 'default') {
  await page.goto('/examples/inline.html');
  await expect.poll(() => page.evaluate(() => !!window.runtime)).toBe(true);
  await page.evaluate(async ({ document, mode, url, adapter }) => {
    window.runtime.destroy();
    history.replaceState({ navigationId: 7, custom: 'retained' }, '', url);
    window.cleanupProbe = { replacements: 0, searches: [], events: [] };
    const replace = history.replaceState.bind(history);
    history.replaceState = (state, title, href) => {
      window.cleanupProbe.replacements++;
      replace(state, title, href);
    };
    const moduleURL = '/dist/metriccanvas-runtime.es.js';
    const api = mode === 'esm' ? await import(moduleURL) : await MetricCanvas.ready;
    const navigation = adapter === 'custom' ? {
      preserveSearchParams: ['tenant'],
      replaceSearch(search: string) { window.cleanupProbe.searches.push(search); }
    } : adapter === 'failure' ? {
      replaceSearch: async () => { throw Error('host rejected URL update'); }
    } : { preserveSearchParams: ['tenant'] };
    window.runtime = api.mount('#dashboard', { document, navigation,
      onEvent(event: RuntimeEvent) { window.cleanupProbe.events.push(event.type); } });
  }, { document, mode, url, adapter });
}

for (const mode of ['esm', 'classic']) {
  test(`${mode}: initialization cleans only unknown keys and keeps input state without extra history or events`, async ({ page }) => {
    const input = '/examples/inline.html?account=A%2BB&active=true&view=detail&tenant=t&unknown=1#section';
    await open(page, mode, input);
    await expect(page.getByText('A+B', { exact: true })).toBeVisible();
    await expect(page.getByText('true', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: '明细', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/account=A%2BB&active=true&view=detail&tenant=t#section$/);
    expect(await page.evaluate(() => history.state)).toEqual({ navigationId: 7, custom: 'retained' });
    expect(await page.evaluate(() => window.cleanupProbe)).toEqual({ replacements: 1, searches: [], events: ['ready'] });
    const length = await page.evaluate(() => history.length);
    await page.getByRole('tab', { name: '概况', exact: true }).click();
    await expect(page).toHaveURL(/tab.views=overview/);
    expect(new URL(page.url()).searchParams.has('unknown')).toBe(false);
    expect(new URL(page.url()).searchParams.get('tenant')).toBe('t');
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.reload();
    // This host's bootstrap uses explicit empty input; URL was replaced, not a second navigation.
    await expect.poll(() => page.evaluate(() => !!window.runtime)).toBe(true);
    expect(new URL(page.url()).searchParams.has('unknown')).toBe(false);
  });

  test(`${mode}: hash route cleanup removes extras in both query areas and retains outer host keys`, async ({ page }) => {
    await open(page, mode, '/examples/inline.html?tenant=t&account=outer&extra=x#!/detail?account=inner&active=true&view=detail&extra=y#section');
    await expect(page.getByText('inner', { exact: true })).toBeVisible();
    const url = new URL(page.url());
    expect(url.search).toBe('?tenant=t');
    expect(url.hash).toBe('#!/detail?account=inner&active=true&view=detail#section');
    await page.getByRole('tab', { name: '概况', exact: true }).click();
    await expect.poll(() => new URL(page.url()).hash).toContain('tab.views=overview');
    expect(new URL(page.url()).search).toBe('?tenant=t');
  });
}

test('custom host adapter owns writing; a full update without it restores the browser default', async ({ page }) => {
  await open(page, 'esm', '/examples/inline.html?account=A&tenant=t&unused=x', 'custom');
  await expect(page.getByText('A', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.cleanupProbe.searches)).toEqual(['account=A&tenant=t']);
  expect(new URL(page.url()).searchParams.get('unused')).toBe('x');
  await page.evaluate(document => window.runtime.update({ document, navigation: { preserveSearchParams: ['tenant'] } }), document);
  await expect(page).toHaveURL(/\?account=A&tenant=t$/);
  expect(await page.evaluate(() => window.cleanupProbe.replacements)).toBe(1);
});

test('invalid declared input blocks initialization and leaves the original URL available for diagnosis', async ({ page }) => {
  await open(page, 'esm', '/examples/inline.html?account=A&active=invalid&extra=x');
  await expect(page.getByRole('heading', { name: '页面输入不完整或无效', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('extra')).toBe('x');
  expect(await page.evaluate(() => window.cleanupProbe.replacements)).toBe(0);
});

test('an asynchronous host rejection does not break the initialized page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, 'esm', '/examples/inline.html?account=A&extra=x', 'failure');
  await expect(page.getByText('A', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '明细', exact: true }).click();
  await expect(page.getByText('明细内容', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
