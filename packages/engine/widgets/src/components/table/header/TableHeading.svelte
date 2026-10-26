<svelte:options css="injected" />
<script lang="ts">
  import type {Snippet} from 'svelte';
  let {title,subtitle,showTools=false,tools}:{title?:string;subtitle?:string;showTools?:boolean;tools?:Snippet}=$props();
</script>
{#if title || subtitle || showTools}
  <div class="table-heading">
    {#if title}<h3>{title}</h3>{/if}
    {#if subtitle}<div class="subtitle"><span aria-hidden="true">*</span>{subtitle}</div>{/if}
    {#if showTools && tools}{@render tools()}{/if}
  </div>
{/if}
<style>
  .table-heading {
    display: flex;
    flex-wrap: wrap;
    min-height: 30px;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #121e3b);
    font-size: var(--mc-card-title-font-size, 20px);
    font-weight: var(--mc-card-title-font-weight, 600);
    line-height: var(--mc-card-title-line-height, 30px);
  }
  .subtitle {
    color: #595959;
    font-size: 12px;
    font-weight: 400;
    line-height: 22px;
    white-space: nowrap;
  }
  .subtitle span {
    margin-right: 4px;
    color: #f21e1e;
  }
</style>
