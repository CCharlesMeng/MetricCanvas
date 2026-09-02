import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  fieldNameZ,
  mainDataZ,
  nonEmptyTextValueZ,
  textValueZ,
  valueFormatPresetZ
} from '../primitives';
import { componentCatalogRegistry } from '../registry';

const nestedValueFieldZ = z
  .object({
    field: fieldNameZ,
    format: valueFormatPresetZ.optional()
  })
  .strict();

const nestedDetailsZ = z
  .object({
    field: fieldBindingZ,
    titleField: fieldNameZ,
    valueField: nestedValueFieldZ.optional(),
    descriptionField: fieldNameZ.optional(),
    defaultExpanded: z.boolean().optional()
  })
  .strict();

export const rankingDetailCardComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('rankingDetailCard'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        variant: z.literal('report').optional(),
        metricLabel: nonEmptyTextValueZ.optional(),
        tone: z.enum(['positive', 'negative', 'neutral']).optional(),
        nameField: fieldBindingZ,
        valueField: fieldBindingZ,
        changeField: fieldBindingZ.optional(),
        badgeFields: z.array(fieldBindingZ).max(2).optional(),
        descriptionField: fieldBindingZ.optional(),
        semanticDescriptionField: fieldBindingZ.optional(),
        details: nestedDetailsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'rankingDetailCardComponent' });

componentCatalogRegistry.add(rankingDetailCardComponentZ, {
  label: '详细排行卡',
  purpose: '按查询结果顺序展示对象、指标、变化、徽标与原因说明',
  chooseWhen: ['需要保留查询排序的增长/下降排行', '排行项需要展示标签与原因说明'],
  dataShape: '名称 dimension + 数值 measure，可选变化 measure、最多两个徽标 dimension、普通说明 dimension、语义 HTML 说明 semanticHtml/detail，以及可展开 recordList/detail',
  authoringShape: {
    bindsData: true,
    dimensions: { min: 1, max: 1 },
    measures: { min: 1, max: 1 }
  },
  title: 'optional',
  defaultSpan: 6
});
