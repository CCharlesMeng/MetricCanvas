<svelte:options css="injected" />
<script lang="ts">
  import { tick } from 'svelte';
  import Theme from '../../shared/Theme.svelte';
  import { observePopover, popoverPosition } from '../../shared/popover';
  import type { UiTreeOption } from '../../types';
  import Icon from './SelectionIcon.svelte';
  import { selectionNodes, flattenNodes, filterNodes, selectionState, toggleSelection, type SelectionNode, type TreeSelection } from './selection';

  let {options, value = [], label, multiple = true, tree = false, searchable = true,
    treeSelection = 'independent', clearable = false, disabled = false, placeholder = '请选择', statusText, statusError = false, required = false, onretry, onchange}:
    {options: UiTreeOption[]; value?: string[]; label: string; multiple?: boolean; tree?: boolean;
     searchable?: boolean; treeSelection?: TreeSelection; disabled?: boolean; placeholder?: string;
     statusText?: string; statusError?: boolean; clearable?: boolean; required?: boolean; onretry?:()=>void; onchange?: (value: string[]) => void} = $props();

  let trigger: HTMLButtonElement;
  let popup: HTMLDivElement;
  let searchInput = $state<HTMLInputElement>();
  let tagStrip = $state<HTMLDivElement>();
  let open = $state(false);
  let keyword = $state('');
  let pointerWasOpen = false;
  let expanded = $state(new Set<string>());
  let left = $state(0), top = $state(0), width = $state(0);
  const nodes = $derived(selectionNodes(options));
  const flat = $derived(flattenNodes(nodes));
  const visible = $derived(filterNodes(nodes, keyword));
  const labels = $derived(new Map(flat.map(node => [node.value, node])));
  const policy = $derived(tree ? treeSelection : 'independent');
  const selectable = $derived(flat.filter(node => !node.disabled && node.selectable !== false && (policy !== 'leaf' || !node.children?.length)));
  const allSelected = $derived(selectable.length > 0 && selectable.every(node => value.includes(node.value)));
  const someSelected = $derived(selectable.some(node => value.includes(node.value)));
  const searchActive = $derived(searchable && keyword.trim().length > 0);
  $effect(() => { if (!searchable) keyword = ''; });
  $effect(() => { if (disabled && open) close(false); });
  $effect(() => { if (open) return observePopover(trigger, place); });
  $effect(()=>{if(!open||!trigger)return;const observer=new MutationObserver(()=>{if(trigger.closest('[inert]'))close(false);});for(let node:HTMLElement|null=trigger;node;node=node.parentElement)observer.observe(node,{attributes:true,attributeFilter:['inert']});return()=>observer.disconnect();});
  // Reposition after filtering/expanding, without persisting any business selection.
  $effect(() => { visible; expanded; if (open) tick().then(place); });

  function place() {
    if (!open) return;
    const rect = popoverPosition(trigger, popup);
    left = rect.left; top = rect.top; width = rect.width;
    if (!rect.visible) close(false);
  }
  async function show() {
    if (disabled || popup.matches(':popover-open')) return;
    keyword = '';
    popup.showPopover(); open = true;
    await tick(); place();
    await tick();
    if(!popup.matches(':popover-open'))return;
    if (searchable) searchInput?.focus({preventScroll:true});
    else popup.querySelector<HTMLElement>('[data-selection-choice]:not(:disabled)')?.focus({preventScroll:true});
  }
  function rememberTriggerState() { pointerWasOpen = popup.matches(':popover-open'); }
  function toggleFromClick(event: MouseEvent) {
    if (disabled) return;
    // Native light-dismiss may run before click. Decide from the pointer-down state.
    if (event.detail === 0 ? popup.matches(':popover-open') : pointerWasOpen) close();
    else void show();
  }
  function close(focus = true) {
    popup?.hidePopover(); open = false;
    if (focus && !disabled) trigger?.focus();
  }
  function branchOpen(node: SelectionNode) { return searchActive || expanded.has(node.value); }
  function expand(node: SelectionNode, force?: boolean) {
    const next = new Set(expanded);
    if (force ?? !next.has(node.value)) next.add(node.value); else next.delete(node.value);
    expanded = next;
  }
  function choose(node: SelectionNode) {
    if (disabled || node.disabled) return;
    if ((!multiple || policy === 'independent') && node.selectable === false || policy === 'leaf' && node.children?.length && !multiple) { expand(node); return; }
    const original = flat.find(candidate => candidate.value === node.value) ?? node;
    const next = toggleSelection(value, original, multiple, policy);
    if (required && next.length === 0) return;
    if (next.join('\0') !== value.join('\0')) onchange?.(next);
    if (!multiple) close();
  }
  function remove(candidate: string) {
    if (disabled || required && value.length <= 1) return;
    onchange?.(value.filter(item => item !== candidate));
    tick().then(() => trigger?.focus());
  }
  function scrollTags(event: WheelEvent) {
    if (!tagStrip || tagStrip.scrollWidth <= tagStrip.clientWidth) return;
    event.preventDefault(); tagStrip.scrollLeft += event.deltaX || event.deltaY;
  }
  function popupKeys(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'Tab') { close(); return; }
    const target = event.target as HTMLElement;
    const choices = [...popup.querySelectorAll<HTMLButtonElement>('[data-selection-choice]:not(:disabled)')];
    const index = choices.indexOf(target as HTMLButtonElement);
    if (tree && (event.key === 'ArrowRight' || event.key === 'ArrowLeft') && index >= 0) {
      const node = flat.find(node => node.value === target.dataset.value);
      if (!node) return;
      event.preventDefault();
      if (event.key === 'ArrowRight' && node.children?.length) {
        if (!branchOpen(node)) expand(node, true); else choices[index + 1]?.focus();
      } else if (event.key === 'ArrowLeft') {
        if (node.children?.length && branchOpen(node) && !searchActive) expand(node, false);
        else target.closest('[role="group"]')?.parentElement?.querySelector<HTMLButtonElement>(':scope > .mc-ui-tree-node__content [data-selection-choice]')?.focus();
      }
      return;
    }
    if (target.tagName === 'INPUT' && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const position = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : event.key === 'ArrowDown' ? (index + 1) % choices.length : event.key === 'ArrowUp' ? (index <= 0 ? choices.length - 1 : index - 1) : -1;
    if (position >= 0) { event.preventDefault(); choices[position]?.focus(); }
  }
