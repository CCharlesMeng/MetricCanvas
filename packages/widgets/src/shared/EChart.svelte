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
    /** replace 用于完整图表快照；merge 用于需要保留前后状态的数值过渡。 */
    updateMode?: 'replace' | 'merge';
    /**
     * 绘图容器,供图表组件读取形态色板一类经继承可见的自定义属性。
     * 容器归本宿主所有,所以它也是这些属性的合法读取锚点;图表组件因此
     * 不必为了拿一个读样式的入口而自己加壳。
     */
    container?: HTMLDivElement;
    /**
     * 数据项点击,上抛数据行下标与数据项名(组件据此映射回 Row)。
     * 地图点击可能来自 geo 组件(无 dataIndex),此时靠 name 定位区域
     */
    onitemclick?: (dataIndex: number, name?: string) => void;
  }

  let {
    option,
    updateMode = 'replace',
    container = $bindable(),
    onitemclick
  }: Props = $props();

  let chart = $state<echarts.ECharts>();

  /* 容器在 DOM 生成时就绑定,早于 onMount 与任何 effect:调用方的色板
     因此在**第一次** setOption 之前就已可读,图表不会先按内置色画一遍再重画。 */
  onMount(() => {
    const el = container!;
    const instance = echarts.init(el);
    chart = instance;
    if (onitemclick) {
      instance.on('click', (params) =>
        onitemclick(params.dataIndex, typeof params.name === 'string' ? params.name : undefined)
      );
    }
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.dispose();
    };
  });

  $effect(() => {
    chart?.setOption(option, { notMerge: updateMode === 'replace' });
  });
</script>

<div bind:this={container} class="echart"></div>

<style>
  .echart {
    flex: 1;
    min-height: 0;
    width: 100%;
  }
</style>
