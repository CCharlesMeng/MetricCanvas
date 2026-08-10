import type { MapChartProps, Row } from '@metriccanvas/page';
import type { EChartsOption } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { formatterValue } from '../../shared/chart-option';

/**
 * 维度值 → 底图区域名。页面文档经 props.nameMap 声明式改名,
 * series 数据与点击回查共用这一份规则,点击事件的 name 因而恒为底图区域名。
 */
export function geoRegionName(
  row: Row,
  nameField: string,
  nameMap?: Record<string, string>
): string {
  const raw = String(row[nameField] ?? '');
  return nameMap?.[raw] ?? raw;
}

/**
 * 地图:nameField 的值定位底图区域,valueField 驱动着色;
 * 散点叠加坐标取底图资产的区域中心点(centers,见 basemap.ts)。
 */
export function mapOption(
  data: MainDataSlots,
  props: MapChartProps,
  centers: ReadonlyMap<string, [number, number]>
): EChartsOption {
  const rows = data.main.snapshot.rows;
  const name = resolveField(props.nameField, data);
  const value = resolveField(props.valueField, data);
  const geoName = (row: Row) => geoRegionName(row, name.field, props.nameMap);
  const values = rows.map((row) => finiteNumber(row[value.field]) ?? 0);
  const rawMin = values.length > 0 ? Math.min(...values) : 0;
  const rawMax = values.length > 0 ? Math.max(...values) : 0;
  const lo = rawMin < rawMax ? rawMin : Math.min(0, rawMin);
  const hi = rawMax > rawMin ? rawMax : Math.max(1, rawMax);

  const scatterData = rows.flatMap((row) => {
    const cp = centers.get(geoName(row));
    return cp
      ? [{ name: geoName(row), value: [...cp, finiteNumber(row[value.field]) ?? 0] }]
      : [];
  });

  return {
    tooltip: {
      trigger: 'item',
      ...(value.format
        ? {
            valueFormatter: (raw: unknown) =>
              formatValue(mapFormatterValue(raw), value.format)
          }
        : {})
    },
    // geo 组件承载底图(散点叠加需要 geo 坐标系),map 系列经 geoIndex 挂靠其上
    geo: {
      map: props.map,
      roam: true,
      label: { show: false },
      itemStyle: { borderColor: '#d4d4d8', areaColor: '#fafafa' },
      emphasis: {
        label: { show: true },
        itemStyle: { areaColor: '#dbeafe' }
      },
      select: { disabled: true }
    },
    visualMap: {
      type: 'continuous',
      min: lo,
      max: hi,
      seriesIndex: 0,
      left: 8,
      bottom: 8,
      itemHeight: 80,
      inRange: { color: ['#dbeafe', '#2563eb'] }
    },
    series: [
      {
        type: 'map',
        map: props.map,
        geoIndex: 0,
        data: rows.map((row) => ({
          name: geoName(row),
          value: finiteNumber(row[value.field]) ?? 0
        }))
      },
      ...(props.scatter
        ? [
            {
              type: props.scatter === 'effect' ? ('effectScatter' as const) : ('scatter' as const),
              coordinateSystem: 'geo' as const,
              symbolSize: 10,
              itemStyle: { color: '#f59e0b' },
              data: scatterData
            }
          ]
        : [])
    ]
  };
}

function mapFormatterValue(value: unknown): string | number | null | undefined {
  if (Array.isArray(value)) return formatterValue(value.at(-1));
  return formatterValue(value);
}
