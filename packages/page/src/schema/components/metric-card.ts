import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  metricDataZ,
  nonEmptyTextValueZ,
  textValueZ
} from '../primitives';
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';

const metricCardChangeZ = z
  .object({
    label: nonEmptyTextValueZ,
    field: fieldBindingZ,
    unit: textValueZ.optional(),
    tone: z.enum(['auto', 'neutral', 'positive', 'danger']).optional()
  })
  .strict();

const metricCardRowZ = z
  .object({
    label: nonEmptyTextValueZ,
    /** 与主值同排的短上下文，例如统计窗口“近60天”。 */
    context: textValueZ.optional(),
    valueField: fieldBindingZ,
    /** 显式将该行的非空主值声明为组件 actions 的触发入口。 */
    link: z.boolean().optional(),
    unit: textValueZ.optional(),
    changes: z.array(metricCardChangeZ).optional()
  })
  .strict();

const metricCardProgressZ = z
  .object({
    valueField: fieldBindingZ,
    label: textValueZ.optional(),
    ringPercent: z.number().min(0).max(100).optional()
  })
  .strict();

export const metricCardComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('metricCard'),
    layout: componentLayoutZ,
    data: metricDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        variant: z
          .enum([
            'summary',
            'activityProgress',
            'compactSummary',
            'dualSummary',
            'compactStrip',
            'compactStack'
          ])
          .optional(),
        secondaryTitle: nonEmptyTextValueZ.optional(),
        rows: z.array(metricCardRowZ).min(1),
        secondaryRows: z.array(metricCardRowZ).min(1).optional(),
        panelLayout: z.enum(['stacked', 'twoColumn']).optional(),
        showTrendArrows: z.boolean().optional(),
        progress: metricCardProgressZ.optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'metricCardComponent' });

componentCatalogRegistry.add(metricCardComponentZ, {
  label: '指标卡',
  aliases: ['KPI卡', '数字卡'],
  purpose: '突出一个或少量核心指标的当前值、变化值与可选完成率',
  chooseWhen: ['总额、数量、完成率、KPI、核心指标、年度活动进展'],
  dataShape: '单行或少量行；至少一个 metric 字段，可选变化值和完成率 metric',
  authoringShape: {
    bindsData: true,
    dimensions: { min: 0, max: 0 },
    measures: { min: 1 },
    maxRows: 3
  },
  title: 'optional',
  defaultSpan: 3
});
