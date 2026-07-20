<script lang="ts" module>
  import type { MapChartDisplay } from '@metriccanvas/page';

  /** 地图配置 = 运行时从结构化查询派生的取值/定位字段 + 页面文档 display(底图必选) */
  export interface MapChartConfig {
    /** 数据快照中承载指标值的字段(visualMap 着色依据) */
    metric: string;
    /** 数据快照中承载维度值的字段,值定位底图区域(可经 display.nameMap 改名) */
    dimension: string;
    display: MapChartDisplay;
  }
</script>

<script lang="ts">
  import type { DataSnapshot, Row } from '@metriccanvas/page';
  import EChart from './EChart.svelte';
  import { mapOption } from './chart-options';
  import { ensureBasemap, type BasemapMeta } from './map-register';

  /**
   * 地图(纯渲染,ECharts map):区域着色 + 散点叠加,点击区域只上抛行上下文。
   * 底图 geojson 是随包入库的静态展示资产(按需懒加载),不是数据请求,
   * 不违纯渲染原则——数据仍只来自快照。
   */
  interface Props {
    /** 就绪的数据快照(加载/错误/空态由 WidgetHost 统一呈现) */
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    config: MapChartConfig;
    /** 区域/散点点击,携带该区域对应的数据行 */
    onregionclick?: (context: { row: Row }) => void;
  }

  let { snapshot, config, onregionclick }: Props = $props();

  let basemap = $state<BasemapMeta>();
  $effect(() => {
    let alive = true;
    void ensureBasemap(config.display.map).then((meta) => {
      if (alive) basemap = meta;
    });
    return () => {
      alive = false;
    };
  });

  /**
   * 底图区域名 → 数据行(series 数据构造时已按 nameMap 改名,点击 name 恒为区域名)。
   * 回写筛选状态取的仍是行里的原始维度值,nameMap 只影响展示层定位。
   */
  const rowByGeoName = $derived(
    new Map(
      snapshot.rows.map((row) => {
        const raw = String(row[config.dimension] ?? '');
        return [config.display.nameMap?.[raw] ?? raw, row] as const;
      })
    )
  );

  function handleClick(_dataIndex: number, name?: string) {
    const row = name ? rowByGeoName.get(name) : undefined;
    if (row) onregionclick?.({ row });
  }
</script>

{#if basemap}
  <EChart
    option={mapOption(snapshot.rows, config.metric, config.dimension, config.display, basemap.centers)}
    onitemclick={onregionclick ? handleClick : undefined}
  />
{:else}
  <div class="loading">底图加载中…</div>
{/if}

<style>
  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    color: #a1a1aa;
    font-size: 13px;
  }
</style>
