<script lang="ts">
  import { MultiSelect, TreeSelect, RangePicker, Select, Dropdown, DatePicker } from '../../src';
  const options = Array.from({ length: 30 }, (_, index) => ({ value: String(index), label: `候选${index}` }));
</script>

<main>
  <div data-control="multi"><MultiSelect label="多选" value={[]} {options} onchange={() => {}} /></div>
  <div data-control="tree"><TreeSelect label="树选" value={[]} options={[{key:'root',label:'分组',children:options.map(option=>({...option,key:option.value}))}]} onchange={() => {}} /></div>
  <div data-control="range"><RangePicker label="范围" value={{}} onchange={() => {}} /></div>
  <div data-control="select"><Select label="单选" {options} /></div>
  <div data-control="menu"><Dropdown label="菜单" {options} /></div>
  <div data-control="date"><DatePicker label="日期" precision="date" value={null} onchange={() => {}} /></div>
</main>

<style>main{padding:100vh 16px}main>div{width:260px;margin-bottom:100vh}</style>
