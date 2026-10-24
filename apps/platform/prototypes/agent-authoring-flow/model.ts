// THROWAWAY PROTOTYPE: in-memory model; no Java, Relay or Yunbao requests.
import {versionPolicy} from '@metriccanvas/page';

export interface DemoInfo {title:string;description:string;path:string}
export interface DemoAsset extends DemoInfo {pageId:string;published:boolean}
export interface DemoPage {
  schemaVersion:string;id:string;layout:'dashboard';meta:{title:string;description:string};
  dataSources:Record<string,unknown>;sections:Array<{id:string;title?:string;container:'plain'|'card';components:Array<Record<string,any>>}>;
}
export interface DemoTurn {id:number;kind:'create'|'adjust'|'publish'|'confirm';question:string;snapshot:DemoPage|null;localRevision:number}
export interface DemoMessage {role:'user'|'assistant';text:string}
export interface DemoLog {channel:'Agent'|'接口'|'本地'|'组件';message:string}
export interface DemoState {
  view:'create'|'manage'|'form'|'viewer';document:DemoPage|null;persisted:DemoPage|null;asset:DemoAsset|null;
  localRevision:number;dirty:boolean;turn:DemoTurn|null;messages:DemoMessage[];logs:DemoLog[];
  form:DemoInfo|null;editingRow:boolean;notice:string;lastInput:DemoPage|null;turnSequence:number;addressPending:boolean;serverTitle:string|null;
}

export function samplePage():DemoPage {
  return {
    schemaVersion:versionPolicy.current,id:'page-demo-1024',layout:'dashboard',
    meta:{title:'区域经营概览',description:'观察各区域经营表现，识别重点变化。'},
    dataSources:{regions:{fields:{region:{type:'string',role:'dimension'},revenue:{type:'number',role:'measure'},projects:{type:'number',role:'measure'}},
      source:{type:'inline',rows:[{region:'华东',revenue:1280,projects:36},{region:'华南',revenue:960,projects:28},{region:'华北',revenue:720,projects:21}]}}},
    sections:[{id:'overview',container:'plain',components:[
      {id:'intro',type:'text',layout:{span:12},props:{variant:'plain',body:'本页使用合成演示数据。选择图表可调整标题，也可以在左侧用自然语言继续创作。'}},
      {id:'revenue',type:'barChart',layout:{span:6},data:{main:'regions'},props:{title:'各区域收入',categoryField:'region',series:[{field:'revenue',label:'收入（万元）'}]}},
      {id:'projects',type:'barChart',layout:{span:6},data:{main:'regions'},props:{title:'各区域项目数量',categoryField:'region',series:[{field:'projects',label:'项目数量'}]}}
    ]}]
  };
}

export function infoOf(document:DemoPage):DemoInfo {
  return {title:document.meta.title,description:document.meta.description,path:'/view?pageId='+document.id};
}

export function initialState():DemoState {
  const document=samplePage();
  return {view:'create',document,persisted:structuredClone(document),asset:{...infoOf(document),pageId:document.id,published:true},
    localRevision:1,dirty:false,turn:null,messages:[{role:'assistant',text:'页面已就绪。你可以先手动修改，再告诉我如何继续调整。'}],
    logs:[],form:null,editingRow:false,notice:'',lastInput:null,turnSequence:0,addressPending:false,serverTitle:document.meta.title};
}

export function record(state:DemoState,channel:DemoLog['channel'],message:string):DemoState {
  return {...state,logs:[...state.logs,{channel,message}]};
}

export function editDocument(state:DemoState,document:DemoPage):DemoState {
  if(state.turn)return state;
  return record({...state,document:structuredClone(document),localRevision:state.localRevision+1,dirty:true,notice:''},'本地','工作副本已改变，尚未发送到服务端。');
}

export function editTitle(state:DemoState,title:string):DemoState {
  if(!state.document)return state;
  return editDocument(state,{...state.document,meta:{...state.document.meta,title}});
}

export function renameTitle(state:DemoState):DemoState {
  const document=state.document;
  if(!document||state.turn||document.meta.title===state.serverTitle)return state;
  const title=document.meta.title;
  const persisted=structuredClone(state.persisted);
  if(persisted)persisted.meta.title=title;
  const asset=state.asset?{...state.asset,title}:null;
  const dirty=persisted?JSON.stringify(document)!==JSON.stringify(persisted):state.dirty;
  return record({...state,persisted,asset,dirty,serverTitle:title,notice:'页面标题已直接保存。'},'接口','直接修改工作台页面标题；保留组件和布局的本地修改。');
}

export function chartTitleOf(document:DemoPage|null):string {
  return document?.sections.flatMap(section=>section.components).find(component=>component.id==='revenue')?.props.title??'尚无图表';
}

export function beginTurn(state:DemoState,kind:DemoTurn['kind'],question:string):DemoState {
  if(state.turn||!question.trim())return state;
  const snapshot=state.document?structuredClone(state.document):null;
  const turn={id:state.turnSequence+1,kind,question,snapshot,localRevision:state.localRevision};
  return record({...state,turn,turnSequence:turn.id,lastInput:snapshot,notice:'',messages:[...state.messages,{role:'user',text:question}]},
    'Agent',snapshot?'发送问题与前端最新工作副本：「'+snapshot.meta.title+'」。':'发送新建请求，使用空创作基线。');
}

export function adjustedPage(turn:DemoTurn):DemoPage {
  const document=structuredClone(turn.snapshot??samplePage());
  const introduction=document.sections[0].components.find(component=>component.id==='intro');
  if(introduction)introduction.props.body='「'+document.meta.title+'」：华东区域收入领先，可继续关注重点项目推进。本段由本地 Agent 替身生成，用于演示基于前端最新内容继续调整。';
  return document;
}

