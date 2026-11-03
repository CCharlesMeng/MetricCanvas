import type {DataSnapshot,DataWarning,Row} from '@metriccanvas/page/internal';
import {rawSnapshot} from '../snapshots';

/** Keep the same missing-data evidence on a screen page and the combined export. */
export function joinWarningSnapshot(rows:readonly Row[],total:number|undefined,warnings:DataWarning[]):DataSnapshot{
  return {...rawSnapshot(rows,total),...(warnings.length?{warnings}:{})};
}

/** Counts describe discarded result rows, including separate batches and export pages. */
export function mergeJoinWarnings(target:DataWarning[],incoming:readonly DataWarning[]|undefined):void{
  for(const warning of incoming??[]){
    const previous=target.find(value=>value.code===warning.code&&value.sourceId===warning.sourceId&&value.message===warning.message);
    if(previous)previous.count+=warning.count;
    else target.push({...warning});
  }
}
