import { mount, unmount, tick } from 'svelte';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from '../../runtime/src';
import { prepareExportSnapshots, ExportViewError, EXPORT_PREPARATION_TIMEOUT_MS } from '../../runtime/src/export-snapshots';
import ExportView from './ExportView.svelte';
import type { ExportRenderState } from './export-render-state';

import type { ExportViewConsumer, ExportViewOptions } from './export-types';

export async function withPreparedExportView<T>(input:{state:ExportRenderState;queries:ReadonlyMap<string,EffectiveQuery>;gateway:RuntimeDataGateway;sourceRoot:HTMLElement;controller:AbortController}, consume:ExportViewConsumer<T>,options:ExportViewOptions={}):Promise<T> {
  const {state,controller,sourceRoot}=input;
  const signal=controller.signal;
  const abort=()=>controller.abort(new ExportViewError('EXPORT_CANCELLED','导出已取消'));
  options.signal?.addEventListener('abort',abort,{once:true});
  if(options.signal?.aborted)abort();
  const timer=setTimeout(()=>controller.abort(new ExportViewError('EXPORT_TIMEOUT','导出准备超过 60 秒')),EXPORT_PREPARATION_TIMEOUT_MS);
  const holder=sourceRoot.ownerDocument.createElement('div');
  holder.dataset.metriccanvasExportStage='';
  holder.setAttribute('aria-hidden','true');
  holder.inert=true;
  holder.style.cssText='position:fixed;left:-100000px;top:0;width:794px;pointer-events:none;';
  // Preserve the instance's inherited theme, font and shadow-root styling.
  const style=getComputedStyle(sourceRoot);
  for(const name of Array.from(style)) if(name.startsWith('--mc-')||['font-family','font-size','line-height','color'].includes(name)) holder.style.setProperty(name,style.getPropertyValue(name));
  const root=sourceRoot.getRootNode();
  const parent=root instanceof ShadowRoot?root:sourceRoot.ownerDocument.body;
  let instance:ReturnType<typeof mount>|undefined;
  try {
    state.snapshots=await abortable(prepareExportSnapshots(state.page,input.gateway,input.queries,state.filters,signal,undefined,state.currentYear),signal);
    signal.throwIfAborted();
    parent.appendChild(holder);
    instance=mount(ExportView,{target:holder,props:{state}});
    await tick();
    const target=holder.querySelector<HTMLElement>('[data-export-view]');
    if(!target) throw new ExportViewError('EXPORT_RENDER_FAILED','导出视图未挂载');
    await abortable(prepareDom(target,signal),signal);
    signal.throwIfAborted();
    clearTimeout(timer); // Host PDF encoding and saving are outside the engine's deadline.
    return await abortable(consume({target,pageId:state.page.id,paper:'A4',wideElements:Array.from(target.querySelectorAll<HTMLElement>('[data-export-orientation="landscape"]')),signal}),signal);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort',abort);
    controller.abort(new ExportViewError('EXPORT_CANCELLED','导出视图生命周期已结束'));
    try {if(instance)await unmount(instance);} finally {holder.remove();}
  }
}
function abortable<T>(work:Promise<T>,signal:AbortSignal):Promise<T> {
  if(signal.aborted){void work.catch(()=>{});return Promise.reject(signal.reason);}
  return new Promise((resolve,reject)=>{
    const aborted=()=>reject(signal.reason);
    signal.addEventListener('abort',aborted,{once:true});
    work.then(resolve,reject).finally(()=>signal.removeEventListener('abort',aborted));
  });
}
async function frame(signal:AbortSignal) {
  signal.throwIfAborted();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  signal.throwIfAborted();
}
async function prepareDom(target:HTMLElement,signal:AbortSignal) {
  await target.ownerDocument.fonts.ready;
  await frame(signal); await frame(signal);
  for(const section of target.querySelectorAll<HTMLElement>('[data-section-id]')) {
    if(section.scrollWidth>section.clientWidth+1) {
      section.dataset.exportOrientation='landscape';
      const width=Math.max(1047,section.scrollWidth);
      section.style.width=`${width}px`;
      section.dataset.exportNaturalWidth=String(width);
      target.style.width=`${Math.max(target.offsetWidth,width+76)}px`;
    } else {section.style.width=`${section.clientWidth}px`;
    }
  }
  await frame(signal); await frame(signal);
  // Wait for all mounted charts to finish their static option and responsive resize.
  while(target.querySelector('[data-export-pending="true"]')||Array.from(target.querySelectorAll<HTMLElement>('[data-export-chart]')).some(chart=>chart.dataset.exportChartReady!=='true')) await frame(signal);
  for(const chart of target.querySelectorAll<HTMLElement>('[data-export-chart]')) {
    const images=Array.from(chart.querySelectorAll<HTMLCanvasElement>('canvas')).map(canvas=>{
      const image=target.ownerDocument.createElement('img');
      try {image.src=canvas.toDataURL('image/png');}
      catch {throw new ExportViewError('EXPORT_RENDER_FAILED','图表画布无法生成静态导出图像');}
      image.style.cssText=canvas.style.cssText;
      image.style.width=`${canvas.getBoundingClientRect().width}px`;
      image.style.height=`${canvas.getBoundingClientRect().height}px`;
      image.alt='图表';return image;
    });
    chart.dispatchEvent(new Event('metriccanvas:freeze-export-chart'));
    chart.replaceChildren(...images);
  }
  await Promise.all(Array.from(target.querySelectorAll<HTMLImageElement>('img')).map(async image=>{
    signal.throwIfAborted();
    try {await image.decode();} catch {throw new ExportViewError('EXPORT_RENDER_FAILED','导出图片未能完整加载');}
  }));
  await frame(signal);
}
