import { iocHeaderErrors } from './ioc-header';
import type { Page } from './page';
import { walkDocumentComponents } from './component-walk';
import { hasLegacyDefaultHeader, documentIocHeader } from './header-binding';
import { migrationError,object,type JsonObject,type MigrationChange } from './upgrade-types';
import type { TypedError } from './errors';

/** Business semantics are checked before replacing a legacy declaration. No new compatibility flags. */
export function upgradeIocHeader(document:JsonObject,changes:MigrationChange[]):TypedError[] {
  if(!object(document.iocHeader))return upgradeLegacyToolbar(document,changes);
  if(Array.isArray(document.sections)){const errors=iocHeaderErrors(document as unknown as Page);if(errors.length)return errors;}
  const sections=document.sections;
  if(!Array.isArray(sections))return [migrationError('/sections','页头迁移需要合法的分区数组')];
  const headers:string[]=[];
  walkDocumentComponents(document,(component,path)=>{if(component.type==='iocHeader')headers.push(path);});
  if(headers.length)return [migrationError(headers[0],'不能混写新组件与旧根级 IOC 页头')];
  const ids=new Set<string>(sections.flatMap(section=>typeof object(section)?.id==='string'?[String(object(section)!.id)]:[]));
  walkDocumentComponents(document,component=>{if(typeof component.id==='string')ids.add(component.id);});
  const sectionId=availableId(ids,'page-header-section');ids.add(sectionId);
  const componentId=availableId(ids,'page-header');
  sections.unshift({id:sectionId,container:'plain',components:[{id:componentId,type:'iocHeader',layout:{span:12},props:document.iocHeader}]});
  delete document.iocHeader;delete document.dashboardToolbar;
  changes.push({rule:'ioc-header-component',path:'/sections/0/components/0',message:'旧根级 IOC 页头移入常显首分区；保留原正文分区及其条件'});
  return [];
}
function availableId(ids:ReadonlySet<string>,base:string):string {
  let id=base,index=1;
  while(ids.has(id))id=`${base}-${index++}`;
  return id;
}
function upgradeLegacyToolbar(document:JsonObject,changes:MigrationChange[]):TypedError[] {
  if(documentIocHeader(document))return [];
  if(document.dashboardToolbar==='hidden'){
    delete document.dashboardToolbar;
    changes.push({rule:'ioc-header-component',path:'/dashboardToolbar',message:'移除旧隐藏工具栏；新版本无声明时不生成页头'});
    return [];
  }
  const visible=document.dashboardToolbar!==undefined || (document.layout??document.layoutForm)==='dashboard'&&hasLegacyDefaultHeader(document);
  if(!visible)return [];
  return [migrationError('/dashboardToolbar','旧工具栏含普通 Region、兼容返回及不导出页头等历史语义；不能自动转为正式 IOC 组件。保留原件，按页头迁移指南人工确认后重试')];
}
