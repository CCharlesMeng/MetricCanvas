<script lang="ts">
  import {popoverPosition,observePopover} from '../../src/shared/popover';
  export type TreeNode={id:string;label:string;children:TreeNode[]};
  let {label,nodes,value,onchange,disabled=false,reason=''}:{label:string;nodes:TreeNode[];value:string[];onchange:(v:string[])=>void;disabled?:boolean;reason?:string}=$props();
  let trigger:HTMLButtonElement;let panel:HTMLDivElement;
  let open=$state(false);let left=$state(0);let top=$state(0);let search=$state('');let level=$state('leaf');let collapsed=$state<string[]>([]);
  const all=$derived(nodes.flatMap(n=>[n,...n.children]));
  const selected=$derived(value.map(id=>all.find(n=>n.id===id)?.label??id).join('、'));
  function place(){const p=popoverPosition(trigger,panel);left=p.left;top=p.top;}
  $effect(()=>{if(value.length)level=nodes.some(n=>n.id===value[0])?'parent':'leaf';});
  $effect(()=>{if(open)return observePopover(trigger,place);});
  $effect(()=>{if(open&&disabled)panel.hidePopover();});
  function changeLevel(next:string){if(next===level)return;level=next;onchange([]);}
  function choose(id:string){const allowed=level==='parent'?nodes.map(n=>n.id):nodes.flatMap(n=>n.children.map(c=>c.id));const old=value.filter(v=>allowed.includes(v));onchange(old.includes(id)?old.filter(v=>v!==id):[...old,id]);}
</script>
<button class="select" bind:this={trigger} {disabled} title={reason} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onclick={()=>{if(open)panel.hidePopover();else{panel.showPopover();place();panel.querySelector<HTMLInputElement>('input')?.focus();}}}><span>{selected||'授权范围内不限'}</span>⌄</button>
<div class="panel" bind:this={panel} popover="auto" role="dialog" aria-label={label+'树形候选'} tabindex="-1" style:left="{left}px" style:top="{top}px" ontoggle={e=>open=e.newState==='open'} onkeydown={e=>{if(e.key==='Escape')trigger.focus();}}>
  <b>{label}</b><input aria-label={'搜索'+label+'树'} placeholder="搜索父级或叶级" bind:value={search}/>
  <div class="levels" role="group" aria-label={label+'选择层级'}><button aria-pressed={level==='parent'} onclick={()=>changeLevel('parent')}>{label==='区域'?'地区部':'一级行业'}</button><button aria-pressed={level==='leaf'} onclick={()=>changeLevel('leaf')}>{label==='区域'?'代表处':'二级行业'}</button></div>
  <div class="bulk"><button onclick={()=>onchange([])}>{label==='区域'?'全球（授权范围内）':'不限行业'}</button><button onclick={()=>onchange(level==='parent'?nodes.map(n=>n.id):nodes.flatMap(n=>n.children.map(c=>c.id)))}>全选当前层级</button></div>
  <div class="nodes">{#each nodes.filter(n=>n.label.includes(search)||n.children.some(c=>c.label.includes(search))) as n}
    <div class="parent"><button class="chevron" aria-label={(collapsed.includes(n.id)?'展开':'收起')+n.label} aria-expanded={!collapsed.includes(n.id)} onclick={()=>collapsed=collapsed.includes(n.id)?collapsed.filter(x=>x!==n.id):[...collapsed,n.id]}>{collapsed.includes(n.id)?'▸':'▾'}</button><label><input type="checkbox" disabled={level!=='parent'} checked={value.includes(n.id)} onchange={()=>choose(n.id)}/>{n.label}</label></div>
    {#if !collapsed.includes(n.id)||search}{#each n.children.filter(c=>!search||n.label.includes(search)||c.label.includes(search)) as child}<label class="leaf"><input type="checkbox" disabled={level!=='leaf'} checked={value.includes(child.id)} onchange={()=>choose(child.id)}/>{child.label}<code>{child.id}</code></label>{/each}{/if}
  {/each}</div>
  <small>切换层级清理原层级选择；父级按本级匹配，不隐式勾选叶级。</small><output>已应用代码：{value.join(', ')||'无区域/行业附加条件'}</output>
</div>
<style>
 .select{height:32px;width:174px;max-width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #c9cdd4;background:var(--surface,#fff);color:inherit;border-radius:5px;padding:0 10px;font:inherit}.select span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.select:disabled{opacity:.55}.panel{position:fixed;inset:auto;margin:0;width:345px;max-width:calc(100vw - 16px);padding:16px;border:1px solid #e1e6ed;border-radius:8px;box-shadow:0 8px 32px #172c4930;background:var(--surface,#fff);color:var(--text,#303949);font:13px/1.5 'PingFang SC',sans-serif}.panel>input{display:block;width:100%;padding:8px;border:1px solid #c9cdd4;border-radius:4px;margin:12px 0}.levels,.bulk,.parent{display:flex;align-items:center;gap:8px}.levels button{padding:5px 10px;border:1px solid #ccd6e4;border-radius:4px;background:none}.levels [aria-pressed=true]{color:#1476ff;background:#edf5ff}.bulk{justify-content:space-between;margin:12px 0}.bulk button,.chevron{background:none;border:0;color:#1476ff;padding:0}.nodes{max-height:230px;overflow:auto}.parent{padding:8px 0}.parent label,.leaf{display:flex;align-items:center;gap:6px}.leaf{padding:8px 0 8px 28px}.leaf code{margin-left:auto;font-size:10px;color:#8e9bad}.chevron{width:18px}small,output{display:block;font-size:10px;color:#8995a6;margin-top:10px}button:focus-visible,input:focus-visible{outline:2px solid #1476ff;outline-offset:2px}
</style>
