import type { ResolvedIocHeader } from './model';

export interface BrowserReturn {
  history: Pick<History, 'length' | 'back'>;
  navigation?: { canGoBack: boolean };
}

/** Explicit IOC return intent has a browser default; legacy toolbars keep their adapter contract. */
export function headerBackAction(
  model: Pick<ResolvedIocHeader, 'back' | 'legacyBack'>,
  onback: (() => void) | undefined,
  browser: BrowserReturn | undefined,
  returnContext?: {entryId:string;back?:()=>void}
): (() => void) | undefined {
  if (!model.back) return undefined;
  if (model.back === 'auto') return returnContext?.entryId ? returnContext.back ?? onback : undefined;
  if (onback) return onback;
  if (model.legacyBack || !browser) return undefined;
  const canGoBack = browser.navigation?.canGoBack ?? browser.history.length > 1;
  if (!canGoBack) return undefined;
  return () => browser.history.back();
}
