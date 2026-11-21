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
const DEFAULT_RING_THICKNESS = 16;

interface PiePlot {
  width: number;
  height: number;
  legendEdge: 'left' | 'right' | 'bottom';
}

function pieGeometry(props: PieChartProps, plot?: PiePlot): Pick<PieSeriesOption, 'radius' | 'center'> {
  if (props.variant === 'compactRing') {
    return { radius: [props.ring ?? '58%', '82%'], center: ['50%', '50%'] };
  }
  if (!plot) return { radius: props.ring ? [props.ring, '72%'] : '72%' };

  const halfSize = Math.min(plot.width, plot.height) / 2;
  const inner = Number.parseInt(props.ring ?? '0', 10) / 100 * halfSize;
  const outer = halfSize * 0.72;
  // Respect the declared inner radius and the outer radius limit in smaller plots.
  const ring = inner > 0 && inner < outer;
  const radius = ring ? Math.min(outer, inner + DEFAULT_RING_THICKNESS) : outer;
  const edgeInset = Math.max(radius, inner) + PIE_PLOT_EDGE_INSET;
  const center: [number, number] = [plot.width / 2, plot.height / 2];
  const horizontalInset = Math.min(edgeInset, center[0]);
  if (plot.legendEdge === 'left') center[0] = horizontalInset;
  if (plot.legendEdge === 'right') center[0] = plot.width - horizontalInset;
  if (plot.legendEdge === 'bottom') center[1] = plot.height - Math.min(edgeInset, center[1]);

  return { radius: props.ring ? [props.ring, radius] : radius, center };
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
  plot?: PiePlot
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
        ...pieGeometry(props, plot),
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
