<script lang="ts">
import {Selection,Select} from '../../src';
let values=$state(['SZ']);let multiple=$state(false);let searchable=$state(true);let disabled=$state(false);let policy=$state<'independent'|'descendants'|'leaf'>('independent');let calls=$state(0);let status=$state('');
const options=[{value:'CN',label:'中国地区部',children:[{value:'SZ',label:'深圳代表处'},{value:'BJ',label:'北京代表处'}]},{value:'EU',label:'欧洲地区部',children:[{value:'DE',label:'德国代表处'}]}];
</script>
<main><h1>选择组件验收</h1><label><input type="checkbox" bind:checked={multiple}/>多选</label><label><input type="checkbox" bind:checked={searchable}/>搜索</label><label><input type="checkbox" bind:checked={disabled}/>禁用</label>
<label>规则<select bind:value={policy}><option value="independent">独立</option><option value="descendants">父选后代</option><option value="leaf">叶子</option></select></label>
<label>候选状态<select bind:value={status}><option value="">正常</option><option>候选项加载中…</option><option>无候选项</option><option>候选项不可用</option><option>候选项加载失败(UNKNOWN)</option></select></label>
<div class="field"><Selection label="区域" tree {options} value={values} {multiple} {searchable} {disabled} treeSelection={policy} clearable statusText={status || undefined} onchange={next=>{values=next;calls++;}}/></div>
<button onclick={()=>values=['SZ','BJ','DE','UNKNOWN-LONG-CODE']}>装载多标签</button><output aria-label="值">{JSON.stringify(values)}</output><output aria-label="变更次数">{calls}</output>
<div class="field"><Select label="普通单选" options={[{value:'A',label:'选项 A'},{value:'B',label:'选项 B'}]}/></div></main>
<style>main{font:14px Arial;padding:24px;display:grid;gap:16px;max-width:500px}.field{width:240px;max-width:100%}</style>
