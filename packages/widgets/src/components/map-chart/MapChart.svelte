<script lang="ts">
  import type { MapChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { resolveField } from '../../shared/component-data';
  import EChart from '../../shared/EChart.svelte';
  import { MAP_SCALE_PROPERTY, readColorList } from '../../shared/chart-palette';
  import {
    geoRegionName,
    mapOption,
    projectionRect,
    type MapSafeArea
  } from './options';
  import { mapLegendFrameStyle, mapLegendLevels } from './legend';
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
  const projection = $derived(projectionRect(safeArea));

  /* 形态分档色与安全区共用这一个读样式锚点(见 shared/chart-palette.ts):
     两者都是经继承可见的自定义属性,只是分档色不随几何变化,读一次即定。 */
  const mapScale = $derived(readColorList(host, MAP_SCALE_PROPERTY));

  /* 图例只在拿到分档色板时画:档位色取自分档色板,报表形态不定义它,
     那里的地图仍是连续渐变加图表库自带的视觉映射条(见 options.ts)。 */
  const legendLevels = $derived(
    props.legend && mapScale ? mapLegendLevels(props.legend.bands, mapScale) : undefined
  );

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
    /* RuntimeSection 把安全区写在 backdrop 单元格的 style 上。窗口 resize 时生产方
       和消费方的回调没有先后保证：只听 window 可能先读到上一视口的四个值，且
       display:contents 的 probe 本身不一定产生 ResizeObserver 事件。直接观察 IFC
       生产节点的 style 变化，让 projection 与安全区落在同一轮更新。 */
    const safeAreaSource = element.closest<HTMLElement>('[data-component]');
    const mutationObserver = safeAreaSource
      ? new MutationObserver(schedule)
      : undefined;
    mutationObserver?.observe(safeAreaSource!, {
      attributes: true,
      attributeFilter: ['style']
    });
    const onResize = () => schedule();
    window.addEventListener('resize', onResize);

    return () => {
      active = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<!-- `display: contents` 的读样式锚点:自定义属性靠继承可读,而它不生成盒,
     所以既拿到了 `getComputedStyle` 的入口,又不改变单元格内的布局。 -->
<div class="safe-area-probe" bind:this={host}>
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#if basemap}
    <!-- 图例贴在绘图区左下角(图表库自带那块视觉映射条原来的位置),所以
         这里要有一个定位参照物;它接手 EChart 原来占的那一格弹性空间,
         `.echart` 仍是 `flex: 1`,几何与加壳之前一致。 -->
    <div
      class="map-frame"
      data-projection-square={projection ? String(projection.width === projection.height) : undefined}
    >
      <EChart
        option={mapOption(
          data,
          chartProps,
          basemap.meta.centers,
          projection,
          false,
          mapScale
        )}
        onitemclick={onregionclick ? handleClick : undefined}
      />
      {#if legendLevels}
        <div class="legend-frame" style={mapLegendFrameStyle(projection)}>
          <div class="map-legend">
            {#if props.legend?.title}
              <div class="legend-title">{props.legend.title}</div>
            {/if}
            <ul>
              {#each legendLevels as level, levelIndex (levelIndex)}
                <li>
                  <span
                    class="legend-dot"
                    style={level.color ? `background:${level.color};` : undefined}
                  ></span>
                  <span class="legend-label">{level.label}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}
    </div>
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
    color: var(--mc-card-title-color, #18181b);
    font-size: var(--mc-card-title-font-size, 13px);
    font-weight: var(--mc-card-title-font-weight, 500);
    /* 缺省 inherit 而不是 normal:原来这里没有声明,行高走的是继承值。 */
    line-height: var(--mc-card-title-line-height, inherit);
  }
  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    color: #a1a1aa;
    font-size: 13px;
  }
  .map-frame {
    position: relative;
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }
  .legend-frame {
    position: absolute;
    inset: 0;
    min-width: 0;
    min-height: 0;
    pointer-events: none;
  }
  .map-legend {
    position: absolute;
    bottom: 8px;
    left: 8px;
    display: flex;
    min-width: 80px;
    flex-direction: column;
    gap: 4px;
  }
  .legend-title {
    color: var(--mc-color-report-text, #191919);
    font-size: 14px;
    line-height: 22px;
  }
  .map-legend ul {
    display: flex;
    margin: 0;
    flex-direction: column;
    /* 色点 13px、标签行 18px,行距 3px 时两者的行距都是 21px。 */
    gap: 3px;
    padding: 0;
    list-style: none;
  }
  .map-legend li {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .legend-dot {
    display: block;
    width: 13px;
    height: 13px;
    flex: none;
    border-radius: 999px;
    box-shadow: 0 4px 4px 0 rgb(0 0 0 / 0.12);
  }
  .legend-label {
    color: var(--mc-color-report-text, #191919);
    font-size: 12px;
    line-height: 18px;
    opacity: 0.9;
    white-space: nowrap;
  }
  @media (max-width: 760px) {
    .legend-frame {
      position: static;
      inset: auto !important;
      width: auto !important;
      height: auto !important;
      margin-top: 8px;
    }
    .map-legend {
      position: static;
    }
  }
</style>
