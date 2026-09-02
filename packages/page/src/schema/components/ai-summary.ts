import { z } from 'zod';
import { componentIdZ, componentLayoutZ, fieldNameZ, idZ, textValueZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';

const nonBlankZ = (minLength: number) => z.string().min(minLength).regex(/\S/);

const aiSummaryRelatedFieldZ = z
  .object({
    field: fieldNameZ,
    term: nonBlankZ(1)
  })
  .strict()
  .meta({ id: 'aiSummaryRelatedField' });

const aiSummaryRelatedDataDefinitionZ = z
  .object({
    source: idZ,
    description: nonBlankZ(1),
    fields: z.array(aiSummaryRelatedFieldZ).min(1)
  })
  .strict()
  .meta({ id: 'aiSummaryRelatedDataDefinition' });

export const aiSummaryComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('aiSummary'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: textValueZ.optional(),
        variant: z.literal('reportInline').optional(),
        promptTemplate: nonBlankZ(1),
        relatedData: z
          .record(idZ, aiSummaryRelatedDataDefinitionZ)
          .meta({ minProperties: 1 })
      })
      .strict()
  })
  .strict()
  .meta({ id: 'aiSummaryComponent' });

componentCatalogRegistry.add(aiSummaryComponentZ, {
  label: 'AI 总结',
  purpose: '仅在需求明确声明时，基于关联数据通过 SSE 流式生成 AI 总结',
  chooseWhen: [
    '需求明确声明运行时 SSE 动态生成；仅有摘要标题、数据或 AI 文案不得推断为 aiSummary'
  ],
  dataShape: '不声明数据槽；relatedData 显式引用页面数据源字段',
  authoringShape: { bindsData: false },
  title: 'optional',
  defaultSpan: 12
});
