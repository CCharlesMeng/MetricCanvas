<script lang="ts">
  import type {Snippet} from 'svelte';
  import {Tag} from '@metriccanvas/ui';
  import ToolAction from './ToolAction.svelte';
  let {title,source,revision,status,backLabel,onback,children}: {
    title:string;source:string;revision?:number;status?:'草稿'|'已发布'|'状态待核实';backLabel:string;onback:()=>void;children?:Snippet;
  }=$props();
</script>

<header class="reading-header" data-testid="reading-header">
  <ToolAction icon="back" ariaLabel={backLabel} onclick={onback}>{backLabel}</ToolAction>
  <div class="identity"><h1>{title}</h1><Tag type={status==='已发布'?'success':'info'}>{source}{status?` · ${status}`:''}{revision ? ` · R${revision}` : ''}</Tag></div>
  <div class="actions">{#if children}{@render children()}{/if}</div>
</header>

<style>
  .reading-header{display:flex;align-items:center;gap:24px;padding:16px 24px;min-width:0;background:#fff;border-bottom:1px solid #f0f0f0;color:#191919;font-size:14px;line-height:1.5}
  .identity{flex:1;min-width:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap}h1{font-size:20px;font-weight:600;line-height:28px;margin:0;overflow-wrap:anywhere}
  .actions{display:flex;align-items:center;gap:12px;flex:none}.actions :global(.mc-ui-select){width:160px}
  @media(max-width:700px){.reading-header{padding:16px;gap:12px;flex-wrap:wrap}.identity{order:3;flex-basis:100%}.actions{margin-left:auto}.actions :global(.mc-ui-select){width:144px}}
</style>
