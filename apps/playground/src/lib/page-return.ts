import {createBrowserDrillReturn,type DrillReturnBrowser} from '@metriccanvas/engine/ui/navigation';

/** Page identity is independent of query parameters; provenance belongs to browser entries. */
export function playgroundPageIdentity(url: URL): string | undefined {
  const match = /^\/pages\/([^/]+)$/.exec(url.pathname);
  if (!match) return;
  try { return decodeURIComponent(match[1]!); } catch { return undefined; }
}
export function createPlaygroundPageReturn() {
  return createBrowserDrillReturn(playgroundPageIdentity);
}

/** SvelteKit's initial SPA replace happens after hooks.init and replaces Navigation API state. */
export function preserveInitialPageReturn(): void {
  const browser:DrillReturnBrowser=window;
  const returns=createPlaygroundPageReturn(),context=returns.current();
  const navigation=browser.navigation,key=navigation?.currentEntry?.key;
  if(!context||!key)return;
  returns.restore(context);
  navigation?.addEventListener?.('currententrychange',()=>{
    if(navigation.currentEntry?.key===key&&playgroundPageIdentity(new URL(location.href))===context.targetPageId)returns.restore(context);
  },{once:true});
}
