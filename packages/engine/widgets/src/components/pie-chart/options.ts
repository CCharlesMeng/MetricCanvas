import { resolveComponentValue } from '../../shared/component-value';
import type { PieChartProps } from '@metriccanvas/page/internal';
import type { EChartsOption, DefaultLabelFormatterCallbackParams, PieSeriesOption } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { formatChartNumber } from '../../shared/chart-option';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { pieRows, pieCategoryDomain, pieValueTotal, piePercentage } from './presentation';
export { pieRows } from './presentation';
import { formatterValue } from '../../shared/chart-option';
import {
  categoricalColor,
  type ColorList
} from '../../shared/chart-palette';

export const PIE_PLOT_EDGE_INSET = 8;
const TABLE_RING_OUTER_RADIUS = 64;
const DEFAULT_RING_THICKNESS = 16;

interface PiePlot {
  width: number;
  height: number;
  legendEdge: 'left' | 'right' | 'bottom';
}

type PieGeometry = Pick<PieSeriesOption, 'radius' | 'center'>;

export function pieTableLegendGeometry(ring: PieChartProps['ring'], plot: PiePlot): {
  series: PieGeometry;
  legendOffset: number;
} {
  const halfSize = Math.min(plot.width, plot.height) / 2;
  // Side-by-side rings can occupy less than the original 240px minimum plot.
  // Use its reference size for the band so fitting the pair does not thin the ring.
  const bandHalfSize = plot.legendEdge === 'right'
    ? Math.min(Math.max(240, plot.width), plot.height) / 2 : halfSize;
  const inner = Number.parseInt(ring ?? '0', 10) / 100 * bandHalfSize;
  const outerLimit = bandHalfSize * 0.72;
  const outerRadius = inner > 0 ? Math.min(TABLE_RING_OUTER_RADIUS, halfSize) : halfSize * 0.72;
  // Keep the existing visible band, including percentages at or beyond the 72% radius limit.
  const thickness = inner <= outerLimit
    ? Math.min(DEFAULT_RING_THICKNESS, outerLimit - inner)
    : inner - outerLimit;
  const radius: PieSeriesOption['radius'] = inner > 0
    ? [Math.max(0, outerRadius - thickness), outerRadius]
    : outerRadius;
  const edgeInset = outerRadius + PIE_PLOT_EDGE_INSET;
  const center: [number, number] = [plot.width / 2, plot.height / 2];
  let legendOffset = 0;
  if (plot.legendEdge === 'bottom') {
    center[1] = plot.height - Math.min(edgeInset, center[1]);
  } else {
    const nearEdge = Math.min(edgeInset, center[0]);
    const direction = plot.legendEdge === 'left' ? 1 : -1;
    // Share the blank plot area opposite the legend between the two outer margins.
    legendOffset = direction * (plot.width - nearEdge - outerRadius) / 2;
    center[0] += direction * (nearEdge - outerRadius) / 2;
  }
  return { series: { radius, center }, legendOffset };
}

function pieGeometry(props: PieChartProps, tableGeometry?: PieGeometry): PieGeometry {
  if (props.variant === 'compactRing') {
    return { radius: [props.ring ?? '58%', '82%'], center: ['50%', '50%'] };
  }
  return tableGeometry ?? { radius: props.ring ? [props.ring, '72%'] : '72%' };
}

/**
 * 已解析命名数据槽 + 饼图 props → ECharts option 的纯翻译。
 * 标签继承字段契约;最终格式由组件字段绑定覆盖 defaultFormat 展示建议。
 *
 * `palette` 缺席即不写 `color`,扇区取图表库内置色(报表形态的既有取值)。
 * 给出时逐扇区**按类别**取色而不是按扇区序号,同一类别在别处也取到同一颜色。
 */
export function pieOption(
  data: MainDataSlots,
  props: PieChartProps,
  palette?: ColorList,
  tableGeometry?: PieGeometry
): EChartsOption {
  const rows = pieRows(data, props);
  const category = resolveField(props.categoryField, data);
  const value = resolveComponentValue(props, data, props.emptyBehavior);
  const total = pieValueTotal(rows, value);
  const showLabelLine = props.labelLine ?? !props.legend;
  const compactRing = props.variant === 'compactRing';
  const names = rows.map((row) => formatValue(row[category.field], category.format, category.missingText));
  // Keep the full category domain so a missing sector never shifts colors shared with other views.
  const domain = pieCategoryDomain(data, props);
  return {
    tooltip: {
      trigger: 'item',
      ...(value.format
        ? {
            valueFormatter: (raw: unknown) =>
              formatChartNumber(formatterValue(raw), value.format, value.missingText, value.unit)
          }
        : {})
    },
    series: [
      {
        type: 'pie',
        ...pieGeometry(props, tableGeometry),
        label: {
          show: compactRing ? false : showLabelLine,
          ...(total === 0 ? { alignTo: 'edge' as const, edgeDistance: 8, overflow: 'none' as const } : {}),
          formatter: (params: DefaultLabelFormatterCallbackParams) =>
            `${params.name}: ${formatChartNumber(piePercentage(formatterValue(params.value), total), 'percent-adaptive')}`
        },
        labelLine: { show: compactRing ? false : showLabelLine },
        data: rows.flatMap((row, index) => {
          const numeric = finiteNumber(value.read(row));
          if (numeric === undefined) return [];
          const name = names[index] ?? '';
          const color = categoricalColor(palette, name, domain);
          return [{
            name,
            value: numeric,
            ...(color ? { itemStyle: { color } } : {})
          }];
        })
      }
    ]
  };
}
