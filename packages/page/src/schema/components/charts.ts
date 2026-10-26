import { fieldSeriesSourceZ, constantSeriesSourceZ, fieldValueSourceZ, constantValueSourceZ, chartEmptyBehaviorZ } from '../chart-value';
import { visibilityShape } from '../condition';
import { z } from 'zod';
import type { JsonValue } from '../../query';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  mainDataZ,
  textValueZ
} from '../primitives';
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';
import { categoryLabelsZ } from '../presentation';

const chartOptionValueZ: z.ZodType<JsonValue> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(chartOptionValueZ), z.record(z.string(), chartOptionValueZ)])).meta({ id: 'chartOptionValue' });
export const chartOptionZ = z.record(z.string(), chartOptionValueZ).meta({ id: 'chartOption', description: '高级 ECharts 呈现 JSON；数据、结构和交互由引擎管理，不执行代码' });

const seriesShape = { label: textValueZ.optional() };
export const chartSeriesZ = z.union([
  fieldSeriesSourceZ.extend(seriesShape).strict(),
  constantSeriesSourceZ.extend(seriesShape).strict()
]).meta({ id: 'chartSeries' });

export const barSeriesRoleZ = z.enum(['actual', 'forecast']);

/** 柱状图独有的业务系列语义；折线图继续使用未扩展的 chartSeriesZ。 */
const barSeriesShape = {
  ...seriesShape,
  kind: z.enum(['bar', 'line']).optional(),
  axis: z.enum(['primary', 'secondary']).optional(),
  role: barSeriesRoleZ.optional(),
  stackOrder: z.number().int().optional()
};
export const barChartSeriesZ = z.union([
  fieldSeriesSourceZ.extend(barSeriesShape).strict(),
  constantSeriesSourceZ.extend(barSeriesShape).strict()
]).meta({ id: 'barChartSeries' });

export const barChartComponentZ = z
  .object({
    id: componentIdZ,
    ...visibilityShape,
    type: z.literal('barChart'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        emptyBehavior: chartEmptyBehaviorZ.optional(),
        echartsOption: chartOptionZ.optional(),
        variant: z.literal('reportForecast').optional(),
        categoryField: fieldBindingZ,
        series: z.array(barChartSeriesZ).min(1),
        stacked: z.boolean().optional(),
        rounded: z.boolean().optional(),
        showSegmentLabels: z.boolean().optional(),
        showStackTotalLabels: z.boolean().optional(),
        horizontal: z.boolean().optional(),
        dualAxis: z.boolean().optional(),
        categoryLabels: categoryLabelsZ.optional(),
        showValueLabels: z.boolean().optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'barChartComponent' });

componentCatalogRegistry.add(barChartComponentZ, {
  label: '柱状图',
  aliases: ['条形图', '柱图', '柱线混合图'],
  purpose: '比较离散类别之间的大小或展示分类分布',
  chooseWhen: ['区域/渠道/产品对比', '分类分布', '多指标类别比较'],
  dataShape: '一个 dimension 类别字段 + 一个或多个 metric 字段',
  authoringShape: {
    bindsData: true,
    dimensions: { min: 1, max: 1 },
    measures: { min: 1 }
  },
  title: 'optional',
  defaultSpan: 6
});

export const lineChartComponentZ = z
  .object({
    id: componentIdZ,
    ...visibilityShape,
    type: z.literal('lineChart'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        emptyBehavior: chartEmptyBehaviorZ.optional(),
        echartsOption: chartOptionZ.optional(),
        xField: fieldBindingZ,
        series: z.array(chartSeriesZ).min(1),
        smooth: z.boolean().optional(),
        areaGradient: z.boolean().optional(),
        stacked: z.boolean().optional(),
        dualAxis: z.boolean().optional(),
        showPointLabels: z.boolean().optional(),
        categoryLabels: categoryLabelsZ.optional(),
        showValueLabels: z.boolean().optional(),
        hideYAxis: z.boolean().optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'lineChartComponent' });

componentCatalogRegistry.add(lineChartComponentZ, {
  label: '折线图',
  aliases: ['线图', '趋势图'],
  purpose: '展示指标随时间或有序维度的变化趋势',
  chooseWhen: ['趋势、走势、按日/月变化、时间序列'],
  dataShape: '一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段',
  authoringShape: {
    bindsData: true,
    dimensions: { min: 1, max: 1 },
    measures: { min: 1 }
  },
  title: 'optional',
  defaultSpan: 8
});

const piePropsShape = {
  title: textValueZ.optional(),
  emptyBehavior: chartEmptyBehaviorZ.optional(),
  echartsOption: chartOptionZ.optional(),
  variant: z.literal('compactRing').optional(),
  categoryField: fieldBindingZ,
  ring: z.string().regex(/^\d{1,2}%$/).optional(),
  labelLine: z.boolean().optional(),
  actions: actionsZ.optional()
};
export const pieChartComponentZ = z.object({
  id: componentIdZ, ...visibilityShape, type: z.literal('pieChart'),
  layout: componentLayoutZ, data: mainDataZ,
  props: z.union([
    fieldValueSourceZ.extend(piePropsShape).strict(),
    constantValueSourceZ.extend(piePropsShape).strict()
  ])
}).strict().meta({ id: 'pieChartComponent' });

componentCatalogRegistry.add(pieChartComponentZ, {
  label: '饼图',
  aliases: ['圆饼图', '环形图'],
  purpose: '展示少量类别对整体的占比或构成',
  chooseWhen: ['占比、构成、份额，且类别数量较少'],
  dataShape: '一个 dimension 类别字段 + 一个 metric 数值字段',
  authoringShape: {
    bindsData: true,
    dimensions: { min: 1, max: 1 },
    measures: { min: 1, max: 1 }
  },
  title: 'optional',
  defaultSpan: 4
});
