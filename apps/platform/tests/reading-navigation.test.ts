import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createReadingRuntimeNavigation} from '../src/lib/integration/reading-navigation';
import type {PlatformServices} from '../src/lib/integration/services';
it('translates canonical reading URLs, projects actual target inputs and preserves repeated explicit values',async()=>{
 const document=JSON.parse(readFileSync('pages/capabilities/ioc-header/scenarios/ioc-header-navigation-detail-demo.json','utf8'));
 const navigate=vi.fn(async()=>true),replaceSearch=vi.fn();
 const services={navigation:{base:'/metrics',current:()=>new URL('https://portal.test/metrics/manage/pages/source?resource=r1'),navigate,replaceSearch},pageAssets:{resolve:vi.fn(async()=>({pageId:document.id,resourceId:'target-r'})),read:vi.fn(async()=>({pageId:document.id,document}))}} as unknown as Pick<PlatformServices,'navigation'|'pageAssets'>;
 const adapter=createReadingRuntimeNavigation(services),href='/pages/'+document.id+'?project-id=P&project-name=N&origin=O&regions=north&regions=south#title';
 expect(adapter.resolveHref!(href)).toBe('https://portal.test/metrics/manage/pages/'+document.id+'?project-id=P&project-name=N&origin=O&regions=north&regions=south#title');
 const controller=new AbortController(),contract=await adapter.resolveTargetInputs!(href,{signal:controller.signal});expect(contract?.pageId).toBe(document.id);expect(Object.keys(contract!)).toEqual(['pageId','params','filters']);
 expect(adapter.navigate!({href})).toBe(true);expect(navigate).toHaveBeenCalledOnce();adapter.replaceSearch!('month=2026-09');expect(replaceSearch).toHaveBeenCalledWith('month=2026-09&resource=r1');
 controller.abort();expect(await adapter.resolveTargetInputs!(href,{signal:controller.signal})).toBeUndefined();expect(adapter.navigate!({href:'https://external.test/pages/x'})).toBe(false);
});
