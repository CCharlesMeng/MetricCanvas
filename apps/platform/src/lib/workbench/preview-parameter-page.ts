import {resolvePageParams,parsePage,type PageDocument} from '@metriccanvas/page';
import {initializePageParams,orchestrate,type DataGateway} from '@metriccanvas/engine';
/** Uses the existing gateway/runtime and waits for real terminal query states. */
export async function previewParameterPage(document:PageDocument,gateway:DataGateway,signal:AbortSignal):Promise<unknown> {
  signal.throwIfAborted();
  const result=resolvePageParams(document);if(!result.ok)throw Error(result.issues[0].message);
  const parsed=parsePage(document,{textValues:{values:result.effectiveInputs}});if(!parsed.ok)throw Error(parsed.errors[0].message);
  const page=initializePageParams(parsed.page,result.effectiveInputs);
  return new Promise((resolve,reject)=>{
    let stop=()=>{};
    const abort=()=>{stop();reject(new Error('预览已取消'));};signal.addEventListener('abort',abort,{once:true});
    stop=orchestrate(page,gateway).subscribe(snapshots=>{
      if([...snapshots.values()].some(s=>['idle','loading'].includes(s.status)))return;
      queueMicrotask(()=>{stop();signal.removeEventListener('abort',abort);const failed=[...snapshots.values()].find(s=>s.status==='error');
        if(failed?.status==='error')reject(Error(failed.error.message));else resolve([...snapshots]);});
    });
  });
}
