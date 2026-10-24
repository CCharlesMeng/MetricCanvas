import {canonicalizeJson} from '@metriccanvas/page';
import type {PageAssets,PageRevision} from './contract';
import type {PageInfoPort,PageInfoRecord,PageInfoChanges} from '../integration/contract';

export function revisionInfo(revision:PageRevision):PageInfoRecord {
  const title=revision.document.meta?.title;
  return {pageId:revision.pageId,resourceId:revision.resourceId!,revisionId:revision.revisionId,
    title:typeof title==='string'?title:revision.pageId,titleIsBound:typeof title==='object'&&title!==null,
    description:revision.document.meta?.description??'',documentJson:canonicalizeJson(revision.document)};
}

function changedDocument(revision:PageRevision,changes:PageInfoChanges){
  if(changes.accessPath!==undefined)throw Error('CAPABILITY_UNAVAILABLE：请由接入项目提供访问路径维护接口。');
  if(changes.title!==undefined&&!changes.title.trim())throw Error('请填写页面标题。');
  const title=revision.document.meta?.title;
  if(typeof title==='object'&&title!==null&&changes.title!==undefined&&!changes.replaceBoundTitle)throw Error('标题使用动态引用，请先确认改为固定标题。');
  const document=structuredClone(revision.document);
  document.meta={...document.meta,...(changes.title!==undefined?{title:changes.title}:{}),...(changes.description!==undefined?{description:changes.description}:{})};
  return document;
}

/** Existing confirmed Java writes support title/description; path mapping is deployment-owned. */
export function createPageInfoPort(assets:PageAssets):PageInfoPort {
  return {
    async read(target,signal){return revisionInfo(await assets.read(target,signal));},
    async update(target,changes){
      const revision=await assets.read(target);
      if(revision.revisionId!==target.revisionId)throw Error('页面已发生变化，请重新读取后提交。');
      const document=changedDocument(revision,changes);
      if(canonicalizeJson(document)===canonicalizeJson(revision.document))return revisionInfo(revision);
      const result=await assets.save({target:{kind:'existing',asset:target,revisionId:revision.revisionId},document,
        intent:revision.isDraft===false?'publish':'saveDraft',comment:'修改页面基本信息'});
      if(result.status!=='confirmed')throw Error(result.message);
      return revisionInfo(result.value);
    }
  };
}
