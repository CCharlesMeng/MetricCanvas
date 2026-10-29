import dictionary from './ioc-dimension-values.json' with {type:'json'};
/** Complete local demonstration tree, preserving explicit dictionary parent codes. */
export function iocRegionCandidates(request){
 if(request.filterId!=='region')return;
 const all=[['geo','geo-pc-code'],['region-dept','region-dept-code'],['office','rep-office-code']];
 const levels=request.dimension==='region-code'?all.slice(1):all;
 if(!['geo-pc-code','region-dept-code','rep-office-code','region-code'].includes(request.dimension))return;
 const candidates=levels.flatMap(([level,dimension],index)=>dictionary.dimensions[dimension].values.map(item=>({
  level,value:item.value,label:item.label??item.value,
  ...(index>0&&item.of?{parent:{level:levels[index-1][0],value:item.of}}:{})
 })));
 return {kind:'values',candidates};
}
