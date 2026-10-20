<script lang="ts">
  // Throwaway multi-selection / hierarchical candidate panel, not a public UI API.
  import { popoverPosition, observePopover } from '../../src/shared/popover';
  let { label, options, value, onchange, disabled=false, reason='', allMeansUnlimited=false }: {label:string;options:(string|{value:string;label:string})[];value:string[];onchange:(v:string[])=>void;disabled?:boolean;reason?:string;allMeansUnlimited?:boolean}=$props();
  const items=$derived(options.map(o=>typeof o==='string'?{value:o,label:o}:o));
  const allSelected=$derived(items.length>0&&items.every(o=>value.includes(o.value)));
  let trigger:HTMLButtonElement;
  let panel:HTMLDivElement;
  let search=$state('');let open=$state(false);let left=$state(0);let top=$state(0);
  function place(){const p=popoverPosition(trigger,panel);left=p.left;top=p.top;}
  $effect(()=>{if(open)return observePopover(trigger,place);});
  $effect(()=>{if(disabled&&open){panel.hidePopover();open=false;}});
  function toggle(v:string){onchange(value.includes(v)?value.filter(x=>x!==v):[...value,v]);}
</script>
<button class="select" bind:this={trigger} {disabled} title={reason} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onclick={()=>{if(open)panel.hidePopover();else{panel.showPopover();place();panel.querySelector<HTMLInputElement>('input')?.focus();}open=!open;}}><span>{allMeansUnlimited&&allSelected?'不限（是/否均选）':value.length?value.map(x=>items.find(o=>o.value===x)?.label??x).join('、'):'不限'}</span><span>⌄</span></button>
<div bind:this={panel} popover="auto" class="panel" role="dialog" aria-label={label+'候选'} tabindex="-1" style:left="{left}px" style:top="{top}px" ontoggle={e=>open=e.newState==='open'} onkeydown={e=>{if(e.key==='Escape')trigger.focus();}}>
  <strong>{label}</strong><input aria-label={'搜索'+label+'候选'} placeholder="搜索候选" bind:value={search}/>
  <div class="bulk"><button onclick={()=>onchange([])}>不限（不加条件）</button><button onclick={()=>onchange(items.map(o=>o.value))}>全选候选</button></div>
  <div class="items">{#each items.filter(x=>x.label.includes(search)) as option}<label><input type="checkbox" checked={value.includes(option.value)} onchange={()=>toggle(option.value)}/><span>{option.label}</span></label>{/each}</div>
  <small>{allMeansUnlimited&&allSelected?'两项均选，不加该条件':value.length+' 项已选 · 即时应用'}{label==='区域'?' · 父级与叶级代码分开保留':''}</small>
</div>
<style>
 .select{height:32px;width:174px;max-width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #c9cdd4;background:var(--surface,#fff);color:inherit;border-radius:5px;padding:0 10px;font:inherit}.select span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.select:disabled{background:#f4f5f7;color:#9299a2;cursor:not-allowed}.panel{position:fixed;inset:auto;margin:0;border:1px solid #e3e7ed;border-radius:8px;padding:16px;width:300px;max-width:calc(100vw - 24px);box-sizing:border-box;box-shadow:0 8px 32px #172c4930;color:var(--text,#202a39);background:var(--surface,#fff);font:13px 'PingFang SC',sans-serif}.panel>input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #c9cdd4;border-radius:4px;margin:12px 0}.items{max-height:230px;overflow:auto}.items label{display:flex;align-items:center;gap:8px;padding:9px 0}.bulk{display:flex;justify-content:space-between;margin-bottom:8px}.bulk button{border:0;background:none;color:#1476ff;cursor:pointer;padding:0}small{display:block;border-top:1px solid #eee;padding-top:12px;margin-top:8px;color:#777}button:focus-visible,input:focus-visible{outline:2px solid #1476ff;outline-offset:2px}
</style>
