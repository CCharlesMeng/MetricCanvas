<script lang="ts">
  import {Button,Input,Textarea,Grid,Tag,Tabs,Empty} from '@metriccanvas/ui';
  import {MetricCanvas,type AuthoringIntent,type AuthoringComponentLocator} from '@metriccanvas/metric-canvas';
  import {RuntimeView} from '@metriccanvas/engine/ui';
  import PrimaryAction from '../../src/lib/PrimaryAction.svelte';
  import {initialState,editTitle,renameTitle,chartTitleOf,beginTurn,completeTurn,failTurn,newPage,navigate,openInfo,saveInfo,scenario,editComponent,moveComponent,
    type DemoState,type DemoTurn,type DemoInfo} from './model';

  let demo=$state.raw<DemoState>(initialState());
  let prompt=$state('补充经营说明，保留我刚才的修改');
  let selected=$state<AuthoringComponentLocator|undefined>();
  let traceOpen=$state(false);
  let route=$state('latest');
  let guideIndex=$state(0);
  let timer:number|undefined;
  const busy=$derived(demo.turn!==null);
  const agentCount=$derived(demo.turnSequence);
  const apiCount=$derived(demo.logs.filter(entry=>entry.channel==='接口').length);
  const selectedComponent=$derived(demo.document?.sections.flatMap(section=>section.components).find(component=>component.id===selected?.componentId));
  const columns=[{key:'title',label:'页面',width:'22%'},{key:'description',label:'描述',width:'23%'},{key:'path',label:'访问路径',width:'28%'},{key:'actions',label:'操作',width:'27%'}];
  const scenarios=[{value:'latest',label:'手改后对话'},{value:'create',label:'新建与发布'},{value:'management',label:'管理信息与路径'},{value:'failure',label:'执行失败与锁定'}];
  const guides:Record<string,Array<{label:string;action:()=>void}>>={
    latest:[{label:'1. 手动修改图表标题',action:()=>workingChart('华东收入 · 前端最新')},{label:'2. 发送自然语言调整',action:send},{label:'3. 核对本轮输入',action:()=>traceOpen=true}],
    create:[{label:'1. 生成初版页面',action:send},{label:'2. 发起发布',action:publish},{label:'3. 确认保存地址',action:confirmAddress},{label:'4. 进入页面管理',action:()=>view('manage')}],
    management:[{label:'1. 打开行内编辑',action:startInline},{label:'2. 修改标题并保存',action:()=>{updateForm('title','区域经营周报');commitInfo();}},{label:'3. 打开独立表单',action:showForm},{label:'4. 修改路径并保存',action:()=>{updateForm('path','/reports/weekly?pageId=page-demo-1024');commitInfo();}}],
    failure:[{label:'1. 手动修改图表标题',action:()=>workingChart('失败后应保留的图表标题')},{label:'2. 发起自然语言调整',action:send},{label:'3. 模拟本轮失败',action:simulateFailure},{label:'4. 核对保留的工作副本',action:()=>traceOpen=true}]
  };
  const guide=$derived(guides[route][guideIndex]);
  const guideBlocked=$derived(busy&&!(route==='failure'&&guideIndex===2));

  function request(kind:DemoTurn['kind'],question:string){
    commitTitle();
    demo=beginTurn(demo,kind,question);
    const turn=demo.turn;
    if(!turn)return;
    const id=turn.id;
    timer=window.setTimeout(()=>{demo=completeTurn(demo,id);},2400);
  }
  function send(){request(demo.document?'adjust':'create',prompt);}
  function publish(){request('publish','请发布当前页面，并生成包含 pageId 的访问地址。');}
  function confirmAddress(){request('confirm','确认保存当前页面元数据与访问地址：'+demo.asset?.path);}
  function changeScenario(value:string){if(demo.turn)return;window.clearTimeout(timer);route=value;guideIndex=0;demo=scenario(value);selected=undefined;prompt=value==='create'?'创建一个区域经营概览看板':'补充经营说明，保留我刚才的修改';}
  function create(){window.clearTimeout(timer);demo=newPage(demo);selected=undefined;prompt='创建一个区域经营概览看板';}
  function updateForm(field:keyof DemoInfo,value:string){if(demo.form)demo={...demo,form:{...demo.form,[field]:value},notice:''};}
  function cancelForm(){demo={...demo,view:'manage',form:null,editingRow:false,notice:''};}
  function handleIntent(intent:AuthoringIntent){
    if(intent.type==='select_component'){selected=intent.locator;return;}
    if(intent.type==='edit_component'&&intent.edit.title!==undefined)demo=editComponent(demo,intent.locator.componentId,intent.edit.title);
    if(intent.type==='move_component')demo=moveComponent(demo,intent.locator.componentId,intent.destination.sectionId,intent.destination.index);
  }
  function title(value:string){demo=editTitle(demo,value);}
  function commitTitle(){demo=renameTitle(demo);}
  function workingChart(value:string){selected={sectionId:'overview',componentId:'revenue'};demo=editComponent(demo,'revenue',value);}
  function componentTitle(value:string){if(selected)demo=editComponent(demo,selected.componentId,value);}
  function showForm(){demo=openInfo(demo,false);}
  function startInline(){demo=openInfo(demo,true);}
  function commitInfo(){demo=saveInfo(demo);}
  function simulateFailure(){window.clearTimeout(timer);demo=failTurn(demo);}
  function view(kind:DemoState['view']){demo=navigate(demo,kind);}
  function advanceGuide(){if(!guide)return;guide.action();guideIndex++;}
