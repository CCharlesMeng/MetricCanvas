import { isIocOfficeLevel, type MapChartProps, type Row } from '@metriccanvas/page/internal';
import type { EChartsOption } from 'echarts';
import { formatChartNumber, formatterValue } from '../../shared/chart-option';
import type { ColorList } from '../../shared/chart-palette';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { type ResolvedComponentValue, resolveComponentValue } from '../../shared/component-value';
import { finiteNumber } from '../../shared/value-format';
import type { MapFocus } from './auto-focus';
import { mapRows, organizationBinding } from './geography';
import { mapLegendLevels, mapLegendPieces } from './legend';
import {
  groupedMapTooltip,
  type MapTooltipField,
  mapTooltipMarkup,
  mapTooltipRows,
} from './tooltip';

/**
 * 维度值 → 底图区域名。页面文档经 props.nameMap 声明式改名,
 * series 数据与点击回查共用这一份规则,点击事件的 name 因而恒为底图区域名。
 */
export function geoRegionName(
  row: Row,
  nameField: string,
  nameMap?: Record<string, string>,
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
 * 地图内容投影矩形。它与 safeArea 使用同一坐标系，但已经归一为居中正方形；
 * ECharts option 与 DOM 图例只消费这一份结果，避免各自重算后漂移。
 */
export interface MapProjectionRect extends MapSafeArea {}

/** safeArea → 以其中心为中心、边长取短边的正方形投影；无正面积时回退。 */
export function projectionRect(safeArea: MapSafeArea | undefined): MapProjectionRect | undefined {
  if (!safeArea || safeArea.width <= 0 || safeArea.height <= 0) return undefined;
  const size = Math.min(safeArea.width, safeArea.height);
  return {
    x: safeArea.x + (safeArea.width - size) / 2,
    y: safeArea.y + (safeArea.height - size) / 2,
    width: size,
    height: size,
  };
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

function geoLayout(projection?: MapProjectionRect) {
  if (!(projection && projection.width > 0 && projection.height > 0)) return;
  return {
    layoutCenter: [
      `${projection.x + projection.width / 2}px`,
      `${projection.y + projection.height / 2}px`,
    ] as [string, string],
    layoutSize: projection.width,
  };
}

/**
 * 地图:nameField 的值定位底图区域,valueField 驱动着色;
 * 散点叠加坐标取底图资产的区域中心点(centers,见 basemap.ts)。
 *
 * `projection` 给出时把底图投影进该正方形,缺席即全容器渲染(退回路径)。
 * `compact` 是档位标记而不是视口判断——关掉散点文字标签,由调用方决定档位。
 *
 * `scale` 是形态分档色,色列**从高档到低档**;缺席即连续渐变(报表形态的既有取值)。
 */
export function mapOption(
  data: MainDataSlots,
  props: MapChartProps,
  centers: ReadonlyMap<string, [number, number]>,
  projection?: MapProjectionRect,
  compact = false,
  scale?: ColorList,
  /** 地域概览定位针由 Svelte 资源管线解析，纯 option 层只消费 URL。 */
  regionalPinUrl?: string,
  geography?: ReturnType<typeof mapRows>,
): EChartsOption {
  const rows = data.main.snapshot.rows;
  const name = resolveField(props.nameField, data);
  const value = resolveComponentValue(props, data, props.emptyBehavior);
  const locations = geography ?? mapRows(rows, name.field, props);
  const pendingValue = mapValuePending(props, data);
  const values = rows.map((row) => finiteNumber(value.read(row)) ?? 0);
  const rawMin = values.length > 0 ? Math.min(...values) : 0;
  const rawMax = values.length > 0 ? Math.max(...values) : 0;
  const lo = rawMin < rawMax ? rawMin : Math.min(0, rawMin);
  const hi = rawMax > rawMin ? rawMax : Math.max(1, rawMax);
  const regionalOverview = props.variant === 'regionalOverview';
  const inlinePin =
    regionalOverview && isIocOfficeLevel(organizationBinding(props)?.level)
      ? regionalPinUrl
      : undefined;
  const pinnedMatch = props.pinnedSummary
    ? resolveField(props.pinnedSummary.matchField, data)
    : undefined;

  /* 散点持「双名」:坐标查询用映射后的底图区域名(centers 的键),
     而 name 用原始维度值——否则 8 个中文地区部经 nameMap 映射到底图区域后,
     标签与 tooltip 会显示英文底图名。 */
  const scatterData = rows.flatMap((row) => {
    const point = locations.placements.get(row)!.point;
    const cp = 'lngLat' in point ? point.lngLat : centers.get(point.feature);
    if (!cp) return [];
    const rawName = String(row[name.field] ?? '');
    const pinned =
      pinnedMatch !== undefined && row[pinnedMatch.field] === props.pinnedSummary?.matchValue;
    return [
      {
        name: rawName,
        value: [...cp, pendingValue ? null : (finiteNumber(value.read(row)) ?? 0)],
        ...(pinned
          ? {
              label: { show: false },
              emphasis: { label: { show: false } },
              ...(inlinePin ? mapScatterSymbol(true, inlinePin) : {}),
            }
          : {}),
      },
    ];
  });

  /* 档位既是图例的档,也是着色的档:声明了 `legend` 就按档位取色,不再把取值
     区间均分。没有分档色板(报表形态)时档位无色可配,退回原来的连续渐变。 */
  const levels = props.legend ? mapLegendLevels(props.legend.bands, scale) : undefined;
  const pieces = levels && scale ? mapLegendPieces(levels) : undefined;

  const pointLabel = mapPointLabel(props, value, locations, inlinePin);
  return {
    tooltip: mapTooltip(data, props, name.field, value, locations),
    // geo 组件承载底图(散点叠加需要 geo 坐标系),map 系列经 geoIndex 挂靠其上
    geo: {
      map: props.map,
      roam: true,
      ...geoLayout(projection),
      label: { show: false },
      itemStyle: { borderColor: '#d4d4d8', areaColor: '#fafafa' },
      emphasis: {
        label: { show: true },
        itemStyle: { areaColor: '#dbeafe' },
      },
      select: { disabled: true },
    },
    visualMap: pieces
      ? {
          type: 'piecewise',
          // 档位自带上下界与颜色,取值落在哪一档就取那一档的色。图例由组件用
          // DOM 画(设计源的图例是「标题 + 四档色点区间」),关掉图表库这一块。
          pieces,
          seriesIndex: 0,
          show: false,
        }
      : scale
        ? {
            type: 'piecewise',
            min: lo,
            max: hi,
            // 档数由色列长度决定:色列是分档的定义,不是渐变的取样
            splitNumber: scale.length,
            seriesIndex: 0,
            left: 8,
            bottom: 8,
            // inRange 从低到高,而色列从高到低——这里翻过来
            inRange: { color: [...scale].reverse() },
          }
        : {
            type: 'continuous',
            min: lo,
            max: hi,
            seriesIndex: 0,
            left: 8,
            bottom: 8,
            itemHeight: 80,
            inRange: { color: ['#dbeafe', '#2563eb'] },
          },
    series: [
      {
        type: 'map',
        map: props.map,
        geoIndex: 0,
        data: pendingValue ? [] : mapSeriesRows(rows, locations, props, name.field, value.read),
      },
      ...(props.scatter
        ? [
            {
              type: props.scatter === 'effect' ? ('effectScatter' as const) : ('scatter' as const),
              coordinateSystem: 'geo' as const,
              encode: { tooltip: [2] }, // [longitude, latitude, metric]
              ...mapScatterSymbol(regionalOverview, regionalPinUrl, inlinePin),
              label: regionalOverview
                ? {
                    show: true,
                    ...pointLabel,
                    position: inlinePin ? ('inside' as const) : ('top' as const),
                    distance: 2,
                    padding: [2, 8],
                    color: '#191919',
                    fontSize: 12,
                    lineHeight: 18,
                    backgroundColor: '#fff',
                    borderColor: 'rgba(97, 119, 228, 0.35)',
                    borderWidth: 1,
                    borderRadius: 11,
                  }
                : { show: !compact, ...pointLabel, position: 'top' as const },
              emphasis: regionalOverview
                ? {
                    scale: 1.12,
                    label: {
                      show: true,
                      backgroundColor: '#eef3ff',
                      borderColor: '#6177e4',
                    },
                  }
                : undefined,
              data: scatterData,
            },
          ]
        : []),
    ],
  };
}

function mapValuePending(props: MapChartProps, data: MainDataSlots): boolean {
  const pending = data.main.progress?.pendingFields;
  return (
    props.valueField !== undefined &&
    pending?.includes(resolveField(props.valueField, data).field) === true
  );
}

function mapScatterSymbol(regionalOverview: boolean, pinUrl?: string, inlinePin?: string) {
  if (!regionalOverview) return { symbolSize: 10, itemStyle: { color: '#f59e0b' } };
  // Keep an anchor for the interactive label. The pin itself is drawn inside that label.
  if (inlinePin) return { symbol: 'circle', symbolSize: 1, itemStyle: { color: 'transparent' } };
  return {
    ...(pinUrl ? { symbol: `image://${pinUrl}` } : {}),
    symbolSize: [15.51, 20],
    symbolOffset: [0, 10],
    itemStyle: { color: '#6177e4' },
  };
}

function mapPointLabel(
  props: MapChartProps,
  value: ResolvedComponentValue,
  locations: ReturnType<typeof mapRows>,
  inlinePin?: string,
) {
  const showValue = props.pointLabel === 'nameAndValue';
  if (!showValue && !inlinePin && !locations.displayNames.size) return { formatter: '{b}' };
  return {
    rich: {
      ...(showValue ? { metric: { fontWeight: 400, color: '#000' } } : {}),
      ...(inlinePin
        ? { pin: { backgroundColor: { image: inlinePin }, width: 9.3, height: 12 } }
        : {}),
    },
    formatter: (params: unknown) => {
      const name = itemName(params);
      const row = locations.points.get(name);
      const displayName = mapDisplayName(locations, row, name);
      const label = inlinePin ? `{pin|} ${displayName}` : displayName;
      if (!showValue) return label;
      if (!row) return label;
      const metric = value.read(row);
      if (finiteNumber(metric) === undefined) return label;
      return `${label} {metric|${formatChartNumber(metric, value.format, value.missingText, value.unit)}}`;
    },
  };
}

function mapDisplayName(
  locations: ReturnType<typeof mapRows>,
  row: Row | undefined,
  original: string,
): string {
  return row ? (locations.displayNames.get(row) ?? original) : original;
}

function mapTooltip(
  data: MainDataSlots,
  props: MapChartProps,
  nameField: string,
  value: ResolvedComponentValue,
  locations: ReturnType<typeof mapRows>,
): EChartsOption['tooltip'] {
  const hovered = (params: unknown) =>
    (isScatterItem(params) ? locations.points : locations.areas).get(itemName(params));
  const title = (row: Row) => mapDisplayName(locations, row, String(row[nameField] ?? ''));
  if (props.tooltipRows) {
    const markup = groupedMapTooltip(props.tooltipRows, data, props.emptyBehavior);
    return {
      trigger: 'item',
      borderWidth: 0,
      formatter: (params: unknown) => {
        const row = hovered(params);
        return row ? markup(title(row), row) : '';
      },
    };
  }
  const fields: MapTooltipField[] = (props.tooltipFields ?? []).map((entry) => ({
    ...resolveComponentValue(entry, data, props.emptyBehavior),
    label: entry.label,
  }));
  if (!fields.length && !locations.displayNames.size)
    return {
      trigger: 'item',
      valueFormatter: (raw: unknown) =>
        formatChartNumber(
          mapFormatterValue(raw),
          value.format ?? 'number',
          value.missingText,
          value.unit,
        ),
    };
  return {
    trigger: 'item',
    formatter: (params: unknown) => {
      const row = hovered(params);
      return mapTooltipMarkup(row ? title(row) : itemName(params), [
        {
          label: value.label,
          value: formatChartNumber(
            row ? value.read(row) : undefined,
            value.format,
            value.missingText,
            value.unit,
          ),
        },
        ...mapTooltipRows(row, fields),
      ]);
    },
  };
}

/** A resolved viewport is a rendering input, independent of the page and metric rows. */
export function withMapViewport(
  option: EChartsOption,
  viewport: MapFocus | undefined,
): EChartsOption {
  if (!viewport || !option.geo || Array.isArray(option.geo)) return option;
  return { ...option, geo: { ...option.geo, ...viewport } };
}

/** tooltip 回调参数里的数据项名;`trigger: 'item'` 下恒为单项。 */
function itemName(params: unknown): string {
  const name = (params as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? name : '';
}

function mapFormatterValue(value: unknown): string | number | null | undefined {
  if (Array.isArray(value)) return formatterValue(value.at(-1));
  return formatterValue(value);
}

function isScatterItem(params: unknown) {
  return (params as { seriesIndex?: number } | null)?.seriesIndex === 1;
}

function mapSeriesRows(
  rows: Row[],
  locations: ReturnType<typeof mapRows>,
  props: MapChartProps,
  field: string,
  read: (row: Row) => Parameters<typeof finiteNumber>[0],
) {
  if (!locations.shared)
    return rows.map((row) => ({
      name: geoRegionName(row, field, props.nameMap),
      value: finiteNumber(read(row)) ?? 0,
    }));
  return Array.from(locations.areas).flatMap(([name, row]) =>
    row ? [{ name, value: finiteNumber(read(row)) ?? 0 }] : [],
  );
}
