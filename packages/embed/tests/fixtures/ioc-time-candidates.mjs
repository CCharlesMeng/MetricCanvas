/** Complete local synthetic receipts; no private business codes or identity service. */
export function iocTimeCandidates(request){
 if(request.filterId==='months'){
  const window=request.calendarWindow;if(window?.granularity!=='month')return {kind:'unconfigured'};
  const values=[];let [year,month]=window.from.split('-').map(Number);
  for(let i=0;i<12;i++){const value=`${year}-${String(month).padStart(2,'0')}`;if(value<=window.to)values.push({value,label:value});if(++month===13){year++;month=1;}}
  return {kind:'values',candidates:values};
 }
 if(request.filterId==='model'&&request.dimension==='ioc_b4_model'&&request.constraints?.times?.period){
  const values=request.constraints.times.period.mode==='day'?['B','C']:['A','B'];return {kind:'values',candidates:values.map(value=>({value,label:`模型 ${value}`}))};
 }
}
