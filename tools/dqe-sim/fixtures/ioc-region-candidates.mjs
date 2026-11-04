import dictionary from './ioc-dimension-values.json' with {type:'json'};
/** Complete local demonstration tree, preserving explicit dictionary parent codes. */
export function iocRegionCandidates(request,options={}){
 if(request.filterId!=='region')return;
 const all=[['geo','geo-pc-code'],['region-dept','region-dept-code'],['office','rep-office-code']];
 const levels=request.dimension==='region-code'||options.includeGeo===false?all.slice(1):all;
 if(!['geo-pc-code','region-dept-code','rep-office-code','region-code','region-dept-name','rep-office-name'].includes(request.dimension))return;
 const valueOf=(level,item)=>options.names&&level!=='geo'?item.label??item.value:item.value;
 const parentOf=(level,dimension,value)=>valueOf(level,dictionary.dimensions[dimension].values.find(item=>item.value===value));
 const candidates=levels.flatMap(([level,dimension],index)=>dictionary.dimensions[dimension].values.map(item=>({
  level,value:valueOf(level,item),label:item.label??item.value,
  ...(index>0&&item.of?{parent:{level:levels[index-1][0],value:parentOf(levels[index-1][0],levels[index-1][1],item.of)}}:{})
 })));
 if(options.names&&levels[0][0]==='geo')candidates.unshift({level:'geo',value:'全球',label:'全球'});
 return {kind:'values',candidates};
}