</script>

<svelte:head><meta name="color-scheme" content="light"/></svelte:head>
<div class="prototype">
  <div class="prototype-heading">
    <div><strong>页面创作流程 · 交互原型</strong><span>验证最新工作副本、执行锁定与管理直调。合成数据及本地 Agent 替身，刷新后重置。</span></div>
    <Button onclick={()=>traceOpen=!traceOpen}>{traceOpen?'收起演示记录':'查看演示记录'}</Button>
  </div>
  <div class="walkthrough"><span>演示路线</span><Tabs options={scenarios.map(option=>({...option,disabled:busy}))} value={route} onchange={changeScenario} label="演示路线"/><Button disabled={busy} onclick={()=>changeScenario(route)}>重置本路线</Button></div>
  <div class="guide"><span>可自由操作下方界面，也可以按步骤体验：</span><Button disabled={!guide||guideBlocked} onclick={advanceGuide}>{guide?.label??'本路线已完成'}</Button><small>步骤 {Math.min(guideIndex+1,guides[route].length)} / {guides[route].length}</small></div>
  <div class="app-shell">
    <nav class="rail" aria-label="平台导航">
      <div class="brand">M</div>
      <Button disabled={busy} variant={demo.view==='create'?'primary':'default'} onclick={()=>view('create')}>创作</Button>
      <Button disabled={busy} variant={demo.view==='manage'||demo.view==='form'?'primary':'default'} onclick={()=>view('manage')}>管理</Button>
      <span class="rail-note">MetricCanvas</span>
    </nav>
    <main>
      {#if demo.view==='create'}
        <div class="workbench">
          <section class="chat" aria-label="创作 Chat">
            <header><strong>页面创作</strong><Tag>{busy?'处理中':'云宝 Chat · 演示'}</Tag></header>
            <div class="messages" aria-live="polite">
              {#if !demo.messages.length}<div class="chat-welcome"><h2>从一个想法开始</h2><p>描述你想看到的数据和页面，生成初版后可以继续手动编辑或用自然语言调整。</p></div>{/if}
              {#each demo.messages as message,index(index)}<div class:user={message.role==='user'} class="message"><small>{message.role==='user'?'你':'云宝助手'}</small><p>{message.text}</p></div>{/each}
              {#if busy}<div class="message"><small>云宝助手</small><p>正在处理本轮请求，页面编辑已暂时锁定…</p></div>{/if}
              {#if demo.addressPending&&demo.asset}<div class="address-card"><strong>页面访问地址</strong><p>{demo.asset.path}</p><Button disabled={busy} variant="primary" onclick={confirmAddress}>确认并保存</Button></div>{/if}
            </div>
            <div class="composer"><Textarea label="向云宝发送问题" value={prompt} oninput={value=>prompt=value} disabled={busy} rows={3} placeholder="描述你要创建或调整的内容"/><div><small>{busy?'本轮结束后恢复编辑':'将携带当前页面的最新修改'}</small><PrimaryAction disabled={busy||!prompt.trim()} onclick={send}>{busy?'处理中…':'发送'}</PrimaryAction></div></div>
          </section>
          <section class="workspace" aria-label="页面搭建工作台">
            <div class="workspace-toolbar"><div class="title-field" onfocusout={commitTitle}><span>页面标题</span><Input label="页面标题" value={demo.document?.meta.title??''} oninput={title} oncommit={commitTitle} disabled={busy||!demo.document} placeholder="生成初版后可编辑"/></div><div class="toolbar-actions"><Tag type={demo.dirty?'warning':'success'}>{demo.dirty?'工作副本有修改':'页面已就绪'}</Tag><Button disabled={busy} onclick={create}>新建页面</Button><PrimaryAction disabled={busy||!demo.document} onclick={publish}>发布页面</PrimaryAction></div></div>
            {#if selectedComponent}<div class="inline-properties"><span>所选组件标题</span><Input label="所选组件标题" value={selectedComponent.props.title??''} oninput={componentTitle} disabled={busy}/></div>{/if}
            {#if busy}<div class="lock-notice" role="status">Agent 正在处理当前页面。手动编辑与下一轮发送已暂停。</div>{/if}
            {#if demo.notice}<p class="notice" role="status">{demo.notice}</p>{/if}
            <div class="canvas-scroll">
              {#if demo.document}<MetricCanvas document={demo.document} enabled={!busy} {selected} inlineControls={false} onintent={handleIntent}/>
              {:else}<div class="empty-canvas"><Empty message="尚无页面内容"/><p>在左侧 Chat 描述需求，初版生成后会在这里自动呈现。</p></div>{/if}
            </div>
            <footer class="workspace-footer"><span>{demo.document?'页面 ID：'+demo.document.id:'等待生成页面 ID'}</span><span>合成数据 · 复用 MetricCanvas 画布与统一运行时</span></footer>
          </section>
          <aside class="inspector" aria-label="组件属性"><h3>组件属性</h3>{#if selectedComponent}<p>{selectedComponent.type}</p><label for="component-title">组件标题</label><Input id="component-title" label="组件标题" value={selectedComponent.props.title??''} oninput={componentTitle} disabled={busy}/><p class="muted">手动修改即时进入当前工作副本。</p>{:else}<p class="muted">选择画布中的图表，调整它的标题或拖动位置。</p>{/if}</aside>
        </div>
      {:else if demo.view==='manage'}
        <section class="management"><header class="page-heading"><div><h1>页面管理</h1><p>维护页面基本信息与访问路径</p></div><PrimaryAction onclick={create}>新建页面</PrimaryAction></header>
          {#if demo.notice}<p class="notice" role="status">{demo.notice}</p>{/if}
          <div class="panel"><Grid rows={demo.asset?[demo.asset]:[]} {columns} rowKey={row=>row.pageId} label="页面管理表格" responsive="stack" emptyText="暂无页面，请先创建并发布。">
            {#snippet cell(row,column)}
              {#if column.key==='title'}{#if demo.editingRow}<Input label="行内页面标题" value={demo.form?.title??''} oninput={value=>updateForm('title',value)}/>{:else}<strong>{row.title}</strong><p class="muted">{row.pageId}</p><Tag type="success">已发布</Tag>{/if}
              {:else if column.key==='description'}{#if demo.editingRow}<Textarea label="行内页面描述" value={demo.form?.description??''} oninput={value=>updateForm('description',value)} rows={2}/>{:else}{row.description}{/if}
              {:else if column.key==='path'}{#if demo.editingRow}<Input label="行内访问路径" value={demo.form?.path??''} oninput={value=>updateForm('path',value)}/>{:else}<span class="path">{row.path}</span>{/if}
              {:else}<div class="row-actions">{#if demo.editingRow}<Button variant="primary" onclick={commitInfo}>保存</Button><Button onclick={cancelForm}>取消</Button>{:else}<Button onclick={startInline}>行内编辑</Button><Button onclick={showForm}>编辑信息</Button><Button onclick={()=>view('create')}>进入画布</Button><Button onclick={()=>view('viewer')}>访问页面</Button>{/if}</div>{/if}
            {/snippet}
          </Grid></div>
        </section>
      {:else if demo.view==='form'&&demo.form&&demo.asset}
        <section class="management"><header class="page-heading"><div><Button onclick={cancelForm}>返回页面管理</Button><h1>编辑页面信息</h1><p>{demo.asset.pageId}</p></div></header>
          <form class="panel info-form" onsubmit={event=>{event.preventDefault();commitInfo();}}>
            <label for="info-title">页面标题</label><Input id="info-title" label="表单页面标题" value={demo.form.title} oninput={value=>updateForm('title',value)}/>
            <div class="field-label">页面描述</div><Textarea label="表单页面描述" value={demo.form.description} oninput={value=>updateForm('description',value)} rows={4}/>
            <label for="info-path">可访问路径</label><Input id="info-path" label="表单访问路径" value={demo.form.path} oninput={value=>updateForm('path',value)}/><p class="muted">保留当前页面的 pageId。此处修改页面访问路径。</p>
            {#if demo.notice}<p role="alert">{demo.notice}</p>{/if}
            <div class="form-actions"><Button type="submit" variant="primary">保存信息</Button><Button onclick={cancelForm}>取消</Button></div>
          </form>
        </section>
      {:else if demo.view==='viewer'&&demo.asset&&demo.persisted}
        <section class="management"><header class="page-heading"><div><Button onclick={()=>view('manage')}>返回页面管理</Button><h1>访问页面</h1><p class="path">{demo.asset.path}</p></div></header><p class="notice">演示：从地址读取 pageId → 查询元数据 → 统一运行时渲染。此页面展示模拟接口当前返回的内容。</p><RuntimeView document={demo.persisted}/></section>
      {/if}
    </main>
  </div>
  {#if traceOpen}<section class="trace" aria-label="原型演示记录"><div class="trace-heading"><strong>原型演示记录</strong><span>仅用于核对本轮交互设计</span><Button disabled={!busy} onclick={simulateFailure}>模拟失败</Button></div>
    <dl><div><dt>Agent 发送</dt><dd>{agentCount} 次</dd></div><div><dt>管理接口调用</dt><dd>{apiCount} 次</dd></div><div><dt>前端当前标题</dt><dd>{demo.document?.meta.title??'尚无页面'}</dd></div><div><dt>服务端模拟标题</dt><dd>{demo.persisted?.meta.title??'尚无记录'}</dd></div><div><dt>本轮发送标题</dt><dd>{demo.lastInput?.meta.title??'空创作基线'}</dd></div><div><dt>前端图表标题</dt><dd>{chartTitleOf(demo.document)}</dd></div><div><dt>服务端图表标题</dt><dd>{chartTitleOf(demo.persisted)}</dd></div><div><dt>本轮图表标题</dt><dd>{chartTitleOf(demo.lastInput)}</dd></div><div><dt>编辑锁</dt><dd>{busy?'已锁定':'可编辑'}</dd></div></dl>
    <ol>{#each demo.logs as entry,index(index)}<li><Tag>{entry.channel}</Tag><span>{entry.message}</span></li>{/each}</ol>
  </section>{/if}
</div>

<style>
  :global(body){margin:0;background:#f5f5f5;color:#191919;font-family:Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif;font-size:14px;line-height:1.5}
  :global(*){box-sizing:border-box}.prototype-heading{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:#fff;border-bottom:1px solid #f0f0f0;gap:16px}.prototype-heading strong{font-size:16px}.prototype-heading span{display:block;color:#808080;font-size:12px;margin-top:4px}.walkthrough{display:flex;align-items:center;gap:24px;background:#fff;padding:0 24px;border-bottom:1px solid #f0f0f0;min-height:52px}.walkthrough>span{font-size:12px;color:#808080}.app-shell{display:grid;grid-template-columns:72px minmax(0,1fr);min-height:520px;height:calc(100vh - 173px)}.rail{display:flex;flex-direction:column;gap:16px;align-items:center;padding:20px 6px;background:#fff;border-right:1px solid #f0f0f0}.brand{font-size:23px;font-weight:700;margin-bottom:16px}.rail-note{writing-mode:vertical-rl;color:#999;font-size:11px;letter-spacing:2px;margin-top:auto}main{min-width:0;overflow:auto}.workbench{height:100%;display:grid;grid-template-columns:320px minmax(0,1fr) 210px}.chat{display:flex;flex-direction:column;background:#fff;border-right:1px solid #f0f0f0;min-height:0}.chat header{height:62px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0f0f0}.messages{padding:24px 20px;overflow:auto;flex:1}.message{margin-bottom:24px}.message small{color:#808080}.message p{margin:8px 0 0;padding:12px;background:#f5f5f5;border-radius:8px;line-height:1.8;overflow-wrap:anywhere}.message.user p{background:#f0f7ff}.chat-welcome{padding:40px 0;color:#808080}.chat-welcome h2{font-size:20px;color:#191919}.composer{padding:16px;border-top:1px solid #f0f0f0}.composer>div{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}.composer small{font-size:11px;color:#808080}.workspace{display:flex;flex-direction:column;min-width:0;overflow:hidden}.workspace-toolbar{background:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 20px;border-bottom:1px solid #f0f0f0;flex-wrap:wrap}.title-field{display:flex;align-items:center;gap:12px;min-width:0}.title-field>span{color:#808080;font-size:12px;white-space:nowrap}.toolbar-actions{display:flex;align-items:center;gap:10px}.canvas-scroll{padding:24px;overflow:auto;flex:1}.workspace-footer{padding:12px 20px;display:flex;justify-content:space-between;gap:12px;color:#808080;font-size:11px;background:#fff;border-top:1px solid #f0f0f0}.lock-notice{padding:10px 20px;background:#fff4e8;color:#a64d00;font-size:12px}.notice{margin:12px 20px;padding:10px 14px;background:#f0f7ff;border-radius:6px;color:#3d6899;font-size:13px}.inspector{background:#fff;border-left:1px solid #f0f0f0;padding:20px;overflow:auto}.inspector h3{font-size:14px;margin:0 0 24px}.inspector label{display:block;font-size:12px;color:#808080;margin:16px 0 8px}.muted{font-size:12px;color:#808080;margin:6px 0;overflow-wrap:anywhere}.empty-canvas{padding:140px 16px;text-align:center;color:#808080}.management{padding:32px;max-width:1560px;margin:auto}.page-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.page-heading h1{font-size:22px;margin:12px 0 4px}.page-heading p{color:#808080;margin:4px 0}.panel{background:#fff;padding:24px;border-radius:8px}.row-actions{display:flex;gap:8px;flex-wrap:wrap}.path{font-size:12px;overflow-wrap:anywhere;color:#595959}.info-form{max-width:740px}.info-form label{display:block;margin:20px 0 8px;font-weight:500}.info-form label:first-child{margin-top:0}.form-actions{display:flex;gap:12px;margin-top:32px}.address-card{padding:16px;border:1px solid #e6e6e6;border-radius:8px}.address-card p{font-size:12px;overflow-wrap:anywhere;color:#595959}.trace{background:#fff;border-top:1px solid #e6e6e6;padding:20px 24px}.trace-heading{display:flex;align-items:center;gap:16px}.trace-heading span{font-size:12px;color:#808080}.trace dl{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px;margin:20px 0}.trace dt{font-size:12px;color:#808080}.trace dd{margin:6px 0 0;overflow-wrap:anywhere}.trace ol{padding:0;list-style:none;max-height:200px;overflow:auto}.trace li{display:flex;gap:12px;align-items:center;margin:10px 0;font-size:12px}
  .inline-properties{display:none}
  .guide{display:flex;align-items:center;gap:16px;padding:8px 24px;background:#fafafa;border-bottom:1px solid #f0f0f0;font-size:12px;color:#808080;flex-wrap:wrap}
  .field-label{margin:20px 0 8px;font-weight:500}
  @media(max-width:1250px){.workbench{grid-template-columns:290px minmax(0,1fr)}.inspector{display:none}.inline-properties{display:flex;align-items:center;gap:12px;padding:10px 20px;background:#fff;border-bottom:1px solid #f0f0f0}.inline-properties>span{font-size:12px;color:#808080;white-space:nowrap}.workspace-footer{flex-direction:column}.trace dl{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:760px){.prototype-heading{padding:12px;align-items:flex-start}.walkthrough{padding:8px 12px;gap:8px;flex-wrap:wrap}.walkthrough>span{display:none}.app-shell{grid-template-columns:1fr;height:auto;min-height:0}.rail{flex-direction:row;justify-content:flex-start;padding:10px 16px;border-right:0;border-bottom:1px solid #f0f0f0}.brand{margin:0 12px 0 0}.rail-note{display:none}.workbench{display:flex;flex-direction:column-reverse}.chat{min-height:500px}.workspace{min-height:560px}.workspace-toolbar{padding:16px}.canvas-scroll{padding:12px}.management{padding:20px 12px}.panel{padding:16px}.page-heading{gap:16px}.trace dl{grid-template-columns:repeat(2,minmax(0,1fr))}.trace-heading{flex-wrap:wrap}}
</style>
