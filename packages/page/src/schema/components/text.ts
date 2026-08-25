import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  idZ,
  nonEmptyTextValueZ,
  textValueZ
} from '../primitives';
import { componentCatalogRegistry } from '../registry';

const textLinkZ = z
  .object({
    label: nonEmptyTextValueZ,
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
        title: textValueZ.optional(),
        body: textValueZ.optional(),
        bodyFormat: z.literal('semanticHtml').optional(),
        variant: z
          .enum(['plain', 'heading', 'insight', 'reportInline', 'riskNotice'])
          .optional(),
        maxWidth: z.int().min(1).optional(),
        links: z.array(textLinkZ).optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'textComponent' });

componentCatalogRegistry.add(textComponentZ, {
  label: '文本',
  purpose: '承载说明、口径提示或由后端返回的人工/AI 已确认分析结论；可显式使用受控语义 HTML 正文',
  chooseWhen: [
    '摘要默认使用 text；说明、提示、后端返回或已确认结论均选择本组件',
    '页面内分隔章节的大标题使用 variant: heading，标题写在 props.title，通常放在 container: plain 的分区里',
    '摘要需要分色富文本时声明 bodyFormat: semanticHtml，并在 body 中只使用受控标签和语义类',
    '分析报告摘要使用 variant: reportInline；它会默认显示图标和“AI 总结：”，metadata 只需声明正文'
  ],
  dataShape: '不绑定页面数据源',
  title: 'optional',
  defaultSpan: 12
});
