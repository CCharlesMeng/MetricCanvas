import { resolveComponentValue } from '../../shared/component-value';
import type { PieChartProps } from '@metriccanvas/page/internal';
import type { EChartsOption, DefaultLabelFormatterCallbackParams } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { pieRows, pieCategoryDomain, pieValueTotal, piePercentage } from './presentation';
export { pieRows } from './presentation';
import { formatterValue } from '../../shared/chart-option';
import {
  categoricalColor,
  type ColorList
} from '../../shared/chart-palette';

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
  palette?: ColorList
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
              formatValue(formatterValue(raw), value.format, value.missingText)
          }
        : {})
    },
    series: [
      {
        type: 'pie',
        radius: compactRing
          ? [props.ring ?? '58%', '82%']
          : props.ring
            ? [props.ring, '72%']
            : '72%',
        ...(compactRing ? { center: ['50%', '50%'] as [string, string] } : {}),
        label: {
          show: compactRing ? false : showLabelLine,
          ...(total === 0 ? { alignTo: 'edge' as const, edgeDistance: 8, overflow: 'none' as const } : {}),
          formatter: (params: DefaultLabelFormatterCallbackParams) =>
            `${params.name}: ${formatValue(piePercentage(formatterValue(params.value), total), 'percent-1')}`
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
