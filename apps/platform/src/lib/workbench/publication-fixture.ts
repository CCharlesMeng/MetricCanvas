/** Explicit service/confirmation substitute; dev lab dynamically imports this module. */
import { canonicalizeJson, type PageDocument } from '@metriccanvas/page';
import vectors from '../../../../../metriccanvas-authoring/contracts/authored/publication-conformance.json';
import { candidateReviewPayload, type Candidate, type Confirmation, type LookupOutcome, type MutationRequest } from '../../../../../metriccanvas-authoring/contracts/authored/publication-contract';
import type { HumanConfirmationPort, PublicationPort } from './authoring-publication';
const clone=<T>(v:T):T=>structuredClone(v),hash=(v:unknown)=>canonicalizeJson(v);
export function publicationExample(id='candidate-dimension-bindings'):Candidate{return clone(vectors.cases.find(v=>v.id===id)!.input) as Candidate;}
export function createPublicationFixture(){
 let candidate=publicationExample(),version=0,token=0,mode='success';
 let latest=clone(candidate.ref.source);const original=clone(candidate.document);
 const identity={actorId:'developer-1',workspaceId:'local'};
 const proofs=new Map<string,Confirmation>(),results=new Map<string,{request:MutationRequest;result:LookupOutcome}>();
 const counts={prepare:0,revise:0,publish:0,human:0,lookup:0,release:0};
 function seal(c:Candidate){c.contentHash=hash(c.document);c.canonicalization='fixture-json/1';c.reviewCanonicalization='fixture-json/1';c.reviewHash=hash(candidateReviewPayload(c));return c;}seal(candidate);
 const port:PublicationPort={
  async readSource(ref){if(hash(ref)!==hash(latest))throw Error('REVISION_CONFLICT');return{ref:clone(ref),document:clone(original)};},
  async verifyCandidate(c){return !['expired','forbidden','lease'].includes(mode)&&hash(c.ref)===hash(candidate.ref)&&c.contentHash===hash(c.document)&&c.reviewHash===hash(candidateReviewPayload(c));},
  async verifyResult(req,result){const saved=results.get(req.context.operationId);return mode!=='bad-result'&&!!saved&&hash(saved.request)===hash(req)&&hash(saved.result)===hash(result);},
  async mutate(request){
   const old=results.get(request.context.operationId);if(old)return clone(old.result);counts[request.kind]++;
   let result:LookupOutcome;
   if(mode==='conflict')result={status:'rejected',operationKind:request.kind,operationId:request.context.operationId,code:'REVISION_CONFLICT',retryable:false};
   else if(request.kind==='publish'){
    const proof=proofs.get(request.confirmationToken);
    result=!proof||hash(proof.candidate)!==hash(candidate.ref)||['expired','lease'].includes(mode)?{status:'rejected',operationKind:'publish',operationId:request.context.operationId,code:'CONFIRMATION_INVALID',retryable:false}:{status:'completed',operationKind:'publish',operationId:request.context.operationId,template:{templateId:'immutable-template',templateRevisionId:'template-version',source:clone(candidate.ref.source)}};
   }else{
    if(request.kind==='prepare'){candidate=publicationExample(mode==='blocking'?'blocking-candidate-readable':'candidate-dimension-bindings');candidate.retainDimensionValues=request.retainDimensionValues;}
    else{
     if(request.corrections.retainDimensionValues!==undefined)candidate.retainDimensionValues=request.corrections.retainDimensionValues;
     // Canned provider corrections for tests; production never imports this logic.
     for(const selection of request.corrections.parameterSelections??[]){const summary=candidate.parameterSummary.find(p=>p.parameterId===selection.parameterId)!;
      if(!selection.selected){summary.selected=false;summary.valueState='not-selected';delete summary.defaultValue;candidate.document.params=(candidate.document.params as {id:string}[]).filter(p=>p.id!==selection.parameterId);
       for(const ds of Object.values(candidate.document.dataSources as Record<string,any>))if(ds.source.query?.paramBindings)delete ds.source.query.paramBindings[selection.parameterId];}
      else if(!summary.selected){const originalCandidate=publicationExample();Object.assign(summary,clone(originalCandidate.parameterSummary.find(p=>p.parameterId===selection.parameterId)!));
       (candidate.document.params as unknown[]).push(clone((originalCandidate.document.params as {id:string}[]).find(p=>p.id===selection.parameterId)!));
       for(const [id,ds] of Object.entries(candidate.document.dataSources as Record<string,any>)){const binding=(originalCandidate.document.dataSources as Record<string,any>)[id].source.query?.paramBindings?.[selection.parameterId];if(binding)ds.source.query.paramBindings[selection.parameterId]=clone(binding);}
      }
     }
    }
    if(!candidate.retainDimensionValues)for(const p of candidate.parameterSummary.filter(p=>p.selected)){p.valueState='missing';delete p.defaultValue;const declaration=(candidate.document.params as {id:string;default?:unknown}[]).find(d=>d.id===p.parameterId);if(declaration)delete declaration.default;}
    candidate.ref.candidateVersion=`version-${++version}`;seal(candidate);result={status:'completed',operationKind:request.kind,operationId:request.context.operationId,candidate:clone(candidate)};
   }
   results.set(request.context.operationId,{request:clone(request),result:clone(result)});if(mode==='lost-ack')throw Error('回执丢失');return clone(result);
  },
  async lookup(req){counts.lookup++;return clone(results.get(req.context.operationId)?.result??{status:'not-applied',operationKind:req.kind,operationId:req.context.operationId,retrySafe:true});},
  async release(){counts.release++;},
  execution:{async execute(req){
   const declarations=candidate.document.params as {id:string;required:boolean;default?:unknown}[];
   if(declarations.some(p=>p.required&&req.explicitInputs[p.id]===undefined&&p.default===undefined))return{status:'rejected',code:'EXECUTION_REJECTED'};
   const appliedInputs=Object.fromEntries(declarations.filter(p=>req.explicitInputs[p.id]!==undefined||p.default!==undefined).map(p=>[p.id,req.explicitInputs[p.id]??p.default]));
   const sources=Object.entries(candidate.document.dataSources as Record<string,any>).filter(([,ds])=>ds.source.type==='query');
   return{status:'success',target:clone(req.target),operationId:req.operationId,executionId:'fixture-execution',conditionKey:'fixture-condition',document:clone(candidate.document),appliedInputs,
    filterValues:{'region-filter':{type:'dimension',dimension:'region',values:appliedInputs.regions??[]}},dataSources:Object.fromEntries(sources.map(([id])=>[id,{status:'success',rows:[],totalCount:0,conditionKey:'fixture-condition'}]))};
  }}
 };
 const human:HumanConfirmationPort={
  async confirm(c,who){counts.human++;const proof:Confirmation={...who,candidate:clone(c.ref),source:clone(c.ref.source),retainDimensionValues:c.retainDimensionValues,contentHash:c.contentHash,canonicalization:c.canonicalization,reviewHash:c.reviewHash,reviewCanonicalization:c.reviewCanonicalization,leaseId:c.leaseId,expiresAt:c.expiresAt,proof:`fixture-proof-${++token}`};proofs.set(proof.proof,proof);return{token:proof.proof,confirmation:clone(proof)};},
  async verify(proof,c,who){return mode!=='bad-proof'&&hash(proofs.get(proof.proof))===hash(proof)&&hash(who)===hash(identity)&&hash(proof.candidate)===hash(c.ref);}
 };
 return{port,human,identity,ref:clone(latest),document:clone(original) as unknown as PageDocument,setMode:(v:string)=>{mode=v;},counts:()=>clone(counts),advanceHead:()=>{latest={...latest,revisionId:'other-window'};}};
}
