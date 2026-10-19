<svelte:options css="injected" />
<script lang="ts">
  import { getContext, onMount, untrack } from 'svelte';
  import { EXPORT_SCALE_CONTEXT, STATIC_EXPORT_CONTEXT } from './export-context';
  import * as echarts from 'echarts';
  import type { EChartsOption, XAXisComponentOption } from 'echarts';
  import { cartesianFrame } from './chart-presentation';
  import { copyChartOption, logChartFailure, type ChartSource, type ChartStage } from './chart-option-extension';

  /**
   * ECharts 宿主(包内私有):初始化/尺寸自适应/销毁与点击上抛。
   * 图表组件只负责把数据快照翻译成 option(纯渲染),不直接接触 echarts 实例。
   */
  interface Props {
    option?: EChartsOption;
    source?: ChartSource;
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
    source,
    cartesian = false,
    expandForLabels = false,
    updateMode = 'replace',
    container = $bindable(),
    onitemclick
  }: Props = $props();

  const staticExport = getContext<boolean>(STATIC_EXPORT_CONTEXT) ?? false;
  const exportScale = getContext<number>(EXPORT_SCALE_CONTEXT) ?? 2;
  let mounted = $state(false);
  let minHeight = $state<number>();
  let instance: echarts.ECharts | undefined;
  let stopped = false;
  let current: ChartSource | undefined;
  let mode: 'extended' | 'base' | 'failed' = 'base';
  let stage: ChartStage = 'layout';

  function dispose() {
    if (instance && !instance.isDisposed()) instance.dispose();
    instance = undefined;
  }
  function markFailure() {
    if (!staticExport || !container) return;
    container.dataset.exportChartErrorCode = 'CHART_RENDER_FAILED';
    container.dataset.exportChartError = `图表 ${current?.diagnostic?.componentId ?? ''} 自定义呈现未能完整导出`;
    container.dataset.exportChartReady = 'false';
  }
  function apply(value: EChartsOption) {
    const el = container!;
    stage = 'layout';
    const frame = cartesian ? cartesianFrame(copyChartOption(value), el.clientWidth, expandForLabels, el.clientHeight) : { option: copyChartOption(value), minHeight: undefined };
    minHeight = frame.minHeight;
    let final = frame.option;
    if (staticExport) {
      const series = final.series === undefined ? undefined : (Array.isArray(final.series) ? final.series : [final.series]).map(item => ({ ...item, animation: false }));
      const fit = (axis: XAXisComponentOption): XAXisComponentOption => axis.type === 'category'
        ? { ...axis, axisLabel: { ...axis.axisLabel, hideOverlap: axis.axisLabel?.hideOverlap ?? true, showMinLabel: true, showMaxLabel: true, alignMinLabel: 'left', alignMaxLabel: 'right' } } : axis;
      const xAxis = final.xAxis === undefined ? undefined : Array.isArray(final.xAxis) ? final.xAxis.map(fit) : fit(final.xAxis);
      final = { ...final, dataZoom: [], animation: false, ...(series ? { series } : {}), ...(xAxis ? { xAxis } : {}) };
    }
    stage = 'init';
    if (!instance) {
      instance = echarts.init(el, undefined, staticExport ? { devicePixelRatio: exportScale } : undefined);
      instance.on('click', params => onitemclick?.(params.dataIndex, typeof params.name === 'string' ? params.name : undefined));
    }
    stage = 'apply';
    instance.setOption(final, { notMerge: staticExport || updateMode === 'replace' });
    if (staticExport && !el.dataset.exportChartError) el.dataset.exportChartReady = 'true';
  }
  function paint() {
    if (stopped || !container || container.clientWidth <= 0 || container.clientHeight <= 0 || !current || mode === 'failed') return;
    if (staticExport && (Math.ceil(container.clientWidth * exportScale) > 8192 || Math.ceil(container.clientHeight * exportScale) > 8192 || container.clientWidth * container.clientHeight * exportScale ** 2 > 16_777_216)) {
      container.dataset.exportChartError = '图表尺寸超出图片导出支持范围';
      return;
    }
    try {
      if (current.failure && mode === 'extended') {
        stage = current.failure.stage;
        throw current.failure.cause;
      }
      const selected = mode === 'extended' ? current.extended : current.base;
      if (!selected) {
        stage = current.failure?.stage ?? 'build';
        throw current.failure?.cause ?? Error('缺少基础图表配置');
      }
      apply(selected);
    } catch (cause) {
      dispose();
      if (mode === 'extended' && current.base) {
        mode = 'base';
        markFailure();
        container.dataset.chartRenderMode = 'degraded';
        logChartFailure(current, stage, cause, true, current.failure?.path);
        try { apply(current.base); return; } catch (baseCause) { cause = baseCause; dispose(); }
      }
      mode = 'failed';
      container.dataset.chartRenderMode = 'failed';
      markFailure();
      logChartFailure(current, stage, cause, false, current.failure?.path);
    }
  }
  onMount(() => {
    stopped = false;
    mounted = true;
    const el = container!;
    let resizeFrame: number | undefined;
    const observer = new ResizeObserver(() => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        if (stopped || mode === 'failed') return;
        // Repaint the selected mode: resizing never re-enables a failed extension.
        try { instance?.resize(); } catch (cause) {
          dispose();
          if (current) logChartFailure(current, 'resize', cause, mode === 'extended');
          if (mode === 'extended') { mode = 'base'; el.dataset.chartRenderMode = 'degraded'; markFailure(); }
          else { mode = 'failed'; el.dataset.chartRenderMode = 'failed'; markFailure(); }
        }
        paint();
      });
    });
    observer.observe(el);
    const freeze = () => {
      stopped = true;
      observer.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      dispose();
    };
    if (staticExport) el.addEventListener('metriccanvas:freeze-export-chart', freeze, { once: true });
    return () => {
      freeze();
      el.removeEventListener('metriccanvas:freeze-export-chart', freeze);
    };
  });
  $effect(() => {
    const input = source ?? { base: option };
    if (!mounted) return;
    untrack(() => {
      current = input;
      mode = input.extended || input.failure && input.base ? 'extended' : 'base';
      if (container) {
        container.dataset.chartRenderMode = mode === 'extended' ? 'extended' : 'base';
        delete container.dataset.exportChartError;
        delete container.dataset.exportChartErrorCode;
        if (staticExport) container.dataset.exportChartReady = 'false';
      }
      paint();
    });
  });

</script>

<div bind:this={container} class="echart" style:min-height={minHeight ? `${minHeight}px` : undefined} data-export-chart={staticExport ? "" : undefined}></div>

<style>
  .echart {
    flex: 1;
    min-width: 0;
    min-height: 0;
    width: 100%;
  }
</style>
