import {createIndexedAuthoringStorage} from './workbench/authoring-storage';
import type {ActionRecord} from './page-assets/management';
import type {SaveAsset,MutationOutcome,PageRevision} from './page-assets/contract';
import {readPageAssetsRuntimeConfig} from './runtime-config';
import { createPageAssetsClient } from './page-assets/java-adapter';
import { createSingleSavePort } from './page-assets/single-save';
import { PageAssetsError } from './page-assets/contract';
import { confirmedPageAssetCapabilities, type AuthoringPort } from './workbench/authoring-coordinator';

const javaAssets = createPageAssetsClient();
const actionRecords = createIndexedAuthoringStorage<ActionRecord>();
export const pageAssets = {
  ...javaAssets,
  async save(command: SaveAsset): Promise<MutationOutcome<PageRevision>> {
    if (command.target.kind === 'existing') {
      const config = readPageAssetsRuntimeConfig();
      if (!config) return {status:'rejected',code:'UNAUTHENTICATED',message:'身份不可用。'};
      try {
        const record = await actionRecords.read({actorId:config.operatorId,workspaceId:config.workspaceId,...command.target.asset,channel:'management'});
        const current = readPageAssetsRuntimeConfig();
        if (current?.operatorId !== config.operatorId || current?.workspaceId !== config.workspaceId) return {status:'rejected',code:'IDENTITY_CHANGED',message:'身份已变化，未发送保存。'};
        if (record && ['sending','unknown'].includes(record.value.status)) return {status:'unknown',message:'此页面的管理操作结果未确认，保存已停止。'};
      } catch { return {status:'rejected',code:'STORAGE_UNAVAILABLE',message:'无法核实页面操作记录，未发送保存。'}; }
    }
    return javaAssets.save(command);
  }
};
export const pageSavePort = createSingleSavePort(pageAssets);
export const pageAuthoringPort: AuthoringPort = {
  capabilities: { ...confirmedPageAssetCapabilities, currentRead: true },
  assets: pageAssets,
  async getLatest(pageId, signal, resourceId) {
    return pageAssets.read(resourceId ? {pageId,resourceId} : await pageAssets.resolve(pageId,signal),signal);
  },
  async getRevision(pageId, revisionId, signal, resourceId) {
    const value = await this.getLatest(pageId,signal,resourceId);
    if (value.revisionId !== revisionId) throw new PageAssetsError('REVISION_NOT_FOUND','此修订不再是当前修订，请重新打开页面。',404);
    return value;
  },
  async saveRevision(pageId, command) {
    const result = await pageAssets.save({
      target: command.baseRevisionId === null ? {kind:'new',pageId} : {kind:'existing',revisionId:command.baseRevisionId,
        asset:command.resourceId ? {resourceId:command.resourceId,pageId} : await pageAssets.resolve(pageId)},
      document:command.document as import('@metriccanvas/page').PageDocument,
      intent:command.isDraft === false ? 'publish' : 'saveDraft',comment:command.comment
    });
    if(result.status === 'confirmed') return result.value;
    throw new PageAssetsError(result.status === 'rejected' ? result.code : 'PAGE_ASSETS_RESPONSE_ERROR',result.message,result.status === 'rejected' ? 400 : 200);
  }
};
