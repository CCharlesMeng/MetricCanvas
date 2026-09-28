export type LeaveGuard = () => boolean | Promise<boolean>;
export function normalizeRouteBase(base: string): string {
  if (!base.startsWith('/') || /[?#\\]/.test(base) || base.includes('//') || /%|(?:^|\/)\.{1,2}(?:\/|$)/.test(base)) throw Error('routeBase 必须是绝对路径前缀。');
  return base.replace(/\/+$/, '');
}
export function isPlatformPath(path: string, base: string): boolean { return path === base || path.startsWith(`${base}/`); }
export function platformPath(base: string, path: string, params?: {pageId: string}): string {
  return `${base}${path.replace('[pageId]', encodeURIComponent(params?.pageId ?? ''))}`;
}
/** Own only prefix URLs. Portal handles cross-prefix guards before its navigation commit. */
export function createPlatformNavigation(container: HTMLElement, routeBase: string) {
  const base = normalizeRouteBase(routeBase);
  const stateKey = '__metriccanvasNavigation';
  const instance = crypto.randomUUID();
  let index = 0;
  let url = new URL(location.href);
  let destroyed = false, restoring = false, pending = false;
  const guards = new Map<LeaveGuard, () => boolean>(), listeners = new Set<(url: URL) => void>();
  const state = () => ({...history.state, [stateKey]:{instance,index}});
  history.replaceState(state(), '', url);
  function canLeave(): boolean | Promise<boolean> {
    const checks=[...guards.keys()];
    function check(index:number):boolean|Promise<boolean> {
      if(index===checks.length)return true;
      const result=checks[index]();
      return typeof result==='boolean' ? result && check(index+1) : result.then(allowed=>allowed && check(index+1));
    }
    return check(0);
  }
  function publish(next: URL) {url=next;for(const listener of listeners)listener(new URL(url));}
  async function navigate(target: string | URL, options: {replaceState?: boolean} = {}) {
    const next = new URL(target, url);
    if (next.origin !== url.origin || !isPlatformPath(next.pathname,base)) return false;
    if (destroyed || pending || next.href === url.href) return false;
    pending=true;
    try {
      if (!await canLeave() || destroyed) return false;
      if (!options.replaceState) index++;
      history[options.replaceState ? 'replaceState' : 'pushState'](state(), '', next);
      publish(next);return true;
    } finally {pending=false;}
  }
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self') return;
    const next = new URL(anchor.href, url);
    if (next.origin !== url.origin || !isPlatformPath(next.pathname, base)) return;
    event.preventDefault();void navigate(next);
  };
  const pop = async () => {
    if (destroyed) return;
    if (restoring) {restoring=false;return;}
    const next = new URL(location.href);
    if (!isPlatformPath(next.pathname,base)) return;
    const entry = history.state?.[stateKey];
    const allowed = !pending && await canLeave();
    if (destroyed) return;
    if (allowed) {index=entry?.instance === instance ? entry.index : index;publish(next);}
    else if (entry?.instance === instance && entry.index !== index) {restoring=true;history.go(index-entry.index);}
    else history.replaceState(state(),'',url);
  };
  const unload = (event: BeforeUnloadEvent) => {if([...guards.values()].some(dirty=>dirty())){event.preventDefault();event.returnValue='';}};
  container.addEventListener('click',click);
  window.addEventListener('popstate',pop);
  window.addEventListener('beforeunload',unload);
  return {base, resolve:(path:string,params?:{pageId:string})=>platformPath(base,path,params),navigate,canLeave,
    current:()=>new URL(url),
    subscribe(listener:(url:URL)=>void){listeners.add(listener);listener(new URL(url));return()=>{listeners.delete(listener);};},
    registerGuard(guard:LeaveGuard, dirty:()=>boolean = ()=>true){guards.set(guard,dirty);return()=>{guards.delete(guard);};},
    destroy(){destroyed=true;container.removeEventListener('click',click);window.removeEventListener('popstate',pop);window.removeEventListener('beforeunload',unload);listeners.clear();guards.clear();}};
}
export type PlatformNavigation = ReturnType<typeof createPlatformNavigation>;
