import { z } from 'zod';
import { componentIdZ, componentLayoutZ, fieldBindingZ, mainDataZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';

export const rankingDetailCardComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('rankingDetailCard'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: z.string().optional(),
        variant: z.literal('report').optional(),
        metricLabel: z.string().min(1).optional(),
        tone: z.enum(['positive', 'negative', 'neutral']).optional(),
        nameField: fieldBindingZ,
        valueField: fieldBindingZ,
        changeField: fieldBindingZ.optional(),
        badgeFields: z.array(fieldBindingZ).max(2).optional(),
        descriptionField: fieldBindingZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'rankingDetailCardComponent' });

componentCatalogRegistry.add(rankingDetailCardComponentZ, {
  label: '详细排行卡',
  purpose: '按查询结果顺序展示对象、指标、变化、徽标与原因说明',
  chooseWhen: ['需要保留查询排序的增长/下降排行', '排行项需要展示标签与原因说明'],
  dataShape: '名称 dimension + 数值 measure，可选变化 measure、最多两个徽标 dimension 与说明 dimension',
  title: 'optional',
  defaultSpan: 6
});
