<svelte:options css="injected" />
<script lang="ts">
  import type {Snippet} from 'svelte';
  let {title,subtitle,showTools=false,tools}:{title?:string;subtitle?:string;showTools?:boolean;tools?:Snippet}=$props();
</script>
{#if title || subtitle || showTools}
  <div class="table-heading">
    {#if title || subtitle}
      <div class="heading-copy">
        {#if title}<h3 class="mc-data-heading">{title}</h3>{/if}
        {#if subtitle}<div class="subtitle">{subtitle}</div>{/if}
      </div>
    {/if}
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
  .heading-copy {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 4px 16px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #121e3b);
    font-family: 'PingFang SC', sans-serif;
    font-style: normal;
    font-size: var(--mc-card-title-font-size, 20px);
    font-weight: var(--mc-card-title-font-weight, 600);
    line-height: var(--mc-card-title-line-height, 30px);
    letter-spacing: 0;
    text-align: left;
  }
  .subtitle {
    color: #595959;
    font-size: 12px;
    font-weight: 400;
    line-height: 22px;
  }
</style>
