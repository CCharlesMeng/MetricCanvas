<script lang="ts">
  import { RuntimeView, type AuthRequiredEvent, type RuntimeViewEvent } from '@metriccanvas/engine/ui';
  import { createDqeGateway } from '@metriccanvas/engine/dqe';
  import document from '../../../../../../pages/capabilities/query/dqe-request-timeout.json';

  let attempt=$state(0), instance=$state(0), enabled=$state(true);
  let status=200;
  let sends=$state(0), handled=$state(0);
  let events=$state<RuntimeViewEvent[]>([]);
  const dataGateway=createDqeGateway({fetchImpl:async()=>{
    sends++;
    const current=status;
    await new Promise(resolve=>setTimeout(resolve,80));
    if(current!==200)return new Response(null,{status:current});
    return Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',total_count:1,data:[{'审批记录ID':`合成请求${sends}`,'商务编号':'DEMO','特价审批通过时间':'2025-01-01','区域':'合成区域','审批金额':100,'预算金额':200}]}]});
  }});
  function requireAuth(_event:AuthRequiredEvent){handled++;}
  function request(next:number){status=next;attempt++;}
  function reenter(){status=200;attempt=0;instance++;}
</script>

<svelte:head><title>DQE 登录处理 · 本地仿真</title></svelte:head>
<aside>
  <h1>DQE 401 / 403 / 419 页面失效</h1>
  <p>本地 HTTP 仿真；处理方法只记录调用，不跳转真实登录页。没有真实业务数据。</p>
  <label><input type="checkbox" bind:checked={enabled}/>传入 onAuthRequired</label>
  {#each [401,403,419,500] as value}<button onclick={()=>request(value)}>发送 {value}</button>{/each}
  <button onclick={reenter}>模拟登录后重新进入</button>
  <output data-auth-count>处理次数：{handled}</output>
  <output data-send-count>请求次数：{sends}</output>
  <pre data-auth-events>{JSON.stringify(events.filter(event=>event.type==='auth-required'))}</pre>
</aside>
{#key instance}
  <RuntimeView {document} {dataGateway} initialSearch={`attempt=${attempt}`} onAuthRequired={enabled?requireAuth:undefined} onevent={event=>events.push(event)} />
{/key}

<style>
  aside {padding:16px 24px;background:#edf5ff;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
  h1,p,pre {flex-basis:100%;margin:0;}
  h1 {font-size:20px;}
  button {padding:6px 12px;}
</style>
