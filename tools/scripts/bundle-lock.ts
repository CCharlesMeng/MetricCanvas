import {createHash} from 'node:crypto';

type Artifact = {file:string;sha256:string};
type Identity = {bundleVersion:string;pageSchemaVersion:string};
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const json=(value:unknown)=>JSON.stringify(value)+'\n';
/** Keep independent distribution owners together; never partition by byte offset. */
function artifactGroup(file:string):string {
  if(file.startsWith('skill/'))return file.split('/').slice(0,2).join('-');
  const owner=file.split('/')[0];
  if(owner==='contracts'||owner==='contract-snapshot')return 'contracts';
  if(owner==='mc-content')return 'mc-content';
  if(['tool','core','scripts'].includes(owner))return 'runtime';
  return 'distribution';
}
function bounded(file:string,content:string):string {
  const size=Buffer.byteLength(content);
  if(size>1_000_000)throw new Error(`Bundle lock ${file} is ${size} bytes; refine its ownership boundary before distribution`);
  return content;
}
export function bundleLockOutputs(identity:Identity,artifacts:Artifact[]):Map<string,string> {
  const owners=new Map<string,Artifact[]>();
  for(const artifact of artifacts){
    const id=artifactGroup(artifact.file),entries=owners.get(id)??[];
    entries.push(artifact);owners.set(id,entries);
  }
  const outputs=new Map<string,string>();
  const groups=[...owners].sort(([left],[right])=>left.localeCompare(right)).map(([id,entries])=>{
    const file=`bundle-locks/${id}.json`;
    const content=bounded(file,json({lockVersion:2,...identity,artifacts:entries.sort((left,right)=>left.file.localeCompare(right.file))}));
    outputs.set(file,content);return {id,file,sha256:digest(content)};
  });
  outputs.set('bundle.lock.json',bounded('bundle.lock.json',json({lockVersion:2,...identity,groups})));
  return outputs;
}
