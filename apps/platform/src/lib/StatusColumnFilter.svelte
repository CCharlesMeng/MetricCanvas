<script lang="ts">
  import {untrack} from 'svelte';
  let {value,onchange}:{value:string;onchange:(value:string)=>void}=$props();
  const options=[{value:'',label:'全部'},{value:'draft',label:'草稿'},{value:'published',label:'已发布'}];
  const descriptionId=untrack(()=>`status-filter-${crypto.randomUUID()}`);
  let trigger:HTMLButtonElement;
  let panel:HTMLDivElement;
  let open=$state(false),left=$state(0),top=$state(0);
  function close(restoreFocus=false){panel.hidePopover();open=false;if(restoreFocus)trigger.focus();}
  function place(){
    const rect=trigger.getBoundingClientRect(),viewport=window.visualViewport;
    const x=viewport?.offsetLeft??0,y=viewport?.offsetTop??0,width=viewport?.width??innerWidth,height=viewport?.height??innerHeight;
    const size=panel.getBoundingClientRect();
    left=Math.max(x+8,Math.min(rect.left,x+width-size.width-8));
    top=rect.bottom+4+size.height<=y+height-8?rect.bottom+4:Math.max(y+8,rect.top-size.height-4);
    if(rect.bottom<y||rect.top>y+height)close();
  }
  function toggle(){
    if(open){close(true);return;}
    panel.showPopover();open=true;place();
    panel.querySelector<HTMLButtonElement>('button[aria-selected="true"]')?.focus();
  }
  function keys(event:KeyboardEvent){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();const items=[...panel.querySelectorAll<HTMLButtonElement>('button')];
    const current=items.indexOf(event.target as HTMLButtonElement);
    const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[index]?.focus();
  }
  $effect(()=>{
    if(!open)return;
    const controller=new AbortController(),settings={signal:controller.signal};
    document.addEventListener('scroll',place,{...settings,capture:true});window.addEventListener('resize',place,settings);
    window.visualViewport?.addEventListener('resize',place,settings);window.visualViewport?.addEventListener('scroll',place,settings);
    return()=>controller.abort();
  });
</script>

<div class="column-filter">
  <span>状态</span>
  <button bind:this={trigger} class="filter-trigger" class:active={value!==''} type="button" aria-label="页面状态" aria-describedby={descriptionId} aria-haspopup="listbox" aria-expanded={open} title={`筛选状态：${options.find(option=>option.value===value)?.label}`} onclick={toggle} onkeydown={event=>{if(event.key==='ArrowDown'){event.preventDefault();if(!open)toggle();}}}>
    <!-- OpenTiny IconFilter 3.32.0, Copyright TinyVue Authors / Huawei Cloud. MIT: packages/ui/LICENSE. -->
    <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M12.31 1.84H3.68c-.3 0-.59.11-.82.3l-.11.09c-.46.47-.5 1.22-.08 1.74l3.18 3.89v5.78c0 .28.23.5.5.5H9.72c.23-.05.41-.25.41-.5l-.01-5.78 3.19-3.89c.19-.23.3-.53.3-.82 0-.72-.59-1.31-1.3-1.31zm0 1c.16 0 .3.14.3.31 0 .06-.03.13-.07.18l-3.3 4.04-.05.07c-.04.07-.06.15-.06.24l-.01 5.46H6.85V7.68c0-.11-.03-.23-.11-.31L3.45 3.33c-.11-.12-.09-.31.04-.42.06-.04.12-.07.19-.07h8.63z"/></svg>
  </button>
  <span class="sr-only" id={descriptionId}>当前筛选：{options.find(option=>option.value===value)?.label}</span>
</div>
<div bind:this={panel} class="filter-panel" popover="auto" role="listbox" aria-label="页面状态" tabindex="-1" style:left="{left}px" style:top="{top}px" ontoggle={()=>open=panel.matches(':popover-open')} onkeydown={keys}>
  {#each options as option(option.value)}
    <button type="button" role="option" aria-selected={option.value===value} class:selected={option.value===value} onclick={()=>{close(true);onchange(option.value);}}><span class="radio" aria-hidden="true"></span>{option.label}</button>
  {/each}
</div>

<style>
  /* TinyVue OS Grid filter.less: 4px icon spacing, 14px icon, #999 idle,
     simple white panel, 10px inset, 24px options, 0 2px 12px #0003 shadow. */
  .column-filter{display:inline-flex;align-items:center;white-space:nowrap;color:#595959;line-height:21px;font-size:14px}
  .filter-trigger{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;padding:0;width:24px;height:24px;margin-left:4px;cursor:pointer;color:#999}
  .filter-trigger svg{width:14px;height:14px;fill:currentColor}.filter-trigger:hover,.filter-trigger.active{color:#191919}.filter-trigger:focus-visible{outline:2px solid #1476ff;outline-offset:-2px;border-radius:2px}
  .filter-panel{position:fixed;inset:auto;margin:0;border:0;padding:10px;min-width:80px;width:160px;max-width:calc(100vw - 16px);background:#fff;color:#191919;font-size:14px;line-height:24px;box-shadow:0 2px 12px #0003}
  .filter-panel button{display:flex;align-items:center;gap:8px;width:100%;height:24px;padding:0 8px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.filter-panel button:hover,.filter-panel button:focus-visible{background:#f5f5f5}.filter-panel button:focus-visible{outline:2px solid #1476ff;outline-offset:-2px}
  .radio{position:relative;box-sizing:border-box;width:18px;height:18px;border:1px solid #c2c2c2;border-radius:50%;flex:none}.selected .radio{border-color:#1476ff}.selected .radio::after{content:'';position:absolute;inset:4px;border-radius:50%;background:#1476ff}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style>
