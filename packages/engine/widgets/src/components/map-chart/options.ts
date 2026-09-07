import type { MapChartProps, Row } from '@metriccanvas/page';
import type { EChartsOption } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { fieldLabel, resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { formatterValue } from '../../shared/chart-option';
import type { ColorList } from '../../shared/chart-palette';
import { mapLegendLevels, mapLegendPieces } from './legend';
import { mapTooltipMarkup, mapTooltipRows, type MapTooltipField } from './tooltip';

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
 * 地图内容投影矩形。它与 safeArea 使用同一坐标系，但已经归一为居中正方形；
 * ECharts option 与 DOM 图例只消费这一份结果，避免各自重算后漂移。
 */
export interface MapProjectionRect extends MapSafeArea {}

/** safeArea → 以其中心为中心、边长取短边的正方形投影；无正面积时回退。 */
export function projectionRect(
  safeArea: MapSafeArea | undefined
): MapProjectionRect | undefined {
  if (!safeArea || safeArea.width <= 0 || safeArea.height <= 0) return undefined;
  const size = Math.min(safeArea.width, safeArea.height);
  return {
    x: safeArea.x + (safeArea.width - size) / 2,
    y: safeArea.y + (safeArea.height - size) / 2,
    width: size,
    height: size
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
  regionalPinUrl?: string
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
  const regionalOverview = props.variant === 'regionalOverview';
  const pinnedMatch = props.pinnedSummary
    ? resolveField(props.pinnedSummary.matchField, data)
    : undefined;

  /* 散点持「双名」:坐标查询用映射后的底图区域名(centers 的键),
     而 name 用原始维度值——否则 8 个中文地区部经 nameMap 映射到底图区域后,
     标签与 tooltip 会显示英文底图名。 */
  const scatterData = rows.flatMap((row) => {
    const cp = centers.get(geoName(row));
    if (!cp) return [];
    const rawName = String(row[name.field] ?? '');
    const pinned =
      pinnedMatch !== undefined &&
      row[pinnedMatch.field] === props.pinnedSummary?.matchValue;
    return [{
      name: rawName,
      value: [...cp, finiteNumber(row[value.field]) ?? 0],
      ...(pinned ? { label: { show: false }, emphasis: { label: { show: false } } } : {})
    }];
  });

  const projected = projection && projection.width > 0 && projection.height > 0
    ? {
        layoutCenter: [
          `${projection.x + projection.width / 2}px`,
          `${projection.y + projection.height / 2}px`
        ] as [string, string],
        layoutSize: projection.width
      }
    : undefined;

  /* 档位既是图例的档,也是着色的档:声明了 `legend` 就按档位取色,不再把取值
     区间均分。没有分档色板(报表形态)时档位无色可配,退回原来的连续渐变。 */
  const levels = props.legend ? mapLegendLevels(props.legend.bands, scale) : undefined;
  const pieces = levels && scale ? mapLegendPieces(levels) : undefined;

  const tooltipFields: MapTooltipField[] = (props.tooltipFields ?? []).map((entry) => {
    const resolved = resolveField(entry.field, data);
    return {
      label: entry.label,
      field: resolved.field,
      ...(resolved.format === undefined ? {} : { format: resolved.format })
    };
  });
  // 区域着色系列上抛底图区域名,散点系列上抛原始维度值,两种都要能查回行
  const rowByName = new Map<string, Row>();
  for (const row of rows) {
    rowByName.set(geoName(row), row);
    rowByName.set(String(row[name.field] ?? ''), row);
  }

  return {
    tooltip:
      tooltipFields.length > 0
        ? {
            trigger: 'item',
            formatter: (params: unknown) => {
              const hovered = rowByName.get(itemName(params));
              const title = hovered
                ? String(hovered[name.field] ?? '')
                : itemName(params);
              return mapTooltipMarkup(title, [
                {
                  label: fieldLabel(props.valueField, data),
                  value: formatValue(hovered?.[value.field], value.format)
                },
                ...mapTooltipRows(hovered, tooltipFields)
              ]);
            }
          }
        : {
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
    visualMap: pieces
      ? {
          type: 'piecewise',
          // 档位自带上下界与颜色,取值落在哪一档就取那一档的色。图例由组件用
          // DOM 画(设计源的图例是「标题 + 四档色点区间」),关掉图表库这一块。
          pieces,
          seriesIndex: 0,
          show: false
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
          inRange: { color: [...scale].reverse() }
        }
      : {
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
              ...(regionalOverview
                ? {
                    ...(regionalPinUrl ? { symbol: `image://${regionalPinUrl}` } : {}),
                    symbolSize: [15.51, 20],
                    symbolOffset: [0, 10]
                  }
                : { symbolSize: 10 }),
              itemStyle: { color: regionalOverview ? '#6177e4' : '#f59e0b' },
              // `{b}` 取数据项的 name,即上面的原始维度值
              label: regionalOverview
                ? {
                    show: true,
                    formatter: '{b}',
                    position: 'top' as const,
                    distance: 2,
                    padding: [2, 8],
                    color: '#191919',
                    fontSize: 12,
                    lineHeight: 18,
                    backgroundColor: '#fff',
                    borderColor: 'rgba(97, 119, 228, 0.35)',
                    borderWidth: 1,
                    borderRadius: 11
                  }
                : { show: !compact, formatter: '{b}', position: 'top' as const },
              emphasis: regionalOverview
                ? {
                    scale: 1.12,
                    label: {
                      show: true,
                      backgroundColor: '#eef3ff',
                      borderColor: '#6177e4'
                    }
                  }
                : undefined,
              data: scatterData
            }
          ]
        : [])
    ]
  };
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
