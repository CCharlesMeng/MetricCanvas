import { mount, unmount, tick } from 'svelte';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from '../../runtime/src';
import { prepareExportSnapshots, ExportViewError, EXPORT_PREPARATION_TIMEOUT_MS } from '../../runtime/src/export-snapshots';
import ExportView from './ExportView.svelte';
import type { ExportRenderState } from './export-render-state';

import { reportScheduler } from './report-scheduler';
interface ReportView {target:HTMLElement;signal:AbortSignal}

export async function withReportView<T>(input:{state:ExportRenderState;queries:ReadonlyMap<string,EffectiveQuery>;gateway:RuntimeDataGateway;sourceRoot:HTMLElement;controller:AbortController;program?:import('@metriccanvas/data-execution/runtime').SourceProgram}, consume:(view:ReportView)=>Promise<T>):Promise<T> {
  const {state,controller,sourceRoot}=input;
  const signal=controller.signal;
  const timer=setTimeout(()=>controller.abort(new ExportViewError('EXPORT_TIMEOUT','导出准备超过 60 秒')),EXPORT_PREPARATION_TIMEOUT_MS);
  const holder=sourceRoot.ownerDocument.createElement('div');
  holder.dataset.metriccanvasExportStage='';
  holder.setAttribute('aria-hidden','true');
  holder.inert=true;
  const content=sourceRoot.querySelector<HTMLElement>('.page-content')??sourceRoot;
  const contentWidth=content.getBoundingClientRect().width;
  const runtimeWidth=sourceRoot.getBoundingClientRect().width;
  holder.style.cssText=`position:fixed;left:-100000px;top:0;width:${runtimeWidth}px;container:mc-runtime / inline-size;pointer-events:none;`;
  // Preserve the instance's inherited theme, font and shadow-root styling.
  const style=getComputedStyle(content);
  for(const name of Array.from(style)) if(name.startsWith('--mc-')||['font-family','font-size','line-height','color'].includes(name)) holder.style.setProperty(name,style.getPropertyValue(name));
  holder.style.backgroundColor=style.backgroundColor;
  holder.style.backgroundImage=style.backgroundImage;
  const sections=sourceRoot.querySelector<HTMLElement>('.page-sections');
  const sectionStyle=sections?getComputedStyle(sections):undefined;
  const padding=['top','right','bottom','left'].map(side=>`${parseFloat(style.getPropertyValue(`padding-${side}`))+(sectionStyle?parseFloat(sectionStyle.getPropertyValue(`padding-${side}`)):0)}px`).join(' ');
  const gap=sectionStyle?.gap??'16px';
  const root=sourceRoot.getRootNode();
  const parent=root instanceof ShadowRoot?root:sourceRoot.ownerDocument.body;
  const objectUrls:string[]=[];
  let instance:ReturnType<typeof mount>|undefined;
  try {
    const prepared=await abortable(prepareExportSnapshots(state.page,input.gateway,input.queries,state.filters,signal,undefined,state.currentYear,[],state.sourceViews,input.program,{allowPartial:true}),signal);
    for(const [id,snapshot] of prepared) {
      const captured=state.snapshots.get(id);
      if(snapshot.status==='error' && (captured?.status==='ready'||captured?.status==='empty')) {
        prepared.set(id,captured);
        console.warn('[MetricCanvas][EXPORT_PARTIAL_DATA] 导出重新取数失败；保留点击下载时已取得的数据，完整性未确认', {
          code:'EXPORT_PARTIAL_DATA',pageId:state.page.id,dataSourceId:id,
          accumulatedRowCount:captured.status==='ready'?captured.rows.length:0,completeness:'unverified'
        });
      }
    }
    state.snapshots=prepared;
    signal.throwIfAborted();
    parent.appendChild(holder);
    // Establish the visible box before charts mount; post-mount resizing can look like overflow.
    instance=mount(ExportView,{target:holder,props:{state,width:contentWidth,padding,gap}});
    await tick();
    const target=holder.querySelector<HTMLElement>('[data-export-view]');
    if(!target) throw new ExportViewError('EXPORT_RENDER_FAILED','导出视图未挂载');
    await abortable(prepareDom(target,signal,objectUrls),signal);
    signal.throwIfAborted();
    clearTimeout(timer); // Host PDF encoding and saving are outside the engine's deadline.
    return await abortable(consume({target,signal}),signal);
  } finally {
    clearTimeout(timer);
    controller.abort(new ExportViewError('EXPORT_CANCELLED','导出视图生命周期已结束'));
    for(const url of objectUrls)URL.revokeObjectURL(url);
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
async function prepareDom(target:HTMLElement,signal:AbortSignal,objectUrls:string[]) {
  await target.ownerDocument.fonts.ready;
  await frame(signal); await frame(signal);
  const style=getComputedStyle(target);
  const padding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight);
  for(const section of target.querySelectorAll<HTMLElement>('[data-section-id]')) {
    // A page header can intentionally bleed into the canvas padding; that is not a wide table.
    const bleed=section.querySelector('[data-component-type="reportHeader"]')?(parseFloat(style.getPropertyValue('--mc-page-content-padding-inline'))||0):0;
    if(section.scrollWidth>section.clientWidth+bleed+1) {
      section.dataset.exportOrientation='landscape';
      const width=Math.max(1047,section.scrollWidth);
      section.style.width=`${width}px`;
      section.dataset.exportNaturalWidth=String(width);
      target.style.width=`${Math.max(target.offsetWidth,width+padding)}px`;
    } else {section.style.width=`${section.clientWidth}px`;
    }
  }
  await frame(signal); await frame(signal);
  // Wait for all mounted charts to finish their static option and responsive resize.
  while(target.querySelector('[data-export-pending="true"]')||Array.from(target.querySelectorAll<HTMLElement>('[data-export-chart]')).some(chart=>chart.dataset.exportChartReady!=='true')) await frame(signal);
  const pause=reportScheduler(signal);
  for(const chart of target.querySelectorAll<HTMLElement>('[data-export-chart]')) {
    const images:HTMLImageElement[]=[];
    for(const canvas of chart.querySelectorAll<HTMLCanvasElement>('canvas')) {
      const pending=pause();if(pending)await pending;
      const image=target.ownerDocument.createElement('img');
      try {
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('图表图片编码失败')),'image/png'));
        image.src=URL.createObjectURL(blob);objectUrls.push(image.src);
      }
      catch {throw new ExportViewError('EXPORT_RENDER_FAILED','图表画布无法生成静态导出图像');}
      image.style.cssText=canvas.style.cssText;
      image.style.width=`${canvas.getBoundingClientRect().width}px`;
      image.style.height=`${canvas.getBoundingClientRect().height}px`;
      image.alt='图表';images.push(image);
    }
    chart.dispatchEvent(new Event('metriccanvas:freeze-export-chart'));
    chart.replaceChildren(...images);
  }
  await Promise.all(Array.from(target.querySelectorAll<HTMLImageElement>('img')).map(async image=>{
    signal.throwIfAborted();
    try {await image.decode();} catch {throw new ExportViewError('EXPORT_RENDER_FAILED','导出图片未能完整加载');}
  }));
  await frame(signal);
}
