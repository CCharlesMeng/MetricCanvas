/** Test host owned trusted input, deliberately outside Page/URL. Local synthetic only. */
export function createTimeInputs(){
 let snapshot={permissions:{},values:{'period-details':{status:'ready',value:true}},permissionRevision:'synthetic-user-1',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready',granularity:'month',latest:'2026-10',latestComplete:'2026-09',missingRanges:[{from:'2026-07',to:'2026-07'}],refreshedAt:'2026-10-19T02:00:00Z',generatedAt:'2026-10-19T03:00:00Z'}}};
 const listeners=new Set();
 return {getSnapshot:()=>structuredClone(snapshot),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},setSnapshot(next){snapshot=structuredClone(next);for(const listener of listeners)listener(structuredClone(snapshot));},setStatus(status){this.setSnapshot({...snapshot,periods:{...snapshot.periods,sales:{status}}});},reset(){this.setSnapshot({...snapshot,periods:{sales:{status:'ready',granularity:'month',latest:'2026-10',latestComplete:'2026-09',missingRanges:[{from:'2026-07',to:'2026-07'}],refreshedAt:'2026-10-19T02:00:00Z',generatedAt:'2026-10-19T03:00:00Z'}}});}};
}
export function timeInputsPanel(source,remount){
 const panel=document.createElement('aside');panel.setAttribute('aria-label','合成期间事实控制');panel.style.cssText='padding:10px;display:flex;flex-wrap:wrap;gap:8px;font:13px sans-serif;background:#f5f8ff';
 const label=document.createElement('span');label.textContent='本地合成输入：';panel.append(label);
 for(const [label,action]of [['隐藏期间说明',()=>source.setSnapshot({...source.getSnapshot(),values:{'period-details':{status:'ready',value:false}}})],['显示期间说明',()=>source.setSnapshot({...source.getSnapshot(),values:{'period-details':{status:'ready',value:true}}})],['事实等待',()=>source.setStatus('loading')],['事实恢复',()=>source.reset()],['事实错误',()=>source.setStatus('error')],['身份变化',()=>source.setSnapshot({...source.getSnapshot(),permissionRevision:'synthetic-user-2'})],['重新挂载',remount]]){
  const button=document.createElement('button');button.textContent=label;button.onclick=action;panel.append(button);
 }
 document.body.prepend(panel);
}
