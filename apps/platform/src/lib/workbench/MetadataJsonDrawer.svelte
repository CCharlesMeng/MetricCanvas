<script lang="ts">
  import ToolAction from '../ToolAction.svelte';
  import {onMount} from 'svelte';
  import {Dialog} from '@metriccanvas/ui';
  import {copyMetadataJson,formatMetadataJson,metadataInitialSources} from './metadata-json';
  let {document,pageId,transient,onclose}:{document:Record<string,unknown>;pageId:string;transient:boolean;onclose:()=>void}=$props();
  let copyState=$state<'idle'|'copied'|'error'>('idle');
  let includedInitialSourceIds=$state<string[]>([]);
  let timer:ReturnType<typeof setTimeout>|undefined;
  let active=true;
  const sources=$derived(metadataInitialSources(document));
  const formatted=$derived(formatMetadataJson(document,new Set(includedInitialSourceIds)));
  const copyLabel=$derived(copyState==='copied'?'已复制':copyState==='error'?'复制失败':'复制 JSON');
  onMount(()=>()=>{active=false;if(timer)clearTimeout(timer);});
  $effect(()=>{const available=new Set(sources.map(source=>source.id));const next=includedInitialSourceIds.filter(id=>available.has(id));if(next.length!==includedInitialSourceIds.length)includedInitialSourceIds=next;});
  async function copy(){try{await copyMetadataJson(formatted);if(active)copyState='copied';}catch{if(active)copyState='error';}if(!active)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>copyState='idle',1800);}
</script>
<Dialog open title="metadata.json" {onclose}>
  <div data-testid="metadata-json-drawer">
    <p data-testid="metadata-json-subtitle">页面 ID：{pageId} · {transient?'临时页面':'当前工作副本'}</p>
    {#if sources.length}<section data-testid="metadata-initial-options" aria-label="内嵌初始行"><h3>内嵌初始行</h3><p>默认不包含；勾选后复制内容包含对应页面数据源的初始行。</p>{#each sources as source(source.id)}<label data-metadata-initial-source={source.id}><input type="checkbox" value={source.id} bind:group={includedInitialSourceIds}/><code>{source.id}</code></label>{/each}</section>{/if}
    <pre role="region" aria-label="页面文档 JSON" data-testid="metadata-json-code" data-serialization-source="metadata-json-projection"><code>{formatted}</code></pre>
    {#if copyState!=='idle'}<p role="status">{copyLabel}</p>{/if}
  </div>
  {#snippet footer()}<ToolAction onclick={copy}>{copyLabel}</ToolAction><ToolAction onclick={onclose}>关闭</ToolAction>{/snippet}
</Dialog>
<style>
  p{font-size:14px;color:#595959}h3{font-size:14px}label{display:flex;align-items:center;gap:8px;margin:8px 0}pre{max-height:50vh;overflow:auto;background:#f5f5f5;padding:16px;font:12px/1.6 monospace;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere}
</style>
