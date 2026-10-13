<script lang="ts">
 import {popoverPosition,observePopover,movePopoverFocus} from '../../shared/popover';
 import Theme from '../../shared/Theme.svelte';import Button from '../button/Button.svelte';import type {UiOption} from '../../types';
 let {label='更多',options,onselect,disabled=false}:{label?:string;options:UiOption[];onselect?:(value:string)=>void;disabled?:boolean}=$props();let anchor:HTMLDivElement;let popup:HTMLDivElement;let open=$state(false);let x=$state(0);let y=$state(0);
 function place(){const rect=popoverPosition(anchor,popup);x=rect.left;y=rect.top;if(!rect.visible)close();}
 function show(){if(disabled)return;popup.showPopover();open=true;place();popup.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();}
 function close(){popup.hidePopover();open=false;anchor.querySelector('button')?.focus();}
 function keys(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();close();}else movePopoverFocus(e,popup);}
 $effect(()=>{if(open)return observePopover(anchor,place);});
 $effect(()=>{if(disabled&&open)close();});
</script>
<Theme><div bind:this={anchor} class="mc-ui-dropdown"><Button {disabled} onclick={show} ariaLabel={label}>{label}</Button></div><div bind:this={popup} class="mc-ui-dropdown-menu" popover="auto" ontoggle={event=>open=event.newState==='open'} role="menu" tabindex="-1" aria-label={label} style:left="{x}px" style:top="{y}px" onkeydown={keys}>{#each options as option(option.value)}<button class="mc-ui-dropdown-item" role="menuitem" class:is-disabled={option.disabled} disabled={option.disabled} onclick={()=>{onselect?.(option.value);close();}}>{option.label}</button>{/each}</div></Theme>
<style>.mc-ui-dropdown-menu{position:fixed;inset:auto;border:0;margin:0;padding:4px 0;max-width:calc(100vw - 16px);max-height:60vh;overflow:auto}button{display:block;width:100%;text-align:left;border:0;background:transparent;font:inherit;padding:0 16px}button:hover,button:focus-visible{background:#f5f5f5}</style>
