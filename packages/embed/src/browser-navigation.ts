import {preserveNavigationEntry} from '@metriccanvas/engine/ui/navigation';
import type { RuntimeNavigation } from '@metriccanvas/engine/ui';

/** Preserve where accepted keys lived; new keys belong to the active hash route, when present. */
export function browserSearchURL(href: string, search: string): URL {
  const url = new URL(href);
  const route = /^(#!?\/[^?#]*)(?:\?([^#]*))?(#.*)?$/.exec(url.hash);
  if (!route) {
    url.search = search;
    return url;
  }
  const outerKeys = new Set(url.searchParams.keys());
  const routeKeys = new Set(new URLSearchParams(route[2]).keys());
  const outer = new URLSearchParams(), inner = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    (outerKeys.has(key) && !routeKeys.has(key) ? outer : inner).append(key, value);
  }
  url.search = outer.toString();
  const query = inner.toString();
  url.hash = route[1] + (query ? `?${query}` : '') + (route[3] ?? '');
  return url;
}

/** Embed supplies browser behavior only for the optional address-writing seam. */
export function browserNavigation(navigation: RuntimeNavigation | undefined, browser: Window): RuntimeNavigation {
  return {
    ...navigation,
    replaceSearch: navigation?.replaceSearch ?? (search => {
      const next = browserSearchURL(browser.location.href, search);
      if (next.href !== browser.location.href) preserveNavigationEntry(()=>browser.history.replaceState(browser.history.state, '', next.href),browser);
    })
  };
}
