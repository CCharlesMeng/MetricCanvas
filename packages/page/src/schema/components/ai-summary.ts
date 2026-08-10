import { z } from 'zod';
import { componentIdZ, componentLayoutZ, fieldNameZ, idZ } from '../primitives';
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
        title: z.string().optional(),
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
  purpose: '基于声明的关联数据流式生成 AI 总结',
  chooseWhen: ['需要将当前页面查询结果动态总结为文本'],
  dataShape: '不声明数据槽；relatedData 显式引用页面数据源字段',
  title: 'optional',
  defaultSpan: 12
});
