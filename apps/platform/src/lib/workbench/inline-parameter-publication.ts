import {applyPageParamSelection,extractPageParams,resolvePageParams,type PageDocument,type PageParamExtraction,type ExtractionContext} from '@metriccanvas/page';
import type {TextValue} from '@metriccanvas/page/internal';
export interface VerifiedParameterSource extends ExtractionContext {document:unknown;}
export interface ParameterSourcePort {
  /** Trusted program channel: return the exact final DQE-verified revision, not model-authored JSON. */
  readVerifiedSource(expectedBaseline:string):Promise<VerifiedParameterSource>;
}
export interface InlinePublicationState {
  phase:'idle'|'busy'|'review'|'stale'|'error'|'queued'|'unknown'|'published';
  message:string; extraction:PageParamExtraction|null;selected:string[];inputs:Record<string,unknown>;
  submissionStarted:boolean;
  document:PageDocument|null;previewDocument:PageDocument|null;previewResult:unknown;
}
export function createInlineParameterPublication(options:ParameterSourcePort & {
  sourceKey():string;
  preview(document:PageDocument,signal:AbortSignal):Promise<unknown>;
  /** Existing durable single-write path owns persistence and authoritative receipts. */
  save(document:PageDocument,sourceKey:string,selectedIds:readonly string[]):Promise<{status:'queued'|'unknown'|'confirmed'|'rejected';message?:string}>;
}) {
  let state:InlinePublicationState={phase:'idle',message:'',extraction:null,selected:[],inputs:{},submissionStarted:false,document:null,previewDocument:null,previewResult:null};
  let sourceKey='',generation=0,submitted=false;let controller:AbortController|undefined;
  let textReplacements:Record<string,TextValue>={};
  const listeners=new Set<(s:InlinePublicationState)=>void>();
  const snapshot=()=>structuredClone(state);
  const emit=(change:Partial<InlinePublicationState>)=>{state={...state,...change};listeners.forEach(f=>f(snapshot()));};
  const current=()=>{try{return sourceKey===options.sourceKey();}catch{return false;}};
  const clear=()=>{generation++;controller?.abort();emit({previewDocument:null,previewResult:null,document:null});};
  const api={snapshot,subscribe(f:(s:InlinePublicationState)=>void){listeners.add(f);f(snapshot());return()=>{listeners.delete(f);};},
    async prepare(){
      if(submitted||state.phase==='busy')return;
      const turn=++generation;emit({phase:'busy',message:'读取最终已验证查询…'});
      try {
        sourceKey=options.sourceKey();
        const source=await options.readVerifiedSource(sourceKey);if(turn!==generation)return;if(!current())throw Error('来源已改变');
        if(source.baseline!==sourceKey)throw Error('已验证查询基线与当前修订不一致');
        const extraction=extractPageParams(source.document,source);if(!extraction.ok)throw Error(extraction.issues[0].message);
        textReplacements={};
        emit({phase:'review',extraction,selected:extraction.candidates.filter(c=>c.defaultSelected).map(c=>c.id),inputs:{},document:null,previewDocument:null,previewResult:null,message:'核对原值与覆盖范围，选择参数后预览。'});
      }catch(e){if(turn===generation)emit({phase:'error',message:String(e)});}
    },
    select(ids:string[]){if(submitted||state.phase==='busy')return;clear();emit({selected:[...ids],phase:'review'});},
    setInputs(inputs:Record<string,unknown>){if(submitted||state.phase==='busy')return;clear();if(!inputs||typeof inputs!=='object'||Array.isArray(inputs))throw Error('参数必须为对象');emit({inputs:structuredClone(inputs)});},
    setTextReplacements(replacements:Record<string,TextValue>){if(submitted||state.phase==='busy')return;clear();if(!replacements||typeof replacements!=='object'||Array.isArray(replacements))throw Error('文本修正必须为对象');textReplacements=structuredClone(replacements);},
    async preview(){
      if(submitted||!state.extraction||state.phase==='busy'||state.phase==='stale')return;
      if(!current()){api.invalidate();return;}
      clear();const turn=generation;controller=new AbortController();emit({phase:'busy',message:'以本次输入验证模板…'});
      try {
        const selected=applyPageParamSelection(state.extraction,state.selected,textReplacements);if(!selected.ok)throw Error(selected.issues[0].message);
        const resolved=resolvePageParams(selected.document,{...selected.originalValues,...state.inputs});if(!resolved.ok)throw Error(resolved.issues[0].message);
        const result=await options.preview(resolved.document,controller.signal);
        if(turn!==generation||!current()){api.invalidate();return;}
        emit({phase:'review',document:selected.document,previewDocument:resolved.document,previewResult:result,message:'预览完成；确认后保存无值模板。'});
      }catch(e){if(turn===generation)emit({phase:'error',message:String(e),previewDocument:null,document:null});}
    },
    async confirmAndPublish(){
      if(submitted||state.phase!=='review'||!state.document||!state.previewDocument)return;
      if(!current()){api.invalidate();return;}
      submitted=true;const turn=generation;const document=structuredClone(state.document);emit({phase:'busy',submissionStarted:true,message:'提交无值模板…'});
      try {
        const result=await options.save(document,sourceKey,[...state.selected]);
        if(turn!==generation)return;
        emit({phase:result.status==='confirmed'?'published':result.status==='rejected'?'error':result.status,message:result.message??(result.status==='queued'?'已加入现有保存队列，等待提供方回执。':result.status==='confirmed'?'提供方已确认保存。':'保存结果未确认，请核实原操作。')});
      }catch(e){if(turn===generation)emit({phase:'unknown',message:`保存结果未确认：${String(e)}`});}
    },
    invalidate(){if(!sourceKey||current()||submitted)return;clear();emit({phase:'stale',extraction:null,message:'来源修订或身份已改变，请重新准备。'});},
    cancel(){if(submitted)return;clear();emit({phase:'idle',extraction:null,selected:[],inputs:{},message:'已取消本次评审。'});},
    dispose(){generation++;controller?.abort();listeners.clear();}
  };
  return api;
}
