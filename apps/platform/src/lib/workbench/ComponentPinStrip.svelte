<script lang="ts">
  import type { PinnedComponentChoice } from './agent-request';
  import type { PageComponentView } from './transient-page';

  /**
   * 组件形态钉住条(ADR-0037):钉住是创作期状态,按取数单元(页面数据源)
   * 记录当前组件形态,随下一轮请求传回,后续轮次不被自动改写;不进入
   * 页面文档。只列出消费页面数据源的组件——不绑定数据的组件(页头、
   * 文本)没有可钉住的形态。
   */
  let {
    components,
    pins,
    disabled = false,
    onpin,
    onunpin
  }: {
    components: PageComponentView[];
    pins: readonly PinnedComponentChoice[];
    disabled?: boolean;
    onpin: (choice: PinnedComponentChoice) => void;
    onunpin: (dataSourceId: string) => void;
  } = $props();

  const pinnable = $derived(
    components.filter(
      (component): component is PageComponentView & { dataSourceId: string } =>
        component.dataSourceId !== null
    )
  );

  function pinnedType(dataSourceId: string): string | null {
    return pins.find((pin) => pin.dataSourceId === dataSourceId)?.componentType ?? null;
  }
</script>

{#if pinnable.length > 0}
  <div class="pin-strip">
    <span class="strip-label">组件形态</span>
    {#each pinnable as component (component.componentId)}
      {@const pinned = pinnedType(component.dataSourceId)}
      <span class="pin-chip" class:pinned={pinned !== null}>
        <span class="chip-main">
          <b>{component.title ?? component.componentId}</b>
          <small>
            {component.componentLabel} · {component.dataSourceId}
            {#if pinned !== null && pinned !== component.componentType}
              · 钉住 {pinned}
            {/if}
          </small>
        </span>
        {#if pinned !== null}
          <button
            type="button"
            {disabled}
            title="取消钉住,下一轮允许自动改写"
            onclick={() => onunpin(component.dataSourceId)}
          >
            已钉住 ✕
          </button>
        {:else}
          <button
            type="button"
            {disabled}
            title="钉住当前组件形态,后续轮次不被自动改写"
            onclick={() =>
              onpin({
                dataSourceId: component.dataSourceId,
                componentType: component.componentType
              })}
          >
            钉住
          </button>
        {/if}
      </span>
    {/each}
    <span class="strip-note">钉住的形态随下一轮请求传回,后续轮次不被自动改写。</span>
  </div>
{/if}

<style>
  .pin-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    background: #fff;
    border-bottom: 1px solid #e4e4e7;
  }
  .strip-label {
    color: #52525b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .pin-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px 4px 10px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 999px;
  }
  .pin-chip.pinned {
    background: #fafaff;
    border-color: #4f46e5;
  }
  .chip-main {
    display: grid;
    gap: 0;
  }
  .chip-main b {
    font-size: 11.5px;
    line-height: 1.3;
  }
  .chip-main small {
    color: #71717a;
    font-size: 10px;
    line-height: 1.3;
  }
  .pin-chip button {
    padding: 3px 9px;
    background: #fff;
    border: 1px solid #d4d4d8;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .pin-chip.pinned button {
    color: #3730a3;
    background: #eef2ff;
    border-color: #c7d2fe;
  }
  .pin-chip button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .strip-note {
    color: #a1a1aa;
    font-size: 10.5px;
  }
</style>
