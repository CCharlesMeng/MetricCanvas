<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { STATIC_EXPORT_CONTEXT } from './export-context';
  import * as echarts from 'echarts';
  import type { EChartsOption, XAXisComponentOption } from 'echarts';
  import { cartesianFrame } from './chart-presentation';

  /**
   * ECharts 宿主(包内私有):初始化/尺寸自适应/销毁与点击上抛。
   * 图表组件只负责把数据快照翻译成 option(纯渲染),不直接接触 echarts 实例。
   */
  interface Props {
    option: EChartsOption;
    cartesian?: boolean;
    expandForLabels?: boolean;
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
    cartesian = false,
    expandForLabels = false,
    updateMode = 'replace',
    container = $bindable(),
    onitemclick
  }: Props = $props();

  const staticExport = getContext<boolean>(STATIC_EXPORT_CONTEXT) ?? false;
  let chart = $state<echarts.ECharts>();
  let width = $state(0);
  const frame = $derived(cartesian ? cartesianFrame(option, width, expandForLabels) : { option, minHeight: undefined });

  /* 容器在 DOM 生成时就绑定,早于 onMount 与任何 effect:调用方的色板
     因此在**第一次** setOption 之前就已可读,图表不会先按内置色画一遍再重画。 */
  onMount(() => {
    const el = container!;
    let instance: echarts.ECharts | undefined;
    let stopped = false;
    const measure = () => {
      if (stopped || el.clientWidth <= 0 || el.clientHeight <= 0) return;
      width = el.clientWidth;
      if (!instance) {
        instance = echarts.init(el);
        chart = instance;
        if (onitemclick) instance.on('click', (params) =>
          onitemclick(params.dataIndex, typeof params.name === 'string' ? params.name : undefined)
        );
      } else if (!instance.isDisposed()) instance.resize();
    };
    // ResizeObserver also delivers the first laid-out size. Older Svelte consumers
    // can mount before parent styles establish a height; zero-sized geo transforms
    // are singular and cannot safely be passed to ECharts.
    measure();
    let resizeFrame: number | undefined;
    const observer = new ResizeObserver(() => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        measure();
      });
    });
    observer.observe(el);
    const freeze = () => {
      stopped = true;
      observer.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      if (instance && !instance.isDisposed()) instance.dispose();
    };
    if (staticExport) el.addEventListener('metriccanvas:freeze-export-chart', freeze, {once:true});
    return () => {
      stopped = true;
      observer.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      el.removeEventListener('metriccanvas:freeze-export-chart', freeze);
      if (instance && !instance.isDisposed()) instance.dispose();
    };
  });

  $effect(() => {
    if (!chart || chart.isDisposed()) return;
    if (staticExport) {
      container!.dataset.exportChartReady = 'false';
      const series = frame.option.series === undefined ? undefined : (Array.isArray(frame.option.series) ? frame.option.series : [frame.option.series]).map(series => ({...series,animation:false}));
      const fitCategoryEnds = (axis: XAXisComponentOption): XAXisComponentOption => axis.type === 'category'
        ? {...axis,axisLabel:{...axis.axisLabel,hideOverlap:axis.axisLabel?.hideOverlap??true,showMinLabel:true,showMaxLabel:true,alignMinLabel:'left',alignMaxLabel:'right'}} : axis;
      const xAxis = frame.option.xAxis === undefined ? undefined : Array.isArray(frame.option.xAxis)
        ? frame.option.xAxis.map(fitCategoryEnds) : fitCategoryEnds(frame.option.xAxis);
      // A frozen chart has no zoom controls; include the whole result range.
      chart.setOption({...frame.option,dataZoom:[],animation:false,...(xAxis?{xAxis}:{}),...(series?{series}:{})},{notMerge:true});
      container!.dataset.exportChartReady = 'true';
    } else chart.setOption(frame.option, { notMerge: updateMode === 'replace' });
  });
</script>

<div bind:this={container} class="echart" style:min-height={frame.minHeight ? `${frame.minHeight}px` : undefined} data-export-chart={staticExport ? "" : undefined}></div>

<style>
  .echart {
    flex: 1;
    min-width: 0;
    min-height: 0;
    width: 100%;
  }
</style>
