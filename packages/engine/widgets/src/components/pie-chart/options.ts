import { resolveComponentValue } from '../../shared/component-value';
import type { PieChartProps } from '@metriccanvas/page/internal';
import type { EChartsOption } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { formatterValue } from '../../shared/chart-option';
import {
  categoricalColor,
  categoryDomain,
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
  const showLabelLine = props.labelLine ?? true;
  const compactRing = props.variant === 'compactRing';
  const names = rows.map((row) => formatValue(row[category.field], category.format, category.missingText));
  // Keep the full category domain so a missing sector never shifts colors shared with other views.
  const domain = categoryDomain(data.main.snapshot.rows.map(row => formatValue(row[category.field], category.format, category.missingText)));
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
        label: { show: compactRing ? false : showLabelLine, formatter: '{b}: {d}%' },
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

/** One projection for sectors and click identities: missing numbers do not shift original-row selection. */
export function pieRows(data: MainDataSlots, props: PieChartProps) {
  const value = resolveComponentValue(props, data, props.emptyBehavior);
  return data.main.snapshot.rows.filter(row => finiteNumber(value.read(row)) !== undefined);
}
