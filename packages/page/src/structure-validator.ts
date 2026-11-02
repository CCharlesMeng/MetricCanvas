import {Ajv} from 'ajv';
import {pageSchema} from './schema';
import {walkDocumentComponents} from './component-walk';

const options={allErrors:true,strict:false};
const current=new Ajv(options).compile(pageSchema);
const legacy=new Ajv(options).compile(withoutHeaderBranch(pageSchema) as object);

/** Derive the old union from the same Schema, preserving its ordered structural diagnostics. */
function withoutHeaderBranch(node:unknown):unknown {
  if(Array.isArray(node))return node.filter(value=>
    !(value!==null&&typeof value==='object'&&'$ref' in value&&value.$ref==='#/definitions/iocHeaderComponent')
  ).map(withoutHeaderBranch);
  if(node===null||typeof node!=='object')return node;
  return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,withoutHeaderBranch(value)]));
}

export function pageStructureValidator(document:unknown):typeof current {
  let componentHeader=false;
  walkDocumentComponents(document,component=>{if(component.type==='iocHeader')componentHeader=true;});
  return componentHeader?current:legacy;
}
