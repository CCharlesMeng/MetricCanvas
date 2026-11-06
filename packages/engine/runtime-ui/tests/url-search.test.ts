import { describe, expect, it, vi } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import fixture from '../../../../pages/capabilities/navigation/url-input-cleanup.json';
import regionFixture from '../../../../pages/capabilities/filters/ioc-region-url-demo.json';
import { initializeURLSearch, pageURLSearch, replaceRuntimeSearch } from '../src/url-search';

function parsed(document: unknown): Page {
  const result = parsePage(document);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.page;
}
const page = parsed(fixture);

describe('page URL input cleanup', () => {
  it('keeps declared parameters, filters, both tab keys and explicit host keys in original order', () => {
    const before = structuredClone(page);
    expect(pageURLSearch(page, '?unused=x&account=A%2BB&active=true&view=detail&tab.views=overview&tenant=a&tenant=b', ['tenant']))
      .toBe('account=A%2BB&active=true&view=detail&tab.views=overview&tenant=a&tenant=b');
    expect(page).toEqual(before);
  });

  it('keeps aliases and compound keys but removes undeclared filter IDs and tab keys', () => {
    const aliased = structuredClone(page);
    aliased.filters = [
      { id: 'period', type: 'timeRange', label: '期间', urlParams: { from: 'start', to: 'end' } },
      { id: 'department', type: 'dimension', dimension: 'department', label: '部门', urlParams: { value: 'dept' } }
    ];
    expect(pageURLSearch(aliased, 'period=bad&start=2026-01-01&end=2026-02-01&department=x&dept=a&dept=b&tab.other=x'))
      .toBe('start=2026-01-01&end=2026-02-01&dept=a&dept=b');
  });

  it('preserves IOC Region standard and compatibility keys only on their declaring page', () => {
    const region = parsed(regionFixture);
    expect(pageURLSearch(region, 'region-dept=A&rep-office=B&region=C&region.level=office&extra=x'))
      .toBe('region-dept=A&rep-office=B&region=C&region.level=office');
    expect(pageURLSearch(page, 'region-dept=A&rep-office=B&account=A')).toBe('account=A');
  });

  it('does not silently repair invalid values or duplicate single-value inputs', () => {
    expect(pageURLSearch(page, 'account=&account=B&active=invalid&view=missing&extra=x'))
      .toBe('account=&account=B&active=invalid&view=missing');
  });

  it('replaces only when unknown keys are removed and does not require an adapter', () => {
    const replaceSearch = vi.fn();
    expect(initializeURLSearch(page, '?account=A&unknown=x', { replaceSearch })).toBe('account=A');
    expect(replaceSearch).toHaveBeenCalledExactlyOnceWith('account=A');
    initializeURLSearch(page, '?account=%41', { replaceSearch });
    expect(replaceSearch).toHaveBeenCalledTimes(1);
    expect(initializeURLSearch(page, 'account=A&extra=x')).toBe('account=A');
  });

  it('contains synchronous throws and asynchronous rejections from the host', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      replaceRuntimeSearch({ replaceSearch() { throw Error('sync'); } }, 'account=A');
      replaceRuntimeSearch({ replaceSearch: async () => { throw Error('async'); } }, 'account=A');
      await Promise.resolve();
      expect(warning).toHaveBeenCalledTimes(2);
    } finally { warning.mockRestore(); }
  });
});
