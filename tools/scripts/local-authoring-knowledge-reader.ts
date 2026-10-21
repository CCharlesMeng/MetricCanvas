import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, knowledgeSelection, type AuthoringKnowledge } from './local-authoring-knowledge-core';

function run(args:string[]):unknown {
  if(args.length===1 && args[0]==='--help') return {commands:['list --module <id>','show --topic <id> [--topic <id>] [--pointer <schema-pointer>]'],
    output:'JSON; partial structure with ancestor constraints and explicit child/ref pointers',errors:'1 usage/topic; 2 damaged knowledge'};
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const file='references/authoring-knowledge/model.json';
  const manifest=JSON.parse(readFileSync(path.join(root,'references/knowledge.json'),'utf8'));
  const content=readFileSync(path.join(root,file),'utf8');
  if(manifest.files.find((item:{file:string})=>item.file===file)?.sha256!==digest(content)) throw new Error('Knowledge hash mismatch; replace the complete Skill');
  const model=JSON.parse(content) as AuthoringKnowledge;
  if(model.schemaVersion!==manifest.schemaVersion) throw new Error('Knowledge version mismatch');
  const [command,...rest]=args;
  if(command==='list' && rest.length===2 && rest[0]==='--module') {
    if(!Object.hasOwn(model.modules,rest[1])) throw new TypeError(`Unknown module: ${rest[1]}`);
    return Object.entries(model.topics).filter(([,topic])=>topic.module===rest[1]).map(([id,t])=>({id,title:t.title,dependencies:t.dependencies}));
  }
  if(command!=='show' || !rest.length || rest.length%2 || rest.some((arg,i)=>i%2===0 && !['--topic','--pointer'].includes(arg))) throw new TypeError('Usage: read-knowledge.mjs list --module <id> | show --topic <id> [--topic <id>] [--pointer <schema-pointer>]');
  const values=(flag:string)=>rest.filter((_,i)=>i%2===1 && rest[i-1]===flag);
  return knowledgeSelection(model,values('--topic'),values('--pointer'));
}
try { console.log(JSON.stringify(run(process.argv.slice(2)))); }
catch(error) { console.error(JSON.stringify({error:error instanceof Error?error.message:String(error)})); process.exitCode=error instanceof TypeError || /Unknown (topic|schema pointer)/.test(String(error))?1:2; }
