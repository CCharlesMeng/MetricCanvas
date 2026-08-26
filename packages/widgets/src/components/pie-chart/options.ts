import type { PieChartProps } from '@metriccanvas/page';
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
  const rows = data.main.snapshot.rows;
  const category = resolveField(props.categoryField, data);
  const value = resolveField(props.valueField, data);
  const showLabelLine = props.labelLine ?? true;
  const names = rows.map((row) => formatValue(row[category.field], category.format));
  const domain = categoryDomain(names);
  return {
    tooltip: {
      trigger: 'item',
      ...(value.format
        ? {
            valueFormatter: (raw: unknown) =>
              formatValue(formatterValue(raw), value.format)
          }
        : {})
    },
    series: [
      {
        type: 'pie',
        radius: props.ring ? [props.ring, '72%'] : '72%',
        label: { show: showLabelLine, formatter: '{b}: {d}%' },
        labelLine: { show: showLabelLine },
        data: rows.map((row, index) => {
          const name = names[index] ?? '';
          const color = categoricalColor(palette, name, domain);
          return {
            name,
            value: finiteNumber(row[value.field]) ?? 0,
            ...(color ? { itemStyle: { color } } : {})
          };
        })
      }
    ]
  };
}
