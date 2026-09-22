<script lang="ts">
 import { onMount, untrack } from 'svelte';
 import { RuntimeView } from '@metriccanvas/engine/ui';
 import { createInjectedDqeGateway } from '../runtime-config';
 const dataGateway=createInjectedDqeGateway();
 import type { createAuthoringPublication } from './authoring-publication';
 let {publication}:{publication:ReturnType<typeof createAuthoringPublication>}=$props();
 let view=$state(untrack(()=>publication.snapshot()));
 let retain=$state(true);
 let acknowledged=$state(false);
 let previewInputs=$state<Record<string,string>>({});
 let inputError=$state('');
 let candidateKey='';
 onMount(()=>publication.subscribe(value=>{view=value;const key=value.candidate?.reviewHash??'';if(key!==candidateKey){candidateKey=key;acknowledged=false;previewInputs={};retain=value.candidate?.retainDimensionValues??true;}}));
 const busy=$derived(view.phase==='busy'||view.phase==='unknown');
 function inputs(){return Object.fromEntries((view.candidate?.parameterSummary??[]).filter(p=>p.selected&&previewInputs[p.parameterId]).map(p=>[p.parameterId,p.valueType==='timeRange'?JSON.parse(previewInputs[p.parameterId]):p.valueType==='string[]'?previewInputs[p.parameterId].split(',').map(v=>v.trim()):previewInputs[p.parameterId]]));}
 function preview(){acknowledged=false;publication.clearPreview();try{const values=inputs();inputError='';void publication.preview(values);}catch{inputError='时间区间须填写合法 JSON，包含 start、end、granularity。';}}
</script>
<section aria-label="发布候选评审" class="review">
 <h2>准备发布</h2><p role="status" data-testid="publication-status">{view.message}</p>
 {#if view.phase==='unknown'}<button onclick={()=>publication.lookup()}>查询原发布操作</button>{/if}
 {#if !view.candidate}
  <label><input type="checkbox" bind:checked={retain} disabled={busy}/>发布时保留具体维度取值</label><button disabled={busy} onclick={()=>publication.prepare(retain)}>准备参数候选</button>
 {:else}
  {@const candidate=view.candidate}
  <p>来源修订：<code>{candidate.ref.source.revisionId}</code> · 候选版本：<code>{candidate.ref.candidateVersion}</code></p>
  <p>影响数据源：{candidate.affectedDataSources.join('、')||'无'}</p>
  <ul aria-label="候选差异">{#each candidate.diff as diff}<li>{diff.summary}{#if diff.before!==undefined}<small>原值：{JSON.stringify(diff.before)}</small>{/if}{#if diff.after!==undefined}<small>候选值：{JSON.stringify(diff.after)}</small>{/if}{#if diff.sourcePath}<small>来源：{diff.sourcePath}</small>{/if}{#if diff.candidatePath}<small>候选：{diff.candidatePath}</small>{/if}</li>{/each}</ul>
  <table><caption>参数候选</caption><thead><tr><th>选择</th><th>参数与作用范围</th><th>取值状态</th><th>预览取值</th></tr></thead><tbody>
   {#each candidate.parameterSummary as p}<tr>
    <td><input type="checkbox" aria-label={`选择参数 ${p.label}`} checked={p.selected} disabled={busy||p.extractionKind===null} onchange={event=>publication.revise({parameterSelections:[{parameterId:p.parameterId,selected:event.currentTarget.checked}]})}/></td>
    <td>{p.label} · {p.valueType} · {p.required?'必填':'可选'}<small>{p.targets.map(t=>`${t.dataSourceId}.${t.queryField}`).join('、')||'页面内参数消费者'}</small></td>
    <td>{p.valueState==='retained'?JSON.stringify(p.defaultValue):p.valueState==='missing'?'缺少默认取值':'未选择'}</td>
    <td>{#if p.selected}<input aria-label={`预览取值 ${p.label}`} bind:value={previewInputs[p.parameterId]} placeholder={p.valueType==='string[]'?'多个值用逗号分隔':'本次预览取值'} disabled={busy} oninput={()=>{acknowledged=false;publication.clearPreview();}}/>{/if}</td>
   </tr>{/each}
  </tbody></table>
  {#if candidate.document.schemaVersion !== '6.5'}<label><input type="checkbox" checked={candidate.retainDimensionValues} disabled={busy} onchange={event=>publication.revise({retainDimensionValues:event.currentTarget.checked})}/>发布时保留具体维度取值</label>{:else}<p>发布保存无值模板；本次预览值不会保存。</p>{/if}
  {#each candidate.validation.issues as issue}<p role={issue.severity==='blocking'?'alert':'status'}>{issue.severity==='blocking'?'阻断':'提示'}：{issue.message} {issue.path??''}</p>{/each}
  <button disabled={busy} onclick={preview}>预览当前候选</button>
  {#if inputError}<p role="alert">{inputError}</p>{/if}
  {#if view.preview}<div aria-label="候选执行预览"><RuntimeView document={view.preview.document} execution={view.preview} {dataGateway}/></div>{/if}
  <label><input type="checkbox" bind:checked={acknowledged} disabled={busy||!view.preview||!candidate.validation.valid}/>我已核对当前候选、来源修订及保留取值选择</label>
  <button disabled={busy||!view.preview||!candidate.validation.valid||!acknowledged} onclick={()=>{acknowledged=false;void publication.confirmAndPublish();}}>人工确认并发布</button>
  <p>修改页面内容须先取消评审，返回草稿保存后重新准备。候选有效期与租约由管理服务校验。</p>
 {/if}
 <button disabled={view.phase==='published'} onclick={()=>{acknowledged=false;void publication.cancel();}}>取消发布评审</button>
 {#if view.published}<p data-testid="published-reference">模板 {view.published.templateId} / {view.published.templateRevisionId}，来源修订 {view.published.source.revisionId}</p>{/if}
</section>
<style>
 .review{padding:20px;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--text)}h2{font-size:18px}p,label{display:block;margin:12px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border);vertical-align:top}small{display:block;color:var(--muted);overflow-wrap:anywhere}button{margin:8px 8px 8px 0;padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)}button:disabled{opacity:.45}input:not([type=checkbox]){max-width:180px;width:100%;padding:6px}code{overflow-wrap:anywhere}
</style>
