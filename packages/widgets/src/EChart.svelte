<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';

  /**
   * ECharts 宿主(包内私有):初始化/尺寸自适应/销毁与点击上抛。
   * 图表组件只负责把数据快照翻译成 option(纯渲染),不直接接触 echarts 实例。
   */
  interface Props {
    option: EChartsOption;
    /** 数据项点击,上抛数据行下标(组件据此映射回 Row) */
    onitemclick?: (dataIndex: number) => void;
  }

  let { option, onitemclick }: Props = $props();

  let el: HTMLDivElement;
  let chart = $state<echarts.ECharts>();

  onMount(() => {
    const instance = echarts.init(el);
    chart = instance;
    if (onitemclick) {
      instance.on('click', (params) => onitemclick(params.dataIndex));
    }
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.dispose();
    };
  });

  $effect(() => {
    chart?.setOption(option, { notMerge: true });
  });
</script>

<div bind:this={el} class="echart"></div>

<style>
  .echart {
    flex: 1;
    min-height: 0;
    width: 100%;
  }
</style>
