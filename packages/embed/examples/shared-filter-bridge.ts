import type { FilterDeclaration } from '@metriccanvas/page/internal';

/** Host example: one active page, explicit shared-key to public-filter bindings. */
export type SharedFilterBindings = Readonly<Record<string,string>>;
interface Entry { signature:string; parts:Record<string,string[]> }
export type SharedFilterSnapshot = Record<string,Entry>;

function signature(filter:FilterDeclaration):string {
  if(filter.type==='dimension')return JSON.stringify([filter.type,filter.dimension,filter.hierarchy]);
  if(filter.type==='timePoint')return JSON.stringify([filter.type,filter.granularity]);
  return filter.type;
}
function keys(filter:FilterDeclaration):Record<string,string> {
  return filter.type==='dimension'
    ? {value:filter.urlParams?.value??filter.id,level:filter.urlParams?.level??`${filter.id}.level`}
    : {value:filter.urlParams?.value??filter.id};
}
function publicBindings(filters:readonly FilterDeclaration[],bindings:SharedFilterBindings) {
  return Object.entries(bindings).flatMap(([shared,id])=>{
    const filter=filters.find(item=>item.id===id);
    if(!filter||!['boolean','dimension','timePoint'].includes(filter.type))return [];
    return [{shared,filter}];
  });
}
/** Input must be public declarations from projectNavigationInputs, never detail-private filters. */
export function createSharedFilterBridge(initial:SharedFilterSnapshot={}) {
  const entries:SharedFilterSnapshot=structuredClone(initial);
  return {
    snapshot:()=>structuredClone(entries),
    initialSearch(filters:readonly FilterDeclaration[],search:string,bindings:SharedFilterBindings):string {
      const query=new URLSearchParams(search);
      for(const {shared,filter} of publicBindings(filters,bindings)){
        const target=keys(filter),entry=entries[shared];
        if(!entry||entry.signature!==signature(filter)||Object.values(target).some(key=>query.has(key)))continue;
        for(const [part,values] of Object.entries(entry.parts)){
          if(target[part])for(const value of values)query.append(target[part],value);
        }
      }
      return query.toString();
    },
    recordSearch(filters:readonly FilterDeclaration[],search:string,bindings:SharedFilterBindings):void {
      const query=new URLSearchParams(search);
      for(const {shared,filter} of publicBindings(filters,bindings)){
        const parts=Object.fromEntries(Object.entries(keys(filter)).map(([part,key])=>[part,query.getAll(key)]));
        entries[shared]={signature:signature(filter),parts};
      }
    }
  };
}
