import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  mainDataZ,
  textValueZ
} from '../primitives';
import { componentCatalogRegistry } from '../registry';

export const fieldTextComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('fieldText'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        field: fieldBindingZ,
        variant: z.enum(['plain', 'quote']).optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'fieldTextComponent' });

componentCatalogRegistry.add(fieldTextComponentZ, {
  label: '字段长文本',
  purpose: '把数据源里的一段长文本按段落呈现，标题写在组件上',
  chooseWhen: [
    '项目背景、项目风险、会议结论这类整段来自数据字段的文本',
    '正文是页面文档里写死的静态说明时改用 text 组件'
  ],
  dataShape: '单行记录；绑定一个 string 字段，或一个 semanticHtml/detail 字段',
  title: 'optional',
  defaultSpan: 12
});
