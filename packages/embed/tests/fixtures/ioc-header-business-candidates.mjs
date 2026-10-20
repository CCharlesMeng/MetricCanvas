/** Local synthetic Adapter fixture. Stable codes intentionally repeat across levels. */
export function iocBusinessCandidates(request) {
  if(request.filterId==='region')return {kind:'values',candidates:[
    {level:'department',value:'same',label:'北部地区部'},
    {level:'department',value:'south',label:'南部地区部'},
    {level:'office',value:'same',label:'北京代表处',parent:{level:'department',value:'same'}},
    {level:'office',value:'office-south',label:'深圳代表处',parent:{level:'department',value:'south'}}
  ]};
  if(request.filterId!=='model')return {kind:'unconfigured'};
  const month=request.constraints?.times?.period?.from?.slice(0,7);
  if(month==='2026-06')return {kind:'denied'};
  if(month==='2026-05')return {kind:'unconfigured'};
  if(month==='2026-04')return {kind:'values',candidates:[]};
  const values=month==='2026-08'?['B']:month==='2026-07'?['C']:['A','B','C'];
  return {kind:'values',candidates:values.map(value=>({value,label:`模型 ${value}`}))};
}
