<script lang="ts">
  import {onMount,untrack} from 'svelte';
  import {RuntimeView} from '@metriccanvas/engine/ui';
  import type {DataGateway} from '@metriccanvas/engine';
  import type {createInlineParameterPublication} from './inline-parameter-publication';
  let {publication,dataGateway}:{publication:ReturnType<typeof createInlineParameterPublication>;dataGateway?:DataGateway}=$props();
  let view=$state(untrack(()=>publication.snapshot()));
  let confirmed=$state(false);let inputs=$state('{}');let inputError=$state('');
  let replacements=$state('{}');let replacementError=$state('');
  onMount(()=>publication.subscribe(s=>{view=s;confirmed=false;}));
  const busy=$derived(['busy','queued','unknown','published'].includes(view.phase));
  function setInputs(){try{publication.setInputs(JSON.parse(inputs));inputError='';}catch{publication.setInputs({});inputError='请输入以参数 ID 为键的 JSON 对象。';}}
  function setReplacements(){try{publication.setTextReplacements(JSON.parse(replacements));replacementError='';}catch{publication.setTextReplacements({});replacementError='请输入以提示的文本路径为键、文本或参数引用为值的 JSON 对象。';}}
</script>
<section aria-label="页面参数模板评审">
  <h2>页面参数模板</h2><p role="status">{view.message}</p>
  {#if !view.extraction}<button disabled={busy} onclick={()=>publication.prepare()}>提取参数候选</button>{:else}
    <p>来源：{view.extraction.baseline}</p>
    {#each view.extraction.candidates as c}
      <label><input type="checkbox" checked={view.selected.includes(c.id)} disabled={busy} onchange={e=>publication.select(e.currentTarget.checked?[...view.selected,c.id]:view.selected.filter(id=>id!==c.id))}/>{c.declaration.label??c.id}（{c.id}，{c.declaration.type}）</label>
      <p>原值：{JSON.stringify(c.originalValue)}；覆盖：{c.coveredQueries.join('、')}；未覆盖：{c.uncoveredQueries.join('、')||'无'}</p>
    {/each}
    {#each view.extraction.skipped as item}<p>未提取：{item.path} — {item.reason}</p>{/each}
    <label>本次预览输入（留空对象使用原值；区间填写 start、end、granularity）<textarea aria-label="模板预览输入" bind:value={inputs} oninput={setInputs} disabled={busy}></textarea></label>
    {#if inputError}<p role="alert">{inputError}</p>{/if}
    <details><summary>修正仍含原值的展示文本</summary><label>按预览错误中的路径显式替换<textarea aria-label="模板文本修正" bind:value={replacements} oninput={setReplacements} disabled={busy}></textarea></label></details>
    {#if replacementError}<p role="alert">{replacementError}</p>{/if}
    <button disabled={busy||!!inputError||!!replacementError} onclick={()=>publication.preview()}>预览参数模板</button>
    {#if view.previewDocument}<RuntimeView document={view.previewDocument} {dataGateway}/>{/if}
    <label><input type="checkbox" bind:checked={confirmed} disabled={busy||!view.previewDocument}/>已核对本次参数、覆盖范围和预览，保存无值模板</label>
    <button disabled={busy||!!inputError||!!replacementError||!confirmed||!view.previewDocument} onclick={()=>publication.confirmAndPublish()}>确认保存模板</button>
  {/if}
  <button disabled={view.submissionStarted} onclick={()=>publication.cancel()}>取消模板评审</button>
</section>
