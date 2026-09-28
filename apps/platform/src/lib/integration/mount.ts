import {mount,unmount,tick} from 'svelte';
import PlatformRoot from '../PlatformRoot.svelte';
import {createPlatformSession} from './session';
import {createPlatformNavigation} from './navigation';
import {createPlatformServices} from './services';
import type {PlatformPortalProps} from './contract';
import type {AuthoringIntegration} from '../dialogue/authoring-integration';
type PlatformProps = PlatformPortalProps<AuthoringIntegration>;
export async function mountPlatform(container:HTMLElement, props:PlatformProps, embedded=true) {
  const target=document.createElement('div');target.style.height='100%';container.append(target);
  let component:ReturnType<typeof mount>|undefined;
  let session:ReturnType<typeof createPlatformSession>|undefined;
  let navigation:ReturnType<typeof createPlatformNavigation>|undefined;
  let releaseGuard:(()=>void)|undefined;
  let destroyed:Promise<void>|undefined;
  const destroy=()=>destroyed??=(async()=>{
    const failures:unknown[]=[];
    for(const cleanup of [()=>session?.destroy(),()=>releaseGuard?.(),()=>navigation?.destroy()]) {
      try {cleanup();} catch(error){failures.push(error);}
    }
    try {if(component)await unmount(component);} catch(error){failures.push(error);} finally {target.remove();}
    if(failures.length)throw new AggregateError(failures,'平台清理失败。');
  })();
  try {
    session=createPlatformSession(props);
    navigation=createPlatformNavigation(target,props.routeBase);
    const services=createPlatformServices(session,navigation,{...props,embedded});
    releaseGuard=props.registerLeaveGuard?.(navigation.canLeave);
    component=mount(PlatformRoot,{target,props:{services}});
    await tick();
    props.onEvent?.({code:'ready',message:'平台已挂载；业务数据按需加载。'});
    return {destroy,services};
  } catch(error){await destroy();throw error;}
}
