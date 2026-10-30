import {canonicalizeJson,type Row} from '@metriccanvas/page/internal';
import type {RowTableInstance} from './expansion';

interface Entry {instance:RowTableInstance;context:string;row:string}
/** Only completed query sessions survive a fold; evictions own their disposal. */
export function createFoldedTableCache(){
  const entries=new Map<string,Entry>();
  function discard(key:string){const entry=entries.get(key);entries.delete(key);entry?.instance.dispose();}
  function clear(){for(const key of entries.keys())discard(key);}
  return {
    keep(instance:RowTableInstance,context:string):boolean{
      const snapshot=instance.snapshots.get(instance.table.data.main);
      if(!instance.stream||!snapshot||!['ready','empty'].includes(snapshot.status))return false;
      discard(instance.key);
      entries.set(instance.key,{instance,context,row:canonicalizeJson(instance.row)});
      while(entries.size>20)discard(entries.keys().next().value!);
      return true;
    },
    take(key:string,row:Row,context:string):RowTableInstance|undefined{
      const entry=entries.get(key);
      if(!entry)return;
      if(entry.context!==context||entry.row!==canonicalizeJson(row)){discard(key);return;}
      entries.delete(key);entry.instance.row=row;return entry.instance;
    },
    retain(rows:readonly Row[],keyOf:(row:Row)=>string|undefined,context:string){
      const current=new Map<string,Row[]>();
      for(const row of rows){const key=keyOf(row);if(key!==undefined)current.set(key,[...current.get(key)??[],row]);}
      for(const [key,entry] of entries){
        const matches=current.get(key);
        if(entry.context!==context||matches?.length!==1||entry.row!==canonicalizeJson(matches[0]))discard(key);
      }
    },
    clear
  };
}
