import { fieldValueSourceZ, constantValueSourceZ, chartEmptyBehaviorZ } from '../chart-value';
import { visibilityShape } from '../condition';
import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  mainDataZ,
  textValueZ
} from '../primitives';
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';

const gaugePropsShape = {
  title: textValueZ.optional(),
  variant: z.literal('mini').optional(),
  emptyBehavior: chartEmptyBehaviorZ.optional(),
  min: z.number().optional(), max: z.number().positive().optional(),
  unit: textValueZ.optional(), label: textValueZ.optional(), actions: actionsZ.optional()
};
export const gaugeComponentZ = z.object({
  id: componentIdZ, ...visibilityShape, type: z.literal('gauge'),
  layout: componentLayoutZ, data: mainDataZ.optional(),
  props: z.union([
    fieldValueSourceZ.extend(gaugePropsShape).strict(),
    constantValueSourceZ.extend(gaugePropsShape).strict()
  ])
}).strict().meta({ id: 'gaugeComponent' });

componentCatalogRegistry.add(gaugeComponentZ, {
  label: '仪表',
  aliases: ['gauge', '仪表盘', '完成率环'],
  purpose: '用环形刻度突出一个比率或完成度类 KPI',
  chooseWhen: ['管道支撑率、完成率、达标率这类单值百分比 KPI'],
  dataShape: '单行记录；一个 measure 数值字段',
  authoringShape: {
    bindsData: true,
    dimensions: { min: 0, max: 0 },
    measures: { min: 1, max: 1 },
    maxRows: 1
  },
  title: 'optional',
  defaultSpan: 2
});
