import { walkDocumentComponents } from './component-walk';
import { chartOptionScopes } from './chart-option';
type RecordValue=Record<string,unknown>;
function record(value:unknown):RecordValue|undefined {
  return value&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:undefined;
}
function visit(value:unknown,path:string,found:string[],opaque:WeakSet<object>):void {
  if(Array.isArray(value)){value.forEach((item,index)=>visit(item,`${path}/${index}`,found,opaque));return;}
  const node=record(value);if(!node)return;
  if(opaque.has(node))return;
  if(node.part==='mode'&&typeof node.filter==='string')found.push(path);
  for(const [key,child]of Object.entries(node)){
    if(['body','rows','initial','option'].includes(key))continue;
    if(key==='periodPolicy')found.push(`${path}/${key}`);
    else visit(child,`${path}/${key}`,found,opaque);
  }
}
/** Only page declaration positions; opaque query bodies/data/chart options never opt in. */
export function periodCapabilityPaths(document:unknown):string[]{
  const root=record(document),found:string[]=[];
  if(!root)return found;
  const opaque=chartOptionScopes(document);
  for(const key of ['filters','sectionGroups','dataSources'])visit(root[key],`/${key}`,found,opaque);
  if(Array.isArray(root.sections))root.sections.forEach((section,index)=>visit(record(section)?.visibleWhen,`/sections/${index}/visibleWhen`,found,opaque));
  walkDocumentComponents(document,(node,path)=>{
    for(const key of ['visibleWhen','enabledWhen','props'])visit(node[key],`${path}/${key}`,found,opaque);
  });
  return found;
}
