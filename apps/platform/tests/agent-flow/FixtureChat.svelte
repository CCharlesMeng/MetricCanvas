<script lang="ts">
  import {Button,Textarea} from '@metriccanvas/ui';
  import type {DialogueMountContext} from '../../src/lib/integration/contract';
  import type {Readable} from 'svelte/store';
  let {context,messages}:{context?:DialogueMountContext;messages:Readable<string[]>}=$props();
  let question=$state('补充说明，保留我刚才的修改');
</script>
<section aria-label="云宝 Chat 替身"><h2>云宝 Chat · 本地替身</h2><p>会话：{context?.sessionId}</p><div class="messages">{#each $messages as message,index(index)}<p>{message}</p>{/each}</div><Textarea label="对话问题" value={question} oninput={value=>question=value}/><Button disabled={!context} onclick={()=>context?.submit(question)}>发送到云宝</Button></section>
<style>section{padding:20px;height:100%;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}h2{font-size:16px;margin:0}p{font-size:13px;overflow-wrap:anywhere}.messages{flex:1;overflow:auto}</style>
