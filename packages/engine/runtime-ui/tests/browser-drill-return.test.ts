import {expect,it,vi} from 'vitest';
import {createBrowserDrillReturn,preserveNavigationEntry,type DrillReturnBrowser} from '../src/browser-drill-return';

function fixture(){
 let serial=0;
 const rows:Array<{key:string;index:number;url:string;getState:()=>unknown;state?:unknown}>=[];
 const location={href:'https://test/pages/list?region=north'};
 const navigation={currentEntry:null as typeof rows[number]|null,entries:()=>rows,updateCurrentEntry({state}:{state:unknown}){navigation.currentEntry!.state=state;}};
 const browser:DrillReturnBrowser={location,navigation};
 const visit=vi.fn(async(href:string)=>{location.href=new URL(href,location.href).href;const row={key:String(++serial),index:rows.length,url:location.href,getState:():unknown=>row.state,state:undefined as unknown};rows.push(row);navigation.currentEntry=row;});
 const tracker=createBrowserDrillReturn(url=>/^\/pages\/([^/]+)$/.exec(url.pathname)?.[1],browser);
 return {rows,location,navigation,browser,visit,tracker};
}
it('returns the source URL after same-detail edits and refresh; preserves unrelated entry state',async()=>{
 const f=fixture();await f.visit(f.location.href);
 await f.tracker.navigate('/pages/detail?project=1','list',f.visit);
 const source=f.tracker.current();expect(source?.sourceHref).toBe('https://test/pages/list?region=north');
 await f.visit('/pages/detail?project=2');expect(f.tracker.current()?.entryId).toBe(source?.entryId);
 const remount=createBrowserDrillReturn(url=>url.pathname.split('/').at(-1),f.browser);
 expect(remount.current()?.entryId).toBe(source?.entryId);
 preserveNavigationEntry(()=>{f.navigation.currentEntry!.state=undefined;},f.browser);
 expect(f.tracker.current()?.entryId).toBe(source?.entryId);
 await f.tracker.back(f.visit);expect(f.location.href).toBe('https://test/pages/list?region=north');
 expect(f.tracker.current()).toBeUndefined();
});
it('does not resurrect old sources across unrelated pages, external gaps, new tabs or URL input',async()=>{
 const f=fixture();await f.visit(f.location.href);await f.tracker.navigate('/pages/detail','list',f.visit);
 await f.visit('/outside');await f.visit('/pages/detail?from=list');expect(f.tracker.current()).toBeUndefined();
 f.rows.splice(0,f.rows.length-1);f.rows[0]!.index=0;expect(f.tracker.current()).toBeUndefined();
 const tab=fixture();await tab.visit('/pages/detail');expect(tab.tracker.current()).toBeUndefined();
});
it('nested drill-through returns to the immediate source and retains its own return provenance',async()=>{
 const f=fixture();await f.visit(f.location.href);await f.tracker.navigate('/pages/detail','list',f.visit);
 await f.tracker.navigate('/pages/subdetail','detail',f.visit);
 await f.tracker.back(f.visit);expect(f.location.href).toBe('https://test/pages/detail');
 expect(f.tracker.current()?.sourceHref).toBe('https://test/pages/list?region=north');
 await f.tracker.back(f.visit);expect(f.location.href).toContain('/pages/list?region=north');
});
it('failed, cancelled, mismatched and stale navigations never commit provenance',async()=>{
 const f=fixture();await f.visit(f.location.href);
 await expect(f.tracker.navigate('/pages/detail','list',async()=>{throw Error('failed');})).rejects.toThrow('failed');
 expect(await f.tracker.navigate('/pages/detail','list',async()=>false)).toBe(false);
 await f.tracker.navigate('/pages/detail','draft',f.visit);expect(f.tracker.current()).toBeUndefined();
 await f.visit('/pages/list');let finish!:()=>void;
 const pending=f.tracker.navigate('/pages/detail','list',async()=>{await new Promise<void>(r=>finish=r);});
 await f.tracker.navigate('/pages/other','list',f.visit);finish();expect(await pending).toBe(false);
 expect(f.tracker.current()?.targetPageId).toBe('other');
});
it('fails closed when history is opaque, unavailable or malformed',async()=>{
 expect(createBrowserDrillReturn(()=> 'detail',undefined).current()).toBeUndefined();
 const f=fixture();await f.visit('/pages/detail');f.navigation.currentEntry!.state={__metriccanvasDrillReturn:{entryId:'bad',targetPageId:'detail',sourceHref:':::'}};
 expect(f.tracker.current()).toBeUndefined();
 f.navigation.entries=()=>{throw Error('unavailable');};expect(f.tracker.current()).toBeUndefined();
});
it('a corrupted current record cannot resurrect an older same-detail source',async()=>{
 const f=fixture();await f.visit(f.location.href);await f.tracker.navigate('/pages/detail?project=1','list',f.visit);
 await f.visit('/pages/detail?project=2');f.navigation.currentEntry!.state={__metriccanvasDrillReturn:{entryId:'broken'}};
 expect(f.tracker.current()).toBeUndefined();
});
it('cancelling a deeper drill preserves the current valid return source',async()=>{
 const f=fixture();await f.visit(f.location.href);await f.tracker.navigate('/pages/detail','list',f.visit);
 const original=f.tracker.current();expect(await f.tracker.navigate('/pages/subdetail','detail',async()=>false)).toBe(false);
 expect(f.tracker.current()).toEqual(original);
});
it('entry subscribers invalidate asynchronously and stop after disposal',async()=>{
 const f=fixture(),events=new EventTarget(),changed=vi.fn();
 f.browser.navigation={...f.navigation,addEventListener:(type,listener)=>events.addEventListener(type,listener),removeEventListener:(type,listener)=>events.removeEventListener(type,listener)};
 const stop=f.tracker.subscribe(changed);events.dispatchEvent(new Event('currententrychange'));expect(changed).not.toHaveBeenCalled();
 stop();await Promise.resolve();expect(changed).not.toHaveBeenCalled();
 const off=f.tracker.subscribe(changed);events.dispatchEvent(new Event('currententrychange'));await Promise.resolve();expect(changed).toHaveBeenCalledOnce();off();
});

it('does not overwrite opaque application entry state',async()=>{
 const f=fixture();await f.visit(f.location.href);f.navigation.currentEntry!.state=42;
 await f.tracker.navigate('/pages/detail','list',async href=>{await f.visit(href);f.navigation.currentEntry!.state='application-owned';});
 expect(f.navigation.currentEntry!.state).toBe('application-owned');expect(f.tracker.current()).toBeUndefined();
});
