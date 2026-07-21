<script lang="ts">
  import type { MapChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from './component-data';
  import { resolveField } from './component-data';
  import EChart from './EChart.svelte';
  import { mapOption } from './chart-options';
  import { ensureBasemap, type BasemapMeta } from './map-register';

  /**
   * 地图(纯渲染,ECharts map):区域着色 + 散点叠加,点击区域只上抛行上下文。
   * 底图 geojson 是随包入库的静态展示资产(按需懒加载),不是数据请求,
   * 不违纯渲染原则——数据仍只来自快照。
   */
  interface Props {
    /** 已解析的 main 数据槽(加载/错误/空态由统一运行时呈现) */
    data: MainDataSlots;
    props: MapChartProps;
    /** 区域/散点点击,携带该区域对应的数据行 */
    onregionclick?: (context: { row: Row }) => void;
  }

  let { data, props, onregionclick }: Props = $props();

  let basemap = $state<BasemapMeta>();
  $effect(() => {
    let alive = true;
    void ensureBasemap(props.map).then((meta) => {
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
      data.main.snapshot.rows.map((row) => {
        const nameField = resolveField(props.nameField, data).field;
        const raw = String(row[nameField] ?? '');
        return [props.nameMap?.[raw] ?? raw, row] as const;
      })
    )
  );

  function handleClick(_dataIndex: number, name?: string) {
    const row = name ? rowByGeoName.get(name) : undefined;
    if (row) onregionclick?.({ row });
  }
</script>

{#if props.title}<h3>{props.title}</h3>{/if}
{#if basemap}
  <EChart
    option={mapOption(data, props, basemap.centers)}
    onitemclick={onregionclick ? handleClick : undefined}
  />
{:else}
  <div class="loading">底图加载中…</div>
{/if}

<style>
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
