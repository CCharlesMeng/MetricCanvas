import { z } from 'zod';
import { componentIdZ, componentLayoutZ, idZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';

const textLinkZ = z
  .object({
    label: z.string().min(1),
    page: idZ,
    carryFilters: z.array(idZ).meta({ uniqueItems: true }).optional()
  })
  .strict();

export const textComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('text'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: z.string().optional(),
        body: z.string().optional(),
        variant: z.enum(['plain', 'insight']).optional(),
        links: z.array(textLinkZ).optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'textComponent' });

componentCatalogRegistry.add(textComponentZ, {
  label: '文本',
  purpose: '承载说明、口径提示或人工/AI 已确认的分析结论',
  chooseWhen: ['说明、提示、已确认结论；不能代替数据图表'],
  dataShape: '不绑定页面数据源',
  title: 'optional',
  defaultSpan: 12
});
