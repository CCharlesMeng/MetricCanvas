import {mountPlatform} from '../lib/integration/mount';
import {portalConfig,type QiankunPlatformProps} from './portal-config';
let current:Awaited<ReturnType<typeof mountPlatform>>|undefined;
let queue=Promise.resolve();
function serial(action:()=>Promise<void>){const next=queue.then(action);queue=next.catch(()=>{});return next;}
export async function bootstrap() {}
export function mount(props:QiankunPlatformProps){return serial(async()=>{
  if(current)throw Error('平台只支持一个活动实例。');
  const config=portalConfig(props);
  const container=props.container?.querySelector<HTMLElement>('[data-metriccanvas-root]');
  if(!container)throw Error('缺少平台挂载容器。');
  // qiankun passes its owned wrapper, not the portal's outer container.
  const previousHeight=props.container.style.height;
  props.container.style.height='100%';
  try {
    const instance=await mountPlatform(container,config);
    current={...instance,destroy:async()=>{try {await instance.destroy();}finally {props.container.style.height=previousHeight;}}};
  } catch(error){props.container.style.height=previousHeight;throw error;}
});}
export function unmount(){return serial(async()=>{const instance=current;current=undefined;await instance?.destroy();});}
// qiankun 2 reads the sandbox's last assigned export. Native globalThis is not
// its proxy in every loader; bind lifecycle discovery explicitly to window.
Object.assign(window, {MetricCanvasPlatform:{bootstrap,mount,unmount}});
