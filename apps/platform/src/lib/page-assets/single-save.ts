import { canonicalizeJson } from '@metriccanvas/page';
import type { PageAssets } from './contract';
import type { StableSavePort } from '../workbench/authoring-sync';

/** A confirmed provider response is evidence; no fabricated hash or remote idempotency. */
export function createSingleSavePort(assets: PageAssets): StableSavePort {
  return {
    stableSave: false, delivery: 'single',
    async save(command) {
      const result = await assets.save({
        target: command.base ? {kind:'existing',asset:command.base,revisionId:command.base.revisionId} : {kind:'new',pageId:command.pageId},
        document:command.document,intent:command.intent ?? 'saveDraft',comment:command.description
      });
      const operationId = command.context.operationId;
      if (result.status === 'rejected') return {...result,operationId,retryable:false};
      if (result.status === 'unknown') return {...result,operationId};
      const revision = result.value;
      return {status:'saved',operationId,base:command.base,
        ref:{pageId:revision.pageId,resourceId:revision.resourceId!,revisionId:revision.revisionId},
        revisionNumber:revision.revisionNumber,contentHash:'',canonicalization:'',revision};
    },
    async lookup(context) { return {status:'unknown',operationId:context.operationId,message:'当前服务不提供原操作查询，未重发保存。'}; },
    async verifySaved(command, result) {
      return !!result.revision && result.revision.isDraft === (command.intent !== 'publish') &&
        result.revision.resourceId === result.ref.resourceId && result.revision.revisionId === result.ref.revisionId &&
        canonicalizeJson(result.revision.document) === canonicalizeJson(command.document);
    }
  };
}