</script>

<Theme>
  <div class="mc-selection mc-ui-select" class:is-disabled={disabled} class:has-clear={clearable && !required && value.length > 0} class:is-open={open} onwheel={scrollTags}>
    <div class="mc-ui-input selection-input" class:is-disabled={disabled}>
      <button bind:this={trigger} type="button" class="mc-ui-input__inner selection-trigger" {disabled}
        aria-label={label}
        aria-haspopup={tree ? 'tree' : 'listbox'} aria-expanded={open}
        onpointerdown={rememberTriggerState} onclick={toggleFromClick} onkeydown={event => {if (event.key === 'ArrowDown') {event.preventDefault(); show();}}}>
        <span data-filter-display class:placeholder={!value.length}>{multiple && value.length ? '' : labels.get(value[0])?.label ?? value[0] ?? placeholder}</span>
      </button>
      <span class="mc-ui-input__suffix selection-arrow"><span class="mc-ui-input__suffix-inner"><Icon name="chevron-down"/></span></span>
    </div>
    {#if clearable && !required && value.length}<button type="button" class="selection-clear" aria-label={`清空${label}`} {disabled} onclick={() => {if (!disabled) onchange?.([]);}}><Icon name="close"/></button>{/if}
    {#if multiple && value.length}
      <div bind:this={tagStrip} class="selection-tags mc-ui-select__tags" role="group" aria-label={`${label}已选标签`}>
        <span class="tag-track">{#each value as candidate (candidate)}<span class="tag-item">
          <span class="mc-ui-tag mc-ui-tag--light" class:is-disabled={disabled} title={labels.get(candidate)?.path ?? candidate}>
            <button type="button" class="mc-ui-tag__text tag-label" aria-label={`打开${label}：${labels.get(candidate)?.path ?? candidate}`} {disabled} onpointerdown={rememberTriggerState} onclick={toggleFromClick}>{labels.get(candidate)?.label ?? candidate}</button>
            <button type="button" class="mc-ui-tag__close" aria-label={`移除${label}：${labels.get(candidate)?.path ?? candidate}`} disabled={disabled||required&&value.length<=1} onclick={() => remove(candidate)}><Icon name="close"/></button>
          </span>
        </span>{/each}</span>
      </div>
    {/if}
  </div>
  <div bind:this={popup} popover="auto" class="mc-ui-select-dropdown selection-popup" role="dialog" aria-label={`${label}候选`} tabindex="-1"
    style:left="{left}px" style:top="{top}px" style:min-width="{Math.max(width, searchable || tree || multiple ? 240 : 0)}px"
    ontoggle={() => {open = popup.matches(':popover-open');}} onkeydown={popupKeys}>
    {#if searchable}<div class="mc-ui-input mc-ui-input-underline mc-ui-select-dropdown__search">
      <span class="mc-ui-input__prefix"><Icon name="search"/></span>
      <input bind:this={searchInput} class="mc-ui-input__inner" type="text" aria-label={`搜索${label}`} placeholder="输入关键字搜索" bind:value={keyword}/>
    </div>{/if}
    {#if clearable && !required && !value.length && !statusText && !statusError}<button type="button" class="mc-ui-option mc-ui-select-dropdown__item choice" aria-label="清除筛选" onclick={()=>onchange?.([])}>{placeholder}</button>{/if}
    {#if statusText}<p class="selection-status" role={statusError ? 'alert' : 'status'}>{statusText}</p>{#if statusError && onretry}<button type="button" class="mc-ui-option mc-ui-select-dropdown__item choice" onclick={onretry}>重试</button>{/if}
    {:else if !visible.length}<p class="selection-status" role="status">{searchActive ? '无匹配候选项' : '无候选项'}</p>
    {:else if tree}
      <div class="mc-ui-tree mc-ui-tree--show-line selection-tree" role="tree" aria-label={`${label}选项`} aria-multiselectable={multiple}>
        {#each visible as node (node.value)}{@render treeRow(node, 1)}{/each}
      </div>
    {:else}
      <div role="listbox" aria-label={`${label}选项`} aria-multiselectable={multiple}>
        {#if multiple && !required && !searchActive}<button type="button" class="mc-ui-option mc-ui-select-dropdown__item choice" role="option" aria-selected={allSelected} data-selection-choice onclick={() => onchange?.(allSelected ? value.filter(item => !selectable.some(node => node.value === item)) : [...new Set([...value, ...selectable.map(node => node.value)])])}>
          {@render checkbox(allSelected, someSelected && !allSelected)}<span>全选</span>
        </button>{/if}
        {#each visible as node (node.value)}<button type="button" class="mc-ui-option mc-ui-select-dropdown__item choice" class:selected={value.includes(node.value)} class:is-disabled={node.disabled}
          role="option" aria-selected={value.includes(node.value)} disabled={node.disabled} data-selection-choice data-value={node.value} title={node.value} onclick={() => choose(node)}>
          {#if multiple}{@render checkbox(value.includes(node.value), false)}{/if}<span>{node.label}</span>
        </button>{/each}
      </div>
    {/if}
  </div>
</Theme>

{#snippet checkbox(checked: boolean, partial: boolean)}
  <span class="selection-check mc-ui-checkbox__input" class:is-checked={checked} class:is-indeterminate={partial} aria-hidden="true"><Icon name={partial ? 'halfselect' : checked ? 'checked-sur' : 'check'}/></span>
{/snippet}
{#snippet treeRow(node: SelectionNode, depth: number)}
  {@const state = multiple ? selectionState(flat.find(candidate => candidate.value === node.value) ?? node, value, policy) : {checked:value.includes(node.value), partial:false, targets:[node.value]}}
  {@const canChoose = !node.disabled && (multiple ? state.targets.length > 0 : node.selectable !== false && (policy !== 'leaf' || !node.children?.length))}
  <div class="mc-ui-tree-node" class:is-expanded={branchOpen(node)} role="treeitem" aria-level={depth} aria-selected={state.checked} aria-checked={multiple ? state.partial ? 'mixed' : state.checked : undefined} aria-expanded={node.children?.length ? branchOpen(node) : undefined}>
    <div class="mc-ui-tree-node__content">
      <button type="button" class="mc-ui-tree-node__expand-icon expand" class:is-leaf={!node.children?.length} tabindex="-1" aria-label={`${branchOpen(node) ? '收起' : '展开'}${node.label}`} aria-hidden={!node.children?.length} disabled={!node.children?.length} onclick={() => expand(node)}><Icon name={branchOpen(node) ? 'expand' : 'put-away'}/></button>
      <button type="button" class="tree-choice choice" class:is-disabled={!canChoose} data-selection-choice data-value={node.value} disabled={node.disabled} aria-label={node.label} title={`${node.path} (${node.value})`} onclick={() => choose(node)}>
        {#if multiple}{@render checkbox(state.checked, state.partial)}{/if}<span class="mc-ui-tree-node__label" class:selected={state.checked}>{node.label}</span>
      </button>
    </div>
    {#if node.children?.length && branchOpen(node)}<div class="mc-ui-tree-node__children" role="group">{#each node.children as child (child.value)}{@render treeRow(child, depth + 1)}{/each}</div>{/if}
  </div>
{/snippet}

<style>
  .mc-selection{vertical-align:top;position:relative;width:100%;min-width:0;height:var(--tv-Select-height,32px)}
  .mc-selection .selection-input{display:flex;align-items:center;height:var(--tv-Select-height,32px)}
  .selection-trigger{width:100%;text-align:left;padding-right:var(--tv-size-height-md,32px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .selection-trigger span{overflow:hidden;text-overflow:ellipsis;display:block}.placeholder{color:var(--tv-color-text-placeholder,#808080)}
  .mc-ui-input__suffix{pointer-events:none}.mc-ui-input__suffix-inner{display:flex;align-items:center;height:100%}
  .mc-selection .selection-input .selection-arrow{color:var(--tv-Select-icon-color,#808080)}
  .mc-selection .selection-input .selection-arrow :global(*){pointer-events:none}
  .mc-selection .selection-input .selection-arrow :global(svg){color:var(--tv-Select-icon-color,#808080);fill:currentColor;transition:transform .3s}
  .mc-selection.is-disabled .selection-arrow :global(svg){color:var(--tv-Select-icon-color-disabled,#c2c2c2)}.is-open .selection-arrow :global(svg){transform:rotate(180deg)}
  .mc-selection .selection-tags.mc-ui-select__tags{position:absolute;left:var(--tv-space-md,8px);right:var(--tv-size-height-md,32px);top:0!important;height:var(--tv-Select-height,32px);max-width:none!important;transform:none!important;margin:0;padding:0;display:flex;align-items:center;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;flex-wrap:nowrap;pointer-events:none}
  .selection-clear{position:absolute;right:var(--tv-Input-suffix-right,12px);top:50%;transform:translateY(-50%);display:flex;width:var(--tv-icon-size,16px);height:var(--tv-icon-size,16px);padding:0;border:0;background:transparent;cursor:pointer;color:var(--tv-color-icon,#808080);visibility:hidden;z-index:2}
  .mc-selection.has-clear:not(.is-disabled):hover .selection-clear,.mc-selection.has-clear:not(.is-disabled):focus-within .selection-clear{visibility:visible}
  .mc-selection.has-clear:not(.is-disabled):hover .selection-arrow,.mc-selection.has-clear:not(.is-disabled):focus-within .selection-arrow{visibility:hidden}
  .mc-selection .selection-tags .tag-track{display:flex;flex-wrap:nowrap;width:max-content;align-items:center;gap:var(--tv-space-sm,4px)}.tag-item{display:inline-flex;flex:none}
  .mc-ui-tag{flex:none;white-space:nowrap;margin:0!important}
  .tag-label{pointer-events:auto;appearance:none;border:0;padding:0;background:transparent;color:inherit;font:inherit;line-height:inherit;cursor:pointer;white-space:nowrap;text-align:left}
  .tag-label:focus-visible{outline:2px solid var(--tv-color-text-active,#1476ff);outline-offset:-2px}
  .mc-ui-tag__close{pointer-events:auto;display:inline-flex;border:0;padding:0;background:transparent;align-items:center;cursor:pointer;color:var(--tv-Tag-close-icon-color,#808080)}.mc-ui-tag__close:hover{color:var(--tv-Tag-close-icon-color-hover,#191919)}.mc-ui-tag__close:disabled{color:var(--tv-Tag-close-icon-color-disabled,#c2c2c2)}.mc-ui-tag__close:disabled,.tag-label:disabled{cursor:not-allowed}
  .selection-popup.mc-ui-select-dropdown[popover]{position:fixed;inset:auto;margin:0;border:0;padding:var(--tv-SelectDropdown-padding,8px 0);max-width:calc(100vw - 16px);max-height:min(360px,70vh);overflow:auto;font-size:var(--tv-SelectDropdown-font-size,14px)}
  .mc-ui-input__prefix{position:absolute;left:0;top:0;height:var(--tv-Select-height,32px);display:flex;align-items:center;color:var(--tv-color-icon,#808080)}
  .selection-status{margin:0;padding:var(--tv-space-md,8px) var(--tv-space-xl,16px);color:var(--tv-color-text-weaken,#808080);font-size:var(--tv-font-size-default,14px)}
  .choice{font:inherit;border:0;background:transparent;text-align:left;cursor:pointer;display:flex;align-items:center;gap:var(--tv-space-md,8px);min-width:0}
  .selection-popup .choice.mc-ui-option{display:flex;align-items:center;gap:var(--tv-space-md,8px);box-sizing:border-box;width:100%;padding:var(--tv-Option-padding,0px 16px)}
  .selection-popup .choice.mc-ui-option .selection-check :global(svg){margin-right:0}
  .choice:focus-visible{outline:2px solid var(--tv-color-text-active,#1476ff);outline-offset:-2px;background:var(--tv-color-bg-hover,#f5f5f5)}
  .selection-check{display:inline-flex;flex:none;color:var(--tv-color-border,#c2c2c2)}
  .selection-check.is-checked,.selection-check.is-indeterminate{color:var(--tv-color-text-active,#1476ff)}
  .selection-popup.mc-ui-select-dropdown .selection-tree.mc-ui-tree{padding:0 var(--tv-space-xl,16px)}.mc-ui-tree-node__content{display:flex;align-items:center;height:var(--tv-Tree-node-content-height,32px);position:relative}
  .expand{display:flex;align-items:center;justify-content:center;width:var(--tv-Tree-node-showline-icon-size,16px);height:var(--tv-Tree-node-showline-icon-size,16px);padding:0;margin-right:var(--tv-space-md,8px);border:0;background:transparent;color:var(--tv-color-icon,#808080);cursor:pointer;flex:none;z-index:1}
  .expand.is-leaf{visibility:hidden}.tree-choice{height:var(--tv-Tree-node-content-height,32px);flex:1;padding:0;white-space:nowrap}.tree-choice.is-disabled{color:var(--tv-color-text-disabled,#c2c2c2)}
  .mc-ui-tree-node__children{margin-left:calc(var(--tv-Tree-node-indent,16px) + var(--tv-Tree-node-guide-line-width,8px));position:relative;overflow:visible!important}
  .mc-ui-tree-node__children:before{content:'';position:absolute;left:calc(-1 * var(--tv-Tree-node-indent,16px));top:0;bottom:calc(var(--tv-Tree-node-content-height,32px) / 2);border-left:1px solid var(--tv-Tree-node-guide-line-border-color,#f0f0f0)}
  .mc-ui-tree-node__children>.mc-ui-tree-node>.mc-ui-tree-node__content:before{content:'';position:absolute;left:calc(-1 * var(--tv-Tree-node-indent,16px));top:calc(var(--tv-Tree-node-content-height,32px) / 2);width:var(--tv-Tree-node-indent,16px);border-top:1px solid var(--tv-Tree-node-guide-line-border-color,#f0f0f0)}
  .mc-ui-tree-node__label.selected{color:var(--tv-color-text-active,#1476ff)}
</style>
