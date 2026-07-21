import type {
  BarChartProps,
  LineChartProps,
  MapChartProps,
  PieChartProps,
  Row
} from '@metriccanvas/page';
import type { EChartsOption } from 'echarts';
import type { MainDataSlots } from './component-data';
import { fieldLabel, resolveField } from './component-data';
import { formatValue } from './value-format';

/**
 * 已解析命名数据槽 + 组件 props → ECharts option 的纯翻译。
 * 标签和格式统一继承数据源字段契约。
 */

/** ECharts 默认色板(面积渐变需要按系列色构造 colorStops,故显式持有) */
const PALETTE = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452'];

const GRID = { left: 8, right: 12, top: 28, bottom: 4, containLabel: true } as const;

export function lineOption(
  data: MainDataSlots,
  props: LineChartProps
): EChartsOption {
  const rows = data.main.snapshot.rows;
  const x = resolveField(props.xField, data);

  return {
    grid: props.showPointLabels ? { ...GRID, top: 36, right: 30 } : GRID,
    tooltip: { trigger: 'axis', confine: true, hideDelay: 200 },
    ...(props.series.length > 1 ? { legend: { top: 0, left: 0 } } : {}),
    xAxis: {
      type: 'category',
      name: fieldLabel(props.xField, data),
      data: rows.map((row) => formatValue(row[x.field], x.definition?.format))
    },
    yAxis: dualOrSingleAxis(props.dualAxis, props.series.length, props.hideYAxis),
    series: props.series.map((series, i) => {
      const field = resolveField(series.field, data);
      return {
        name: series.label ?? field.definition?.label ?? field.field,
        type: 'line' as const,
        smooth: props.smooth ?? false,
        ...(props.stacked ? { stack: 'total' } : {}),
        ...(props.dualAxis && i > 0 ? { yAxisIndex: 1 } : {}),
        ...(props.areaGradient ? { areaStyle: gradientArea(i) } : {}),
        ...(props.showPointLabels
          ? {
              label: {
                show: true,
                position: 'top' as const,
                color: '#191919',
                fontSize: 12,
                formatter: (params: unknown) =>
                  formatValue(formatterValue(params), field.definition?.format)
              }
            }
          : {}),
        ...(field.definition?.format
          ? {
              tooltip: {
                valueFormatter: (value: unknown) =>
                  formatValue(formatterValue(value), field.definition?.format)
              }
            }
          : {}),
        data: rows.map((row) => numberOrGap(row[field.field]))
      };
    })
  };
}

export function barOption(
  data: MainDataSlots,
  props: BarChartProps
): EChartsOption {
  const rows = data.main.snapshot.rows;
  const category = resolveField(props.categoryField, data);
  const categories = rows.map((row) =>
    formatValue(row[category.field], category.definition?.format)
  );
  const categoryAxis = { type: 'category' as const, data: categories };
  const valueAxis = dualOrSingleAxis(props.dualAxis, props.series.length);
  return {
    grid: GRID,
    tooltip: { trigger: 'axis', confine: true },
    ...(props.series.length > 1 ? { legend: { top: 0, left: 0 } } : {}),
    // 横向条形:类目轴与数值轴对调(覆盖存量两个水平条形组件的场景)
    xAxis: props.horizontal ? valueAxis : categoryAxis,
    yAxis: props.horizontal ? categoryAxis : valueAxis,
    series: props.series.map((series, i) => {
      const field = resolveField(series.field, data);
      return {
        name: series.label ?? field.definition?.label ?? field.field,
        type: 'bar' as const,
        ...(props.stacked ? { stack: 'total' } : {}),
        ...(props.dualAxis && i > 0 ? { yAxisIndex: 1 } : {}),
        ...(props.rounded ? { itemStyle: { borderRadius: roundedCorners(props) } } : {}),
        ...(field.definition?.format
          ? {
              tooltip: {
                valueFormatter: (value: unknown) =>
                  formatValue(formatterValue(value), field.definition?.format)
              }
            }
          : {}),
        data: rows.map((row) => numberOrGap(row[field.field]))
      };
    })
  };
}

