<script lang="ts">
  import type {Snippet} from 'svelte';
  import {Button} from '@metriccanvas/ui';
  let {children,disabled=false,variant='primary',onclick}:{children:Snippet;disabled?:boolean;variant?:'primary'|'danger';onclick?:(event:MouseEvent)=>void}=$props();
</script>
<span class="primary-action"><Button {variant} {disabled} {onclick}>{@render children()}</Button></span>
<style>
  .primary-action{display:inline-flex}
  .primary-action :global(button.mc-ui-button.mc-ui-button--primary),.primary-action :global(button.mc-ui-button.mc-ui-button--danger){height:32px;min-height:32px;min-width:96px;padding:0 16px;border-radius:6px;font-size:14px;line-height:20px;box-sizing:border-box}
  .primary-action :global(button:focus-visible){outline:2px solid #1476ff;outline-offset:2px}
</style>
