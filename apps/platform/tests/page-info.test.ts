import {expect,it,vi} from 'vitest';
import type {PageDocument} from '@metriccanvas/page';
import {createPageAssetsClient} from '../src/lib/page-assets/java-adapter';
import {createPageInfoPort} from '../src/lib/page-assets/info';
import {validateInfo} from '../src/lib/page-assets/info-edit';
import {createAuthoringCoordinator,confirmedPageAssetCapabilities} from '../src/lib/workbench/authoring-coordinator';
import {createCanvasAuthoringDraft} from '../src/lib/workbench/document-edit';

it('direct title updates preserve published state and do not submit unsaved canvas changes',async()=>{
  let document:PageDocument={schemaVersion:'6.5',id:'p',layout:'dashboard',meta:{title:'旧页名'},dataSources:{},sections:[{id:'s',components:[{id:'t',type:'text',layout:{span:12},props:{body:'服务端正文'}}]}]};
  let number=1;const writes:unknown[]=[];
  const assets=createPageAssetsClient({readConfig:()=>({dqeEndpoint:'',pageMetadataBaseUrl:'https://assets',authToken:'fixture',operatorId:'a',workspaceId:'w'}),fetchImpl:async(_input,init)=>{
    if(init?.method==='PUT'){const body=JSON.parse(String(init.body));writes.push(body);expect(body.is_draft).toBe(false);document=body.page_metadata_definition;number++;}
    return Response.json({retCode:'CBC.0000',page_id:'p',page_metadata_id:'r',revision_id:'v'+number,revision_number:number,is_draft:false,page_metadata_definition:JSON.stringify(document)});
  }});
  const coordinator=createAuthoringCoordinator({manualSave:true,identity:()=>({actorId:'a',workspaceId:'w'}),port:{capabilities:confirmedPageAssetCapabilities,getLatest:async()=>assets.read({pageId:'p',resourceId:'r'}),getRevision:vi.fn(),saveRevision:vi.fn()}});
  await coordinator.load('p');
  const local=structuredClone(document);const component=local.sections[0].components[0];if(component.type!=='text')throw Error('fixture');component.props.body='尚未保存的正文';
  const parsed=createCanvasAuthoringDraft({...local});if(!parsed.ok)throw Error(parsed.message);coordinator.replaceDraft(parsed.draft);
  const info=createPageInfoPort(assets),current=await info.read({pageId:'p',resourceId:'r'});
  await info.update(current,{title:'新页名'});
  const preparation=coordinator.beginPreparation();await preparation.rebaseTitle(await assets.read(current),'新页名');preparation.release();
  expect(writes).toHaveLength(1);expect(JSON.stringify(document)).toContain('服务端正文');expect(JSON.stringify(document)).not.toContain('尚未保存的正文');
  expect(JSON.stringify(coordinator.snapshot().draft)).toContain('尚未保存的正文');
  expect(coordinator.snapshot()).toMatchObject({dirty:true,ref:{revisionId:'v2'}});coordinator.dispose();
});

it('validates a deployment-provided access path while preserving its page identity',()=>{
  const info={pageId:'p',resourceId:'r',revisionId:'v1',title:'页面',description:'说明'};
  expect(validateInfo({...info,accessPath:'/reports/monthly?pageId=p'})).toBe('');
  expect(validateInfo({...info,accessPath:'/reports/monthly'})).toContain('页面 ID');
  expect(validateInfo({...info,accessPath:'https://other.test/?pageId=p'})).not.toBe('');
});
