<script lang="ts">
  import {Input,Textarea} from '@metriccanvas/ui';
  import type {PageInfoRecord} from '../integration/contract';
  let {value,disabled=false,onchange,onreplace}:{value:PageInfoRecord;disabled?:boolean;onchange:(value:PageInfoRecord)=>void;onreplace?:(value:boolean)=>void}=$props();
  let replace=$state(false);
  function field(key:'title'|'description'|'accessPath',text:string){onchange({...value,[key]:text});}
</script>
<div class="fields">
  <div><p>页面标题</p><Input label="页面标题" value={value.title} disabled={disabled||(value.titleIsBound&&!replace)} oninput={text=>field('title',text)}/>
  {#if value.titleIsBound}<label><input type="checkbox" checked={replace} {disabled} onchange={event=>{replace=event.currentTarget.checked;onreplace?.(replace);}}/>改为固定标题</label>{/if}</div>
  <div><p>页面描述</p><Textarea label="页面描述" value={value.description} {disabled} oninput={text=>field('description',text)} rows={3}/></div>
  <div><p>可访问路径</p><Input label="可访问路径" value={value.accessPath??''} disabled={disabled||value.accessPath===undefined} oninput={text=>field('accessPath',text)}/>
  {#if value.accessPath===undefined}<small>当前接口未提供访问路径维护能力。</small>{/if}</div>
</div>
<style>.fields{display:grid;gap:20px}p{margin:0 0 8px;font-size:14px}small,label{display:block;margin-top:8px;color:#808080;font-size:12px}</style>
