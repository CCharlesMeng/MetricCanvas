<script lang="ts">
 import {Button,Input,Textarea,Select,Tabs,Tag,Empty,Grid,Pagination,Dropdown,Dialog,DatePicker,type DateRangeValue,type GridSort} from '@metriccanvas/ui';
 let text=$state('');let note=$state('');let choice=$state('a');let tab=$state('a');let page=$state(1);let sorted=$state<GridSort>();let dialog=$state(false);let saved=$state('');let action=$state('');let disabled=$state(false);let date=$state<DateRangeValue|null>(null);let mode=$state('date');
 const boundary=new URLSearchParams(location.search).get('boundary');
 const options=[{value:'a',label:'选项一'},{value:'b',label:'选项二'},{value:'c',label:'禁用选项',disabled:true}];const rows=boundary==='empty'?[]:[{id:'one',name:boundary==='long'?'长页面名称与说明'.repeat(40):'第一行'},{id:'two',name:'第二行'}];
</script>
<main>
 <h1>MetricCanvas UI</h1><label><input type="checkbox" bind:checked={disabled}/>禁用控件</label>
 <section aria-label="表单"><Input value={text} oninput={value=>text=value} label="标题" {disabled}/><Textarea value={note} oninput={value=>note=value} label="说明" {disabled}/><Button variant="primary" {disabled} onclick={()=>saved=text+':'+note}>保存输入</Button><output aria-label="保存结果">{saved}</output><Select value={choice} {options} onchange={value=>choice=value} label="选择" {disabled}/></section>
 <Tabs {options} value={tab} onchange={value=>tab=value}/><p data-choice>{choice}:{tab}</p><Tag type="success">已确认</Tag><Empty/>
 <Grid {rows} columns={[{key:'name',label:'名称',sortable:true},{key:'action',label:'操作'}]} rowKey={row=>row.id} sort={sorted} onsort={sort=>sorted=sort}>{#snippet cell(row,column)}{#if column.key==='name'}{row.name}{:else}<Button onclick={()=>action=row.id}>打开</Button>{/if}{/snippet}</Grid><output aria-label="排序结果">{JSON.stringify(sorted)}</output>
 <Pagination {page} total={100} pageSize={20} onchange={value=>page=value}/><output aria-label="当前页">{page}</output>
 <Dropdown {options} onselect={value=>action=value}/><output aria-label="菜单结果">{action}</output><Button onclick={()=>dialog=true}>打开对话框</Button><Dialog open={dialog} title="确认操作" onclose={()=>dialog=false}><Input label="对话框输入"/>{#snippet footer()}<Button onclick={()=>dialog=false}>确认</Button>{/snippet}</Dialog>
 <label>日期形态<select bind:value={mode}><option value="year">年份</option><option value="quarter">季度</option><option value="date">日期</option><option value="month">月份</option><option value="daterange">日期范围</option><option value="monthrange">月份范围</option></select></label><div data-date><DatePicker label="日期选择" precision={mode==='year'?'year':mode==='quarter'?'quarter':mode.startsWith('month')?'month':'date'} range={mode.endsWith('range')} value={date} onchange={value=>date=value} {disabled}/></div><output aria-label="日期结果">{JSON.stringify(date)}</output>
</main>
<style>main{padding:24px;max-width:1000px;margin:auto}section{display:grid;gap:16px;max-width:480px}main>:global(*){margin-bottom:16px}h1{font:600 20px Arial}main{font:14px Arial}@media(max-width:600px){main{padding:16px}}</style>
