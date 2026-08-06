import { z } from 'zod';
import { componentIdZ, componentLayoutZ, fieldBindingZ, metricDataZ } from '../primitives';
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';

const metricCardChangeZ = z
  .object({
    label: z.string().min(1),
    field: fieldBindingZ,
    unit: z.string().optional(),
    tone: z.enum(['auto', 'neutral', 'positive', 'danger']).optional()
  })
  .strict();

const metricCardRowZ = z
  .object({
    label: z.string().min(1),
    valueField: fieldBindingZ,
    unit: z.string().optional(),
    changes: z.array(metricCardChangeZ).optional()
  })
  .strict();

const metricCardProgressZ = z
  .object({
    valueField: fieldBindingZ,
    label: z.string().optional(),
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
        title: z.string().optional(),
        variant: z.enum(['summary', 'activityProgress']).optional(),
        rows: z.array(metricCardRowZ).min(1),
        progress: metricCardProgressZ.optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'metricCardComponent' });

componentCatalogRegistry.add(metricCardComponentZ, {
  label: '指标卡',
  purpose: '突出一个或少量核心指标的当前值、变化值与可选完成率',
  chooseWhen: ['总额、数量、完成率、KPI、核心指标、年度活动进展'],
  dataShape: '单行或少量行；至少一个 metric 字段，可选变化值和完成率 metric',
  title: 'optional',
  defaultSpan: 3
});
