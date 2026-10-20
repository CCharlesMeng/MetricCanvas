<svelte:options css="injected" />
<script lang="ts">
 import {popoverPosition,observePopover,movePopoverFocus} from '../../shared/popover';
 import Theme from '../../shared/Theme.svelte';import type {UiOption} from '../../types';import Icon from '../date-picker/DatePickerIcon.svelte';
 let {value='',options,onchange,disabled=false,label,placeholder='请选择'}:{value?:string;options:UiOption[];onchange?:(value:string)=>void;disabled?:boolean;label:string;placeholder?:string}=$props();
 let trigger:HTMLButtonElement;let popup:HTMLDivElement;let open=$state(false);let left=$state(0);let top=$state(0);let width=$state(0);
 function place(){const rect=popoverPosition(trigger,popup);left=rect.left;top=rect.top;width=rect.width;if(!rect.visible)close();}
 function show(){if(disabled)return;popup.showPopover();open=true;place();popup.querySelector<HTMLButtonElement>('button[aria-selected="true"],button:not(:disabled)')?.focus();}
 function close(){popup.hidePopover();open=false;trigger.focus();}
 function keys(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();close();}else movePopoverFocus(e,popup);}
 $effect(()=>{if(open)return observePopover(trigger,place);});
 $effect(()=>{if(disabled&&open)close();});
 $effect(()=>{if(!open||!trigger)return;const observer=new MutationObserver(()=>{if(trigger.closest('[inert]'))close();});for(let node:HTMLElement|null=trigger;node;node=node.parentElement)observer.observe(node,{attributes:true,attributeFilter:['inert']});return()=>observer.disconnect();});
</script>
<Theme><div class="mc-ui-select"><div class="mc-ui-input" class:is-disabled={disabled}><button bind:this={trigger} class="mc-ui-input__inner select-trigger" {disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onclick={()=>open?close():show()} onkeydown={e=>{if(e.key==='ArrowDown'){e.preventDefault();show();}}}>{options.find(o=>o.value===value)?.label??placeholder}<span class="arrow"><Icon name="down"/></span></button></div></div><div bind:this={popup} popover="auto" class="mc-ui-select-dropdown" role="listbox" tabindex="-1" aria-label={label} style:left="{left}px" style:top="{top}px" style:min-width="{width}px" ontoggle={e=>{open=e.newState==='open';}} onkeydown={keys}>{#each options as option(option.value)}<button class="mc-ui-option mc-ui-select-dropdown__item" class:selected={option.value===value} role="option" aria-selected={value===option.value} class:is-disabled={option.disabled} disabled={option.disabled} onclick={()=>{onchange?.(option.value);close();}}>{option.label}</button>{/each}</div></Theme>
<style>/* Keep the trigger layout above the shared input theme selector. */
.mc-ui-select .mc-ui-input .select-trigger{text-align:left;display:flex;align-items:center;justify-content:space-between;width:100%}.arrow{display:inline-flex;flex-shrink:0}.mc-ui-select-dropdown{position:fixed;inset:auto;border:0;margin:0;padding:8px 0;max-height:min(280px,60vh);overflow:auto;max-width:calc(100vw - 16px)}.mc-ui-select-dropdown__item{display:block;border:0;background:transparent;width:100%;text-align:left;font:inherit;padding:0 16px;height:32px;line-height:21px;display:flex;align-items:center}button:focus-visible{background:var(--tv-Option-bg-color-hover,#f5f5f5);outline:2px solid var(--tv-Option-text-color-selected,#1476ff);outline-offset:-2px}</style>
