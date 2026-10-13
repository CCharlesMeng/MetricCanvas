<script lang="ts">
 import type { Snippet } from 'svelte';
 import Theme from '../../shared/Theme.svelte';
 let { children, variant='default', disabled=false, loading=false, type='button', onclick, title, ariaLabel }: {children?:Snippet;variant?:'default'|'primary'|'danger';disabled?:boolean;loading?:boolean;type?:'button'|'submit'|'reset';onclick?:(event:MouseEvent)=>void;title?:string;ariaLabel?:string}=$props();
</script>
<Theme><button class="mc-ui-button" class:mc-ui-button--default={variant==='default'} class:mc-ui-button--primary={variant==='primary'} class:mc-ui-button--danger={variant==='danger'} class:is-disabled={disabled||loading} {type} disabled={disabled||loading} {title} aria-label={ariaLabel} aria-busy={loading} {onclick}>{#if loading}<span aria-hidden="true">…</span>{/if}{#if children}<span>{@render children()}</span>{/if}</button></Theme>
