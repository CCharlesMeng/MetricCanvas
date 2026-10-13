<script lang="ts">
  import type {Snippet} from 'svelte';
  let {children, icon, iconOnly=false, disabled=false, title, ariaLabel, expanded, controls, testId, danger=false, element=$bindable(null), onclick}: {
    children?:Snippet; icon?:'back'|'refresh'|'undo'|'eye'|'settings'|'code'|'minus'|'plus'; iconOnly?:boolean;
    disabled?:boolean; title?:string; ariaLabel?:string; expanded?:boolean; controls?:string;
    testId?:string; danger?:boolean; element?:HTMLButtonElement|null; onclick?:(event:MouseEvent)=>void;
  }=$props();
  const paths={back:'M12 4 4 12l8 8M4 12h16',refresh:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3',undo:'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12',eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',code:'M8 6 2 12l6 6M16 6l6 6-6 6M14 4l-4 16',minus:'M5 12h14',plus:'M12 5v14M5 12h14'};
</script>
<button bind:this={element} type="button" class="tool-action" class:icon-only={iconOnly} class:danger {disabled} title={title??ariaLabel} aria-label={ariaLabel} aria-expanded={expanded} aria-controls={controls} data-testid={testId} {onclick}>
  {#if icon}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d={paths[icon]}/></svg>{/if}
  {#if children&&!iconOnly}<span>{@render children()}</span>{/if}
</button>
<style>
  .tool-action{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:3px 6px;border:0;border-radius:4px;background:transparent;color:#595959;font:inherit;font-size:14px;line-height:20px;white-space:nowrap;cursor:pointer;text-decoration:none}
  .tool-action.icon-only{width:28px;padding:6px}.tool-action svg{width:16px;height:16px;flex:none}
  .tool-action:hover:not(:disabled){background:#f0f0f0;color:#191919}.tool-action.danger{color:#f23030}
  .tool-action:focus-visible{outline:2px solid #1476ff;outline-offset:2px}.tool-action:disabled{color:#c2c2c2;cursor:not-allowed}
</style>
