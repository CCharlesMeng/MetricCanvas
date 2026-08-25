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
 * 未遮挡矩形,坐标系是 backdrop 单元格自身盒(见 runtime-ui 侧的 IFC)。
 * 这里重新声明结构类型而不是从 `runtime-ui` 导入:`PATTERN-STRUCT-1` 规定
 * 分层依赖单向,`widgets` 不得依赖 `runtime-ui`。
 */
export interface MapSafeArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 地图:nameField 的值定位底图区域,valueField 驱动着色;
 * 散点叠加坐标取底图资产的区域中心点(centers,见 basemap.ts)。
 *
 * `safeArea` 给出时把底图投影进该矩形,缺席即全容器渲染(退回路径)。
 * `compact` 是档位标记而不是视口判断——关掉散点文字标签,由调用方决定档位。
 */
export function mapOption(
  data: MainDataSlots,
  props: MapChartProps,
  centers: ReadonlyMap<string, [number, number]>,
  safeArea?: MapSafeArea,
  compact = false
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

  /* 散点持「双名」:坐标查询用映射后的底图区域名(centers 的键),
     而 name 用原始维度值——否则 8 个中文地区部经 nameMap 映射到底图区域后,
     标签与 tooltip 会显示英文底图名。 */
  const scatterData = rows.flatMap((row) => {
    const cp = centers.get(geoName(row));
    if (!cp) return [];
    const rawName = String(row[name.field] ?? '');
    return [{ name: rawName, value: [...cp, finiteNumber(row[value.field]) ?? 0] }];
  });

  // 宽或高非正视为无解,与 backdropSafeArea 返回 null 走同一条退回路径
  const projected =
    safeArea && safeArea.width > 0 && safeArea.height > 0
      ? {
          layoutCenter: [
            `${safeArea.x + safeArea.width / 2}px`,
            `${safeArea.y + safeArea.height / 2}px`
          ] as [string, string],
          // 取短边:保证底图内容整体落在矩形内,不越出去被浮层压住
          layoutSize: Math.min(safeArea.width, safeArea.height)
        }
      : undefined;

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
      ...(projected ?? {}),
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
              // `{b}` 取数据项的 name,即上面的原始维度值
              label: { show: !compact, formatter: '{b}', position: 'top' as const },
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
