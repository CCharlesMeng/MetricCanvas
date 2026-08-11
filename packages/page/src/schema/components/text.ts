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
        variant: z.enum(['plain', 'insight', 'riskNotice']).optional(),
        maxWidth: z.int().min(1).optional(),
        links: z.array(textLinkZ).optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'textComponent' });

componentCatalogRegistry.add(textComponentZ, {
  label: '文本',
  purpose: '承载说明、口径提示或由后端返回的人工/AI 已确认分析结论',
  chooseWhen: [
    '摘要默认使用 text；说明、提示、后端返回或已确认结论均选择本组件'
  ],
  dataShape: '不绑定页面数据源',
  title: 'optional',
  defaultSpan: 12
});
