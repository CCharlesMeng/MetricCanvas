<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { attachHeaderFrame,watchHeaderVisibility } from './sticky-frame';
  let {sticky=false,children}:{sticky?:boolean;children:Snippet}=$props();
  let anchor:HTMLDivElement,content:HTMLDivElement;
  let visible=$state(true);
  $effect(()=>{if(anchor)return watchHeaderVisibility(anchor,value=>{visible=value;});});
  $effect(()=>{
    if(!sticky||!anchor||!content)return;
    return attachHeaderFrame(anchor,content);
  });
</script>
<div data-ioc-header-anchor bind:this={anchor}><div data-ioc-header-frame bind:this={content}>{#if visible}{@render children()}{/if}</div></div>
<style>
  [data-ioc-header-anchor],[data-ioc-header-frame]{display:flow-root;min-width:0;}
</style>
