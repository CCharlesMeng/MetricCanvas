import { describe, expect, it, vi } from 'vitest';
import { browserNavigation, browserSearchURL } from '../src/browser-navigation';

describe('default Embed address replacement', () => {
  it('keeps the path and ordinary anchor, including encoded and repeated values', () => {
    expect(browserSearchURL('https://example.test/base/page?extra=x#section', 'account=A%2BB&dept=a&dept=b').href)
      .toBe('https://example.test/base/page?account=A%2BB&dept=a&dept=b#section');
  });

  it.each(['#/', '#!/'])('cleans both query areas and keeps accepted key ownership for %s', prefix => {
    const url = browserSearchURL(`https://example.test/shell?tenant=T&account=outer&junk=x${prefix}detail?account=inner&junk=y#section`,
      'tenant=T&account=inner&dept=a&dept=b');
    expect(url.search).toBe('?tenant=T');
    expect(url.hash).toBe(`${prefix}detail?account=inner&dept=a&dept=b#section`);
    expect(browserSearchURL(url.href, 'tenant=T&account=inner&dept=a&dept=b').href).toBe(url.href);
  });

  it('places new keys in a hash route without an existing query and removes empty question marks', () => {
    expect(browserSearchURL('https://example.test/#/detail', 'account=A').hash).toBe('#/detail?account=A');
    expect(browserSearchURL('https://example.test/?extra=x#/detail?extra=y#section', '').href)
      .toBe('https://example.test/#/detail#section');
  });

  it('lets a host override replaceSearch without losing its other callbacks', () => {
    const replaceSearch = vi.fn(), back = vi.fn();
    const navigation = browserNavigation({ replaceSearch, back, preserveSearchParams: ['tenant'] }, windowFixture());
    expect(navigation.replaceSearch).toBe(replaceSearch);
    expect(navigation.back).toBe(back);
    expect(navigation.preserveSearchParams).toEqual(['tenant']);
  });

  it('retains history state, replaces once and does not synthesize browser events', () => {
    const browser = windowFixture();
    const navigation = browserNavigation(undefined, browser);
    navigation.replaceSearch?.('account=A');
    expect(browser.history.replaceState).toHaveBeenCalledExactlyOnceWith({ navigationId: 7 }, '', 'https://example.test/page?account=A#section');
    navigation.replaceSearch?.('account=A');
    expect(browser.history.replaceState).toHaveBeenCalledTimes(1);
  });
});

function windowFixture(): Window {
  const location = { href: 'https://example.test/page?account=A&extra=x#section' };
  return { location,
    history: { state: { navigationId: 7 }, replaceState: vi.fn((_state, _title, href) => { location.href = String(href); }) } } as unknown as Window;
}
