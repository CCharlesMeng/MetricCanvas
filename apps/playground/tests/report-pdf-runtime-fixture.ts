import { mount, unmount } from 'svelte';
import RuntimeView from '../../../packages/engine/runtime-ui/src/RuntimeView.svelte';
import type { RuntimeDataGateway } from '@metriccanvas/engine';

export function mountPdfRuntimeFixture(target: HTMLElement, input: unknown, dataGateway?: RuntimeDataGateway) {
  const document = structuredClone(input) as any;
  document.schemaVersion = '6.28';
  const header = document.sections.flatMap((section:any)=>section.components).find((component:any)=>component.type==='reportHeader');
  if (!header || document.layoutForm === 'dashboard') throw Error('PDF fixture requires a Report header');
  header.props.pdfExport = {filename:'runtime-fidelity'};
  const runtime = mount(RuntimeView, {target,props:{document,dataGateway}});
  return {
    dispose: () => unmount(runtime),
    async export(consume: (view:HTMLElement)=>void) {
      const button = target.querySelector<HTMLButtonElement>('[data-report-pdf-download]');
      if (!button) throw Error('PDF button missing');
      const OriginalWorker = window.Worker;
      let facts:{pageCount:number}|undefined;
      window.Worker = class extends OriginalWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url,options);
          const view = target.ownerDocument.querySelector<HTMLIFrameElement>('[data-report-export-frame]')?.contentDocument?.querySelector<HTMLElement>('[data-export-view]');
          if (view) {
            consume(view);
            const width=view.getBoundingClientRect().width,height=view.getBoundingClientRect().height;
            const landscape=!!view.querySelector('[data-export-orientation="landscape"]');
            facts={pageCount:Math.ceil(height/Math.floor(width*(landscape?210/297:297/210)))};
          }
        }
      };
      try {
        button.click();
        await new Promise<void>((resolve,reject)=>{
          const deadline=performance.now()+60_000;
          const inspect=()=>{
            if(performance.now()>deadline)return reject(Error('PDF fixture timed out'));
            if(!button.disabled){if(button.title)return reject(Error(button.title));return resolve();}
            setTimeout(inspect,10);
          };setTimeout(inspect,0);
        });
        if(!facts)throw Error('PDF Worker did not start');
        return facts;
      } finally {window.Worker=OriginalWorker;}
    }
  };
}
