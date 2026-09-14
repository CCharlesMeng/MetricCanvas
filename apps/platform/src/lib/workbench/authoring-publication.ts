import { canonicalizeJson, normalizePageDocument, validate } from '@metriccanvas/page';
import { loadExecution, type ExecutionBootstrap, type ExecutionPort } from '@metriccanvas/engine';
import {
  validatePublicationStructure, validateCandidateRelations, validateConfirmationRelations,
  validateCorrectionsRelations, validateResultRelations,
  type Candidate, type CandidateRef, type Confirmation, type Corrections, type DraftRef,
  type MutationRequest, type LookupOutcome, type TemplateRef, type VerifiedSource
} from '../../../../../metriccanvas-authoring/contracts/authored/publication-contract';
export type { Candidate, Corrections };
type Identity = { actorId: string; workspaceId: string };
/** Explicit trusted adapters. No production HTTP/proof/hash/clock implementation is inferred. */
export interface PublicationPort {
  available: boolean;
  readSource(ref: DraftRef, signal: AbortSignal): Promise<VerifiedSource>;
  mutate(request: MutationRequest, signal: AbortSignal): Promise<LookupOutcome>;
  lookup(request: MutationRequest, signal: AbortSignal): Promise<LookupOutcome>;
  verifyCandidate(candidate: Candidate, source: VerifiedSource, signal: AbortSignal): Promise<boolean>;
  verifyResult(request: MutationRequest, result: LookupOutcome, signal: AbortSignal): Promise<boolean>;
  release(ref: CandidateRef): Promise<void>;
  execution: ExecutionPort;
}
export interface HumanConfirmationPort {
  /** Called only by the explicit review confirmation action, never a chat affirmative. */
  confirm(candidate: Candidate, identity: Identity, signal: AbortSignal): Promise<{ token: string; confirmation: Confirmation }>;
  verify(confirmation: Confirmation, candidate: Candidate, identity: Identity, signal: AbortSignal): Promise<boolean>;
}
const unavailable = async (): Promise<never> => { throw Error('CAPABILITY_UNAVAILABLE：发布管理服务尚未接通。'); };
export const unavailablePublicationPort: PublicationPort = { available: false, readSource: unavailable, mutate: unavailable, lookup: unavailable, verifyCandidate: unavailable, verifyResult: unavailable, release: unavailable, execution: { execute: unavailable } };
export const unavailableHumanConfirmation: HumanConfirmationPort = { confirm: unavailable, verify: unavailable };
export interface PublicationSnapshot {
  phase: 'idle'|'busy'|'review'|'unknown'|'published'|'stale'|'error'; message: string;
  candidate: Candidate|null; preview: ExecutionBootstrap|null; published: TemplateRef|null;
}
const equal = (a: unknown,b: unknown) => canonicalizeJson(a) === canonicalizeJson(b);
const pageValid = (value: unknown) => validate(value).length === 0;
const structure = { validatePageStructure: pageValid };
const requireValid = (issues: {code:string;path:string}[]) => { if (issues.length) throw Error(`${issues[0].code}：${issues[0].path}`); };
export function createAuthoringPublication(options: {
  port: PublicationPort; human: HumanConfirmationPort; identity(): Identity;
  synchronizedRef(): DraftRef; scope(): string; id?: () => string;
}) {
  let state: PublicationSnapshot = { phase:'idle', message:'', candidate:null, preview:null, published:null };
  let anchor: {scope:string;identity:Identity;source:DraftRef}|null = null;
  let pending: MutationRequest|null = null;
  let disposed=false, generation=0;
  let controller: AbortController|null = null;
  let busy=false;
  const listeners = new Set<(value:PublicationSnapshot)=>void>();
  const snapshot = ():PublicationSnapshot => ({...structuredClone({...state,preview:null}),preview:state.preview});
  const emit = (change:Partial<PublicationSnapshot>) => { state={...state,...change};listeners.forEach(listener=>listener(snapshot())); };
  function stillCurrent(expected=anchor) {
    try { return !disposed && !!expected && equal(options.identity(),expected.identity) && options.scope()===expected.scope && equal(options.synchronizedRef(),expected.source); }
    catch { return false; }
  }
  const requireCurrent = () => { if(!stillCurrent())throw Error('来源修订、身份或同步状态已变化，请重新准备候选。'); };
  const context = () => ({...options.identity(),operationId:(options.id??(()=>crypto.randomUUID()))(),origin:{kind:'manual' as const}});
  async function verifyCandidate(candidate:Candidate,signal:AbortSignal) {
    requireCurrent(); requireValid(validatePublicationStructure('Candidate',candidate,structure));
    if(!equal(candidate.ref.source,anchor!.source))throw Error('SOURCE_MISMATCH');
    const source=await options.port.readSource(structuredClone(candidate.ref.source),signal);
    requireCurrent(); signal.throwIfAborted();
    if(!equal(source.ref,candidate.ref.source))throw Error('SOURCE_MISMATCH');
    requireValid(validateCandidateRelations(candidate,{validatePage:pageValid,source}));
    if(!await options.port.verifyCandidate(structuredClone(candidate),source,signal))throw Error('候选完整性、权限或租约校验失败。');
    requireCurrent(); signal.throwIfAborted();
  }
  async function consume(request:MutationRequest,result:LookupOutcome,signal:AbortSignal,expectedGeneration:number) {
    requireValid(validatePublicationStructure('LookupOutcome',result,structure));
    requireValid(validateResultRelations(request,result));
    if(!await options.port.verifyResult(structuredClone(request),structuredClone(result),signal))throw Error('发布操作回执未通过可信核验。');
    if(disposed || signal.aborted || expectedGeneration!==generation || !equal(request.context.actorId,options.identity().actorId) || !equal(request.context.workspaceId,options.identity().workspaceId))return;
    if(result.status==='completed' && result.operationKind==='publish') {
      pending=null;emit({phase:'published',published:result.template,candidate:null,preview:null,message:'已发布不可变模板；后续草稿修改不会改变该版本。'});return;
    }
    if(result.status==='completed' && 'candidate' in result) {
      await verifyCandidate(result.candidate,signal);
      if(expectedGeneration!==generation)return;
      pending=null;emit({phase:'review',candidate:structuredClone(result.candidate),preview:null,message:'请核对候选差异、作用范围与取值，再预览和人工确认。'});return;
    }
    if(result.status==='pending'||result.status==='unknown')emit({phase:'unknown',message:'操作结果待确认，请查询原操作；不会自动换键重发。'});
    else if(result.status==='not-applied'&&!result.retrySafe)emit({phase:'unknown',message:'原操作去重保证不足，保持待确认，不能重新发布。'});
    else if(result.status==='not-applied') { pending=null;emit({phase:'error',message:'服务确认原操作未生效；可重新准备评审。',candidate:null,preview:null}); }
    else { if(state.candidate)void options.port.release(state.candidate.ref).catch(()=>{});pending=null;emit({phase:'error',message:`发布服务拒绝：${'code' in result ? result.code : result.status}`,candidate:null,preview:null}); }
  }
  async function perform(task:(signal:AbortSignal,expected:number)=>Promise<void>) {
    if(disposed||busy)return;
    busy=true;controller=new AbortController();const active=controller,expected=generation;
    emit({phase:'busy',message:'正在核验当前发布操作…'});
    try { await task(active.signal,expected); }
    catch(error) { if(!disposed && expected===generation && !active.signal.aborted)emit({phase:pending?'unknown':'error',message:error instanceof Error?error.message:String(error),preview:null}); }
    finally { if(controller===active){busy=false;controller=null;} }
  }
  async function submit(request:MutationRequest,signal:AbortSignal,expected:number) {
    requireCurrent();requireValid(validatePublicationStructure('Request',request,structure));
    pending=structuredClone(request);
    await consume(request,await options.port.mutate(structuredClone(request),signal),signal,expected);
  }
  const api={
    snapshot,
    subscribe(listener:(value:PublicationSnapshot)=>void){listeners.add(listener);listener(snapshot());return()=>{listeners.delete(listener);};},
    invalidate() {
      if(!anchor||stillCurrent())return;
      generation++;controller?.abort();controller=null;busy=false;
      const candidate=state.candidate;
      if(candidate)void options.port.release(candidate.ref).catch(()=>{});
      emit({phase:'stale',candidate:null,preview:null,published:equal(anchor.identity,options.identity())?state.published:null,message:'来源或身份已变化，旧候选和确认已失效。'});
    },
    async prepare(retainDimensionValues:boolean) {
      if(pending||busy)return;
      if(!options.port.available){emit({phase:'error',message:'CAPABILITY_UNAVAILABLE：发布管理服务尚未接通。'});return;}
      try { const identity=options.identity();if(!identity.actorId||!identity.workspaceId)throw Error('身份失效');
        anchor={scope:options.scope(),identity:{...identity},source:structuredClone(options.synchronizedRef())};
      }catch(error){emit({phase:'error',message:String(error)});return;}
      if(state.candidate)void options.port.release(state.candidate.ref).catch(()=>{});
      generation++;emit({candidate:null,preview:null});
      await perform((signal,expected)=>submit({kind:'prepare',context:context(),source:anchor!.source,retainDimensionValues},signal,expected));
    },
    async revise(corrections:Corrections) {
      const candidate=state.candidate;if(!candidate||pending||busy)return;
      await perform(async(signal,expected)=>{
        requireCurrent();requireValid(validatePublicationStructure('Corrections',corrections));requireValid(validateCorrectionsRelations(corrections,candidate));
        emit({preview:null});await submit({kind:'revise',context:context(),ref:candidate.ref,corrections:structuredClone(corrections)},signal,expected);
      });
    },
    clearPreview() { if(!busy)emit({preview:null}); },
    async preview(explicitInputs:Record<string,unknown>={}) {
      const candidate=state.candidate;if(!candidate||pending||busy)return;
      await perform(async(signal,expected)=>{
        await verifyCandidate(candidate,signal);
        const result=await loadExecution({target:{kind:'candidate',ref:candidate.ref},operationId:context().operationId,explicitInputs},options.port.execution,signal);
        requireCurrent();
        const original=normalizePageDocument(candidate.document),rendered=normalizePageDocument(result.document);
        if(!original.ok||!rendered.ok||!equal(original.document,rendered.document))throw Error('候选预览内容与评审版本不一致。');
        if(expected===generation)emit({phase:'review',preview:result,message:'已预览当前候选；请再次确认是否保留具体维度取值。'});
      });
    },
    async confirmAndPublish() {
      const candidate=state.candidate;if(!candidate||!state.preview||pending||busy)return;
      await perform(async(signal,expected)=>{
        await verifyCandidate(candidate,signal);
        if(!candidate.validation.valid)throw Error('候选存在阻断问题，不能发布。');
        const identity={...options.identity()};
        const human=await options.human.confirm(structuredClone(candidate),identity,signal);
        requireCurrent();signal.throwIfAborted();
        if(!human.token)throw Error('缺少可信人工确认证明。');
        requireValid(validatePublicationStructure('Confirmation',human.confirmation));
        requireValid(validateConfirmationRelations(human.confirmation,candidate,identity));
        if(!await options.human.verify(human.confirmation,candidate,identity,signal))throw Error('人工证明、有效期或权限核验失败。');
        await verifyCandidate(candidate,signal);
        await submit({kind:'publish',context:context(),ref:candidate.ref,confirmationToken:human.token},signal,expected);
      });
      if(!pending && state.phase==='error') {
        try { await options.port.release(candidate.ref); } catch { /* Never claim release succeeded. */ emit({message:state.message+' 服务租约释放未确认。'}); }
        emit({candidate:null,preview:null});
      }
    },
    async lookup() {
      const request=pending;if(!request||busy)return;
      if(request.context.actorId!==options.identity().actorId||request.context.workspaceId!==options.identity().workspaceId){api.invalidate();return;}
      await perform(async(signal,expected)=>consume(request,await options.port.lookup(structuredClone(request),signal),signal,expected));
    },
    async cancel() {
      generation++;controller?.abort();controller=null;busy=false;const candidate=state.candidate;
      emit({candidate:null,preview:null,phase:pending?'unknown':'idle',message:pending?'已停止本地接收，已发操作仍需查询。':'已取消本次评审。'});
      if(candidate)try{await options.port.release(candidate.ref);}catch{emit({message:'本地评审已取消，服务租约释放未确认。'});}
    },
    dispose(){disposed=true;generation++;controller?.abort();if(state.candidate)void options.port.release(state.candidate.ref).catch(()=>{});listeners.clear();}
  };
  return api;
}
