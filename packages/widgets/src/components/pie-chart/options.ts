import type { PieChartProps } from '@metriccanvas/page';
import type { EChartsOption } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { formatterValue } from '../../shared/chart-option';

/**
 * 已解析命名数据槽 + 饼图 props → ECharts option 的纯翻译。
 * 标签继承字段契约;最终格式由组件字段绑定覆盖 defaultFormat 展示建议。
 */
export function pieOption(data: MainDataSlots, props: PieChartProps): EChartsOption {
  const rows = data.main.snapshot.rows;
  const category = resolveField(props.categoryField, data);
  const value = resolveField(props.valueField, data);
  const showLabelLine = props.labelLine ?? true;
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
        data: rows.map((row) => ({
          name: formatValue(row[category.field], category.format),
          value: finiteNumber(row[value.field]) ?? 0
        }))
      }
    ]
  };
}
