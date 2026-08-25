<script lang="ts">
  import type { MapChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { resolveField } from '../../shared/component-data';
  import EChart from '../../shared/EChart.svelte';
  import { geoRegionName, mapOption, type MapSafeArea } from './options';
  import { ensureBasemap, type BasemapMeta, type BasemapName } from './basemap';

  /**
   * 地图(纯渲染,ECharts map):区域着色 + 散点叠加,点击区域只上抛行上下文。
   * 底图 geojson 是随包入库的静态展示资产(按需懒加载),不是数据请求,
   * 不违纯渲染原则——数据仍只来自快照。
   */
  interface Props {
    /** 已解析的 main 数据槽(加载/错误/空态由统一运行时呈现) */
    data: MainDataSlots;
    props: MapChartProps;
    /** 层级下钻后的底图,缺省用 props.map */
    map?: 'china' | 'world';
    /** 区域/散点点击,携带该区域对应的数据行 */
    onregionclick?: (context: { row: Row }) => void;
  }

  let { data, props, map, onregionclick }: Props = $props();
  const basemapId = $derived(map ?? props.map);

  /**
   * 底图是懒加载的:`ensureBasemap` 之后才 `registerMap`。所以交给 option 的
   * 底图名必须是**已注册的那个**,不能是刚切过去、还没加载完的那个——层级下钻
   * 时后者会让 ECharts 抛 `Map china not exists`,图表当场报废且不会自己恢复
   * (`{#if basemap}` 只挡得住首次挂载,切换时 basemap 还持有上一张的值)。
   * 因此把「已解析的底图 id」和它的 meta 一起存,option 只用已解析的那个:
   * 切换过程中继续画旧底图,新底图就绪后一次换过去。
   */
  let basemap = $state<{ id: BasemapName; meta: BasemapMeta }>();
  const chartProps = $derived({ ...props, map: basemap?.id ?? props.map });

  $effect(() => {
    let alive = true;
    const requested = basemapId;
    void ensureBasemap(requested).then((meta) => {
      if (alive) basemap = { id: requested, meta };
    });
    return () => {
      alive = false;
    };
  });

  /**
   * 区域名 → 数据行。**同时收录映射后的底图区域名与原始维度值**:区域着色系列
   * 上抛的 name 是底图区域名,而散点系列上抛的是原始维度值(见 options.ts 的
   * 「双名」注释)。只收一种的话,另一种点击会静默找不到行。
   */
  const rowByRegionName = $derived.by(() => {
    const nameField = resolveField(props.nameField, data).field;
    const index = new Map<string, Row>();
    for (const row of data.main.snapshot.rows) {
      index.set(geoRegionName(row, nameField, props.nameMap), row);
      index.set(String(row[nameField] ?? ''), row);
    }
    return index;
  });

  function handleClick(_dataIndex: number, name?: string) {
    const row = name ? rowByRegionName.get(name) : undefined;
    if (row) onregionclick?.({ row });
  }

  /**
   * 安全区:从自身容器的 computed style 读 IFC 约定的四个自定义属性
   * (`--mc-backdrop-safe-x/-y/-w/-h`,由 `RuntimeSection` 写在 backdrop 单元格上,
   * 经继承对本容器可见)。**四者同时缺席**表示没有安全区约束,退回全容器渲染。
   *
   * 自定义属性变化不触发任何观察器,所以重读时机挂在会伴随它变化的信号上:
   * 挂载后的下一帧(此时生产方的同步量测已写入)、容器尺寸变化、窗口尺寸变化。
   */
  let host = $state<HTMLElement | null>(null);
  let safeArea = $state<MapSafeArea | undefined>();

  function readSafeArea(element: HTMLElement): MapSafeArea | undefined {
    const style = getComputedStyle(element);
    const px = (property: string): number | undefined => {
      const raw = style.getPropertyValue(property).trim();
      if (!raw) return undefined;
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const x = px('--mc-backdrop-safe-x');
    const y = px('--mc-backdrop-safe-y');
    const width = px('--mc-backdrop-safe-w');
    const height = px('--mc-backdrop-safe-h');
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      return undefined;
    }
    return { x, y, width, height };
  }

  $effect(() => {
    const element = host;
    if (!element) return;

    let active = true;
    let frame: number | undefined;
    const schedule = () => {
      if (!active) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const next = readSafeArea(element);
        const changed =
          next?.x !== safeArea?.x ||
          next?.y !== safeArea?.y ||
          next?.width !== safeArea?.width ||
          next?.height !== safeArea?.height;
        if (changed) safeArea = next;
      });
    };

    schedule();
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(element);
    const onResize = () => schedule();
    window.addEventListener('resize', onResize);

    return () => {
      active = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<!-- `display: contents` 的读样式锚点:自定义属性靠继承可读,而它不生成盒,
     所以既拿到了 `getComputedStyle` 的入口,又不改变单元格内的布局。 -->
<div class="safe-area-probe" bind:this={host}>
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#if basemap}
    <EChart
      option={mapOption(data, chartProps, basemap.meta.centers, safeArea)}
      onitemclick={onregionclick ? handleClick : undefined}
    />
  {:else}
    <div class="loading">底图加载中…</div>
  {/if}
</div>

<style>
  .safe-area-probe {
    display: contents;
  }
  h3 {
    margin: 0;
    color: #18181b;
    font-size: 13px;
    font-weight: 500;
  }
  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    color: #a1a1aa;
    font-size: 13px;
  }
</style>
