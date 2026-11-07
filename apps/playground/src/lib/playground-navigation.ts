import { projectNavigationInputs } from '@metriccanvas/engine';
import type { RuntimeNavigation } from '@metriccanvas/engine/ui';
import type {BrowserDrillReturn} from '@metriccanvas/engine/ui';

interface PreviewPages {
  has(pageId: string): boolean;
  load(pageId: string): Promise<unknown>;
}

interface PreviewNavigationOptions {
  baseURL(): string;
  visit(href: string): void | Promise<void>;
  returns?: BrowserDrillReturn;
  onReturnChange?(): void;
  rememberSource?: boolean;
}

type LocalTarget =
  | { kind: 'native'; href: string }
  | { kind: 'page'; href: string; pageId: string }
  | { kind: 'missing'; href: string };

/** Development-only routing: a URL's final path segment must exactly match a page filename/ID. */
export function resolvePlaygroundTarget(href: string, baseURL: string, pages: PreviewPages): LocalTarget {
  const url = new URL(href, baseURL);
  if (href.startsWith('#') || !['http:', 'https:'].includes(url.protocol)) return { kind: 'native', href };
  const segment = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  let pageId: string;
  try { pageId = decodeURIComponent(segment); }
  catch { return missingTarget(url); }
  if (!pages.has(pageId)) return missingTarget(url);
  return { kind: 'page', pageId, href: `/pages/${encodeURIComponent(pageId)}${url.search}${url.hash}` };
}

function missingTarget(url: URL): LocalTarget {
  return { kind: 'missing', href: `/navigation-target?href=${encodeURIComponent(url.href)}` };
}

export function createPlaygroundNavigation(pages: PreviewPages, options: PreviewNavigationOptions): RuntimeNavigation {
  return {
    resolveHref(href) {
      return resolvePlaygroundTarget(href, options.baseURL(), pages).href;
    },
    async resolveTargetInputs(href, { signal }) {
      const target = resolvePlaygroundTarget(href, options.baseURL(), pages);
      if (target.kind !== 'page' || signal.aborted) return undefined;
      const document = await pages.load(target.pageId);
      if (signal.aborted) return undefined;
      return projectNavigationInputs(document);
    },
    navigate(target) {
      if (target.href.startsWith('#')) return false;
      const base = new URL(options.baseURL());
      const url = new URL(target.href, base);
      if (url.origin !== base.origin) return false;
      const match = /^\/pages\/([^/]+)$/.exec(url.pathname);
      if (!match && url.pathname !== '/navigation-target') return false;
      const href = `${url.pathname}${url.search}${url.hash}`;
      if (options.returns && options.rememberSource && match) {
        void options.returns.navigate(href, target.sourcePageId, async value=>{await options.visit(value);}).then(options.onReturnChange).catch(error=>console.warn('[MetricCanvas][NAVIGATION_ERROR]',error));
      } else void options.visit(href);
      return true;
    }
  };
}