export function completeTurn(state:DemoState,turnId:number):DemoState {
  const turn=state.turn;
  if(!turn||turn.id!==turnId)return state;
  if(turn.kind==='publish')return publishCompleted(state,turn);
  if(turn.kind==='confirm')return record({...state,turn:null,addressPending:false,notice:'页面信息与访问地址已确认保存。',messages:[...state.messages,{role:'assistant',text:'已确认保存。你可以从页面管理维护基本信息与访问路径。'}]},'组件','模拟确认保存结果，前端未重复调用保存接口。');
  const document=turn.kind==='create'?samplePage():adjustedPage(turn);
  const text=turn.kind==='create'?'初版页面已生成，可以继续手动编辑或用自然语言调整。':'已基于「'+document.meta.title+'」补充经营说明。';
  return record({...state,turn:null,document,serverTitle:document.meta.title,localRevision:state.localRevision+1,dirty:true,
    messages:[...state.messages,{role:'assistant',text}],notice:'现有组件已自动更新页面。'},'组件','模拟现有组件自动更新；原型未增加结果确认步骤。');
}

export function publishCompleted(state:DemoState,turn:DemoTurn):DemoState {
  if(!turn.snapshot)return {...state,turn:null};
  const document=structuredClone(turn.snapshot);
  const asset={...infoOf(document),path:state.asset?.path??infoOf(document).path,pageId:document.id,published:true};
  return record({...state,turn:null,asset,persisted:document,dirty:false,addressPending:true,notice:'已发布，可确认访问地址。',
    messages:[...state.messages,{role:'assistant',text:'页面已发布。访问地址已生成，请确认并保存页面信息。'}]},'组件','模拟既有组件更新发布结果和访问地址。');
}

export function failTurn(state:DemoState):DemoState {
  if(!state.turn)return state;
  return record({...state,turn:null,notice:'本轮未完成，当前工作副本已保留。',
    messages:[...state.messages,{role:'assistant',text:'本轮执行失败，你可以检查后重新发起。'}]},'Agent','模拟失败结束，恢复编辑；页面保持本轮发问前的内容。');
}

export function newPage(state:DemoState):DemoState {
  if(state.turn)return state;
  return {...state,view:'create',document:null,persisted:null,asset:null,serverTitle:null,dirty:false,messages:[],notice:'请在 Chat 中描述你要创建的页面。',form:null,editingRow:false,addressPending:false};
}

export function navigate(state:DemoState,view:DemoState['view']):DemoState {
  if(state.turn)return state;
  return {...state,view,notice:'',editingRow:false};
}

export function openInfo(state:DemoState,inline:boolean):DemoState {
  if(!state.asset)return state;
  return {...state,view:inline?'manage':'form',form:{title:state.asset.title,description:state.asset.description,path:state.asset.path},editingRow:inline,notice:''};
}

export function formIssue(info:DemoInfo,pageId:string):string {
  if(!info.title.trim())return '请填写页面标题。';
  try {
    const url=new URL(info.path,'https://prototype.invalid');
    if(url.origin!=='https://prototype.invalid'||!info.path.startsWith('/')||info.path.startsWith('//'))return '请填写以 / 开始的站内访问路径。';
    if(url.searchParams.getAll('pageId').length!==1||url.searchParams.get('pageId')!==pageId)return '访问路径须保留当前页面的 pageId。';
  }catch{return '请填写有效的访问路径。';}
  return '';
}

export function saveInfo(state:DemoState):DemoState {
  if(!state.form||!state.asset)return state;
  const issue=formIssue(state.form,state.asset.pageId);
  if(issue)return {...state,notice:issue};
  const asset={...state.asset,...state.form};
  const persisted=structuredClone(state.persisted);
  if(persisted)persisted.meta={title:asset.title,description:asset.description};
  const document=mergeBasicInfo(state.document,state.asset,asset);
  return record({...state,asset,persisted,document,serverTitle:asset.title,form:null,editingRow:false,view:'manage',notice:'页面信息已保存。'},'接口','直接更新标题、描述、访问路径；Chat 发送次数不变。');
}

export function mergeBasicInfo(document:DemoPage|null,previous:DemoAsset,next:DemoAsset):DemoPage|null {
  if(!document||document.id!==next.pageId)return document;
  const copy=structuredClone(document);
  if(copy.meta.title===previous.title)copy.meta.title=next.title;
  if(copy.meta.description===previous.description)copy.meta.description=next.description;
  return copy;
}

export function scenario(key:string):DemoState {
  const state=initialState();
  if(key==='create')return newPage(state);
  if(key==='management')return {...state,view:'manage'};
  if(key==='failure')return {...state,notice:'先修改页面，再发问；执行中可点“模拟失败”检查内容保留。'};
  return {...state,notice:'先修改页面标题，再在左侧发送“补充经营说明”。'};
}

export function editComponent(state:DemoState,componentId:string,title:string):DemoState {
  if(!state.document)return state;
  const document=structuredClone(state.document);
  for(const section of document.sections){
    const component=section.components.find(item=>item.id===componentId);
    if(component)component.props={...component.props,title};
  }
  return editDocument(state,document);
}

export function moveComponent(state:DemoState,componentId:string,sectionId:string,index:number):DemoState {
  if(!state.document)return state;
  const document=structuredClone(state.document);
  const source=document.sections.find(section=>section.components.some(component=>component.id===componentId));
  const target=document.sections.find(section=>section.id===sectionId);
  if(!source||!target)return state;
  const position=source.components.findIndex(component=>component.id===componentId);
  const [component]=source.components.splice(position,1);
  const insertion=source===target&&index>position?index-1:index;
  target.components.splice(insertion,0,component);
  return editDocument(state,document);
}
