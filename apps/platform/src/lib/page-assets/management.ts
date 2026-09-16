import type { AssetRef, MutationOutcome, PageAssets, PageRevision } from './contract';
import { createIndexedAuthoringStorage, type AuthoringStorage } from '../workbench/authoring-storage';
import {createCanvasAuthoringDraft} from '../workbench/document-edit';
import type { DurableAuthoringState } from '../workbench/authoring-sync';
import { readPageAssetsRuntimeConfig } from '../runtime-config';

export interface ActionRecord { status: 'sending' | 'confirmed' | 'rejected' | 'unknown'; action: 'restore' | 'remove'; version?: number }
/** Persist before destructive writes. Reopening never replays an uncertain action. */
export function createAssetManagement(assets: PageAssets,
  records: AuthoringStorage<ActionRecord> = createIndexedAuthoringStorage(),
  drafts: AuthoringStorage<DurableAuthoringState> = createIndexedAuthoringStorage()) {
  let busy = false;
  async function run<T>(asset: AssetRef, action: ActionRecord['action'], execute: () => Promise<MutationOutcome<T>>, version?: number): Promise<MutationOutcome<T>> {
    if (busy) return {status:'rejected',code:'BUSY',message:'当前操作尚未结束。'};
    const identity = readPageAssetsRuntimeConfig();
    if (!identity) return {status:'rejected',code:'UNAUTHENTICATED',message:'身份配置不可用。'};
    const scope = {actorId:identity.operatorId,workspaceId:identity.workspaceId,...asset};
    const actionScope = {...scope, channel:'management' as const};
    busy = true;
    try {
      const legacy = await drafts.read({actorId:scope.actorId,workspaceId:scope.workspaceId,pageId:scope.pageId});
      if (legacy?.value.queue.length) return {status:'rejected',code:'UNSYNCHRONIZED',message:'存在旧版未决工作，请先人工核实。'};
      const draft = await drafts.read(scope);
      if (draft?.value.queue.length) return {status:'rejected',code:'UNSYNCHRONIZED',message:'此页面仍有未同步工作，请先在工作台处理。'};
      const previous = await records.read(actionScope);
      if (previous && ['sending','unknown'].includes(previous.value.status)) return {status:'unknown',message:'上次管理操作结果未确认，已停止再次写入。'};
      const current = readPageAssetsRuntimeConfig();
      if (current?.operatorId !== scope.actorId || current?.workspaceId !== scope.workspaceId) return {status:'rejected',code:'IDENTITY_CHANGED',message:'身份已变化。'};
      const next = await records.write(actionScope,previous?.version ?? 0,{status:'sending',action,version});
      const beforeSend = readPageAssetsRuntimeConfig();
      if (beforeSend?.operatorId !== scope.actorId || beforeSend?.workspaceId !== scope.workspaceId) {
        await records.write(actionScope,next,{status:'rejected',action,version});
        return {status:'rejected',code:'IDENTITY_CHANGED',message:'身份已变化，未发送操作。'};
      }
      let outcome: MutationOutcome<T>;
      try { outcome = await execute(); } catch { outcome = {status:'unknown',message:'操作结果未确认，未重发。'}; }
      if (action === 'restore' && outcome.status === 'confirmed') {
        const revision = outcome.value as PageRevision;
        const restored = createCanvasAuthoringDraft({...revision.document});
        if (!restored.ok) throw Error(restored.message);
        // Rollback may reset revision numbering; replace the old confirmed projection.
        await drafts.write(scope,draft?.version ?? 0,{format:2,scope,
          base:{...asset,revisionId:revision.revisionId},draft:restored.draft,queue:[],confirmed:revision});
      }
      await records.write(actionScope,next,{status:outcome.status,action,version});
      const afterSend = readPageAssetsRuntimeConfig();
      if (afterSend?.operatorId !== scope.actorId || afterSend?.workspaceId !== scope.workspaceId) return {status:'unknown',message:'身份已变化，操作回执已保存在原工作范围，请重新打开页面。'};
      return outcome;
    } catch { return {status:'unknown',message:'操作记录未能确认，已停止再次写入，请保留工作并核实。'}; }
    finally { busy = false; }
  }
  return {
    restore: (asset: AssetRef, draftVersion: number) => run<PageRevision>(asset,'restore',()=>assets.restore({asset,draftVersion}),draftVersion),
    remove: (asset: AssetRef) => run<void>(asset,'remove',()=>assets.remove(asset))
  };
}
