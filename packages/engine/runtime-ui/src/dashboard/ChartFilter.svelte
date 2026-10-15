<script lang="ts">
  import type { ChartComponent } from '@metriccanvas/page/internal';

  let { control, value, label, exportMode = false, onchange }: {
    control: NonNullable<ChartComponent['props']['filter']>;
    value?: string;
    label: string;
    exportMode?: boolean;
    onchange: (value: string) => void;
  } = $props();
</script>

<div class="chart-filter" data-chart-filter={control.filterId} role={exportMode ? undefined : 'group'} aria-label={exportMode ? undefined : label}>
  {#if exportMode}
    <span data-chart-filter-selection>{control.options.find(option => option.value === value)?.label}</span>
  {:else}
    {#each control.options as option (option.value)}
      <button type="button" data-value={option.value} aria-pressed={value === option.value}
        onclick={() => { if (value !== option.value) onchange(option.value); }}>
        {option.label}
      </button>
    {/each}
  {/if}
</div>

<style>
  .chart-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: none;
    min-width: 0;
    max-width: 100%;
    margin-bottom: 8px;
    align-self: flex-start;
    color: var(--mc-color-text, #191919);
    font-size: 14px;
    line-height: 20px;
  }
  button {
    max-width: 100%;
    min-height: 28px;
    padding: 3px 24px;
    margin: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #595959;
    background: #f5f5f5;
    font: inherit;
    line-height: 20px;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  button:hover { background: #e9e9e9; }
  button[aria-pressed='true'] { color: #fff; background: #191919; }
  button[aria-pressed='true']:hover { background: #333; }
  button:focus-visible { outline: 2px solid #191919; outline-offset: 2px; }
  span { overflow-wrap: anywhere; }
</style>