export function pieOption(
  data: MainDataSlots,
  props: PieChartProps
): EChartsOption {
  const rows = data.main.snapshot.rows;
  const category = resolveField(props.categoryField, data);
  const value = resolveField(props.valueField, data);
  const showLabelLine = props.labelLine ?? true;
  return {
    tooltip: {
      trigger: 'item',
      ...(value.definition?.format
        ? {
            valueFormatter: (raw: unknown) =>
              formatValue(formatterValue(raw), value.definition?.format)
          }
        : {})
    },
    series: [
      {
        type: 'pie',
        radius: props.ring ? [props.ring, '72%'] : '72%',
        label: { show: showLabelLine, formatter: '{b}: {d}%' },
        labelLine: { show: showLabelLine },
        data: rows.map((row) => ({
          name: formatValue(row[category.field], category.definition?.format),
          value: numberOrGap(row[value.field]) ?? 0
        }))
      }
    ]
  };
}

/**
 * 地图:nameField 的值定位底图区域(可经 props.nameMap 声明式改名),valueField 驱动着色;
 * 散点叠加坐标取底图资产的区域中心点(centers,见 map-register)。
 * 页面文档声明的是"维度值 → 底图区域名",构造 series 数据时已完成改名,
 * 因此点击事件的 name 恒为底图区域名,组件按它映射回数据行。
 */
export function mapOption(
  data: MainDataSlots,
  props: MapChartProps,
  centers: ReadonlyMap<string, [number, number]>
): EChartsOption {
  const rows = data.main.snapshot.rows;
  const name = resolveField(props.nameField, data);
  const value = resolveField(props.valueField, data);
  const geoName = (row: Row) => {
    const raw = String(row[name.field] ?? '');
    return props.nameMap?.[raw] ?? raw;
  };
  const values = rows.map((row) => numberOrGap(row[value.field]) ?? 0);
  const lo = Math.min(...values);
  const hi = Math.max(...values);

  const scatterData = rows.flatMap((row) => {
    const cp = centers.get(geoName(row));
    return cp ? [{ name: geoName(row), value: [...cp, numberOrGap(row[value.field]) ?? 0] }] : [];
  });

  return {
    tooltip: { trigger: 'item' },
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
      min: lo < hi ? lo : 0,
      max: hi > lo ? hi : hi || 1,
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
        data: rows.map((row) => ({ name: geoName(row), value: numberOrGap(row[value.field]) ?? 0 }))
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

/** 双轴:第二个及之后的指标走右轴;单轴时只留左轴 */
function dualOrSingleAxis(
  dualAxis: boolean | undefined,
  metricCount: number,
  hideAxis = false
) {
  const axis = () => ({
    type: 'value' as const,
    ...(hideAxis
      ? {
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false }
        }
      : {})
  });
  if (dualAxis && metricCount > 1) {
    return [axis(), axis()];
  }
  return axis();
}

/** 面积渐变:按系列色从 35% 不透明度渐隐到底部 */
function gradientArea(seriesIndex: number) {
  const color = PALETTE[seriesIndex % PALETTE.length];
  return {
    color: {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: withAlpha(color, 0.35) },
        { offset: 1, color: withAlpha(color, 0.02) }
      ]
    }
  };
}

/** 圆角只加在柱条的"生长端"(横向为右侧,纵向为顶端) */
function roundedCorners(props: BarChartProps): number[] {
  return props.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
}

/** 稀疏指标(某维度组合缺行)按数据缺口处理,折线断开、柱条不画 */
function numberOrGap(value: Row[string] | undefined): number | undefined {
  return typeof value === 'number' ? value : value == null ? undefined : Number(value);
}

function formatterValue(value: unknown): string | number | null | undefined {
  if (typeof value === 'string' || typeof value === 'number' || value == null) return value;
  if (typeof value !== 'object') return undefined;
  const candidate = (value as { value?: unknown }).value;
  return typeof candidate === 'string' || typeof candidate === 'number' || candidate == null
    ? candidate
    : undefined;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
