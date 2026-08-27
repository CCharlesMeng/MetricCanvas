<script lang="ts">
  import type { GaugeProps } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { fieldValue, resolveField } from '../../shared/component-data';
  import { finiteNumber, formatValue } from '../../shared/value-format';
  import { gaugeArc, gaugeProgress } from './gauge';

  /**
   * 仪表(纯渲染):读第一行的一个度量,画环形进度。
   * 交互由统一运行时挂接,组件本身不上抛。
   */
  interface Props {
    data: MainDataSlots;
    props: GaugeProps;
    onclick?: () => void;
  }

  let { data, props, onclick }: Props = $props();

  const resolved = $derived(resolveField(props.valueField, data));
  const raw = $derived(fieldValue(props.valueField, data));
  const numeric = $derived(finiteNumber(raw));
  const min = $derived(props.min ?? 0);
  const max = $derived(props.max ?? 100);
  const progress = $derived(numeric === undefined ? 0 : gaugeProgress(numeric, min, max));
  const display = $derived(formatValue(raw, resolved.format));
  const track = gaugeArc(1, 36);
  const valueArc = $derived(gaugeArc(progress, 36));
</script>

<div class:mini={props.variant === 'mini'} class="gauge">
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#if onclick}
    <button type="button" class="dial" {onclick}>
      <svg viewBox="-48 -48 96 96" aria-hidden="true">
        <path class="track" d={track} />
        <path class="value" d={valueArc} />
      </svg>
      <div class="reading">
        <strong>{display}</strong>
        {#if props.unit}<span>{props.unit}</span>{/if}
      </div>
    </button>
  {:else}
    <div class="dial">
      <svg viewBox="-48 -48 96 96" aria-hidden="true">
        <path class="track" d={track} />
        <path class="value" d={valueArc} />
      </svg>
      <div class="reading">
        <strong>{display}</strong>
        {#if props.unit}<span>{props.unit}</span>{/if}
      </div>
    </div>
  {/if}
  {#if props.label}<p>{props.label}</p>{/if}
</div>

<style>
  /* 表面经 --mc-gauge-* 可被页面布局形态覆写:报表形态里仪表借用所在
     组件单元格的外观(缺省无表面),看板形态需要它自己就是一张白卡。 */
  .gauge {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: var(--mc-gauge-padding, 12px 10px);
    background: var(--mc-gauge-surface, transparent);
    border: var(--mc-gauge-border, 0);
    border-radius: var(--mc-gauge-radius, 0);
  }
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #121e3b);
    font-size: var(--mc-card-title-font-size, 13px);
    font-weight: var(--mc-card-title-font-weight, 600);
    /* 缺省 inherit 而不是 normal:原来这里没有声明,行高走的是继承值。 */
    line-height: var(--mc-card-title-line-height, inherit);
  }
  .dial {
    position: relative;
    display: grid;
    width: var(--mc-gauge-dial-size, 112px);
    height: var(--mc-gauge-dial-size, 112px);
    place-items: center;
    padding: 0;
    background: transparent;
    border: 0;
  }
  button.dial {
    cursor: pointer;
  }
  svg {
    width: var(--mc-gauge-dial-size, 112px);
    height: var(--mc-gauge-dial-size, 112px);
  }
  .track,
  .value {
    fill: none;
    stroke-linecap: round;
    stroke-width: 8;
  }
  .track {
    stroke: #e4e4e7;
  }
  .value {
    stroke: #2563eb;
  }
  .reading {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  strong {
    color: #18181b;
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  span,
  p {
    margin: 0;
    color: #71717a;
    font-size: 12px;
  }
  .mini {
    --mc-gauge-dial-size: 68px;

    justify-content: flex-start;
    gap: 4px;
  }
  .mini strong {
    font-size: 16px;
  }
</style>
