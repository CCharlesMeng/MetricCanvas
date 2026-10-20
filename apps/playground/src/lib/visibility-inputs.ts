import type {DisplayInputs,DisplaySnapshot} from '@metriccanvas/engine';
/** Explicit development-only fact source; never serialized into page metadata. */
export function createVisibilityDemoInputs(){
 let revision=0;
 let snapshot:DisplaySnapshot={permissionRevision:'sim-0',permissions:{'department.read':{status:'pending'}},values:{ready:{status:'pending'}}};
 const subscribers=new Set<(snapshot:DisplaySnapshot)=>void>();
 const source:DisplayInputs={getSnapshot:()=>snapshot,subscribe(run){subscribers.add(run);run(snapshot);return ()=>subscribers.delete(run);}};
 function publish(status:'allow'|'deny'|'pending'|'error'|'revoke'){
  if(status==='revoke')revision++;
  const input=status==='pending'||status==='error'?{status} as const:{status:'ready' as const,value:status!=='deny'};
  snapshot={permissionRevision:`sim-${revision}`,permissions:{'department.read':input},values:{ready:input}};
  for(const run of subscribers)run(snapshot);
 }
 return {source,publish};
}
