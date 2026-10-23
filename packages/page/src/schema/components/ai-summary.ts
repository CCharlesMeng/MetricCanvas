import { visibilityShape } from '../condition';
import { z } from 'zod';
import { componentIdZ, componentLayoutZ, fieldNameZ, idZ, textValueZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';

const nonBlankZ = (minLength: number) => z.string().min(minLength).regex(/\S/);
const aiSummarySourceIdsZ = z.array(idZ.meta({ id: 'aiSummaryDataSourceReference' })).min(1);

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
    ...visibilityShape,
    type: z.literal('aiSummary'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: textValueZ.optional(),
        variant: z.literal('reportInline').optional(),
        mode: z.enum(['provided', 'generated']).describe('旧声明读取兼容；当前由 body 是否非空决定直接展示或生成，无需 mode').optional(),
        body: z.string().describe('非空时直接渲染且不调用 AI；省略、空字符串或纯空白时按提示词和关联范围生成').optional(),
        initial: z.object({
          body: z.string(),
          inputKey: nonBlankZ(1).describe('与生成输入精确匹配的 aiSummaryInputKey(question, contextInfo) 标识')
        }).strict().describe('历史动态首屏缓存声明，仅保留读取兼容；当前用法无需 initial 或 inputKey').optional(),
        promptTemplate: nonBlankZ(1).optional(),
        scope: z.literal('container').describe('显式总结直接拥有当前摘要的内容分区、组合卡或 Tab 页签；与其他范围声明互斥，文字不进入分析输入').optional(),
        relatedDataSources: aiSummarySourceIdsZ.describe('页面数据源 ID 数组，采用其全部非明细结果字段；优先于 relatedSections').optional(),
        relatedDataSource: aiSummarySourceIdsZ.describe('6.52 旧拼写，仅保留读取兼容；新页面使用 relatedDataSources').optional(),
        relatedSections: z.array(idZ).min(1).describe('未显式声明数据源时，收集指定内容分区的可见组件所引用的非明细数据').optional(),
        relatedData: z
          .record(idZ, aiSummaryRelatedDataDefinitionZ)
          .meta({ minProperties: 1 }).describe('旧声明读取兼容；新页面使用 relatedDataSources').optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'aiSummaryComponent' });

componentCatalogRegistry.add(aiSummaryComponentZ, {
  label: 'AI 总结',
  purpose: 'Report 区域分析摘要：展示已有正文，或基于限定范围和时间条件异步生成',
  chooseWhen: [
    'Report 已有非空 body 直接展示；否则根据提示词和区域范围生成，集成应用注入异步 generate',
    '明确声明运行时 SSE 的旧动态摘要继续可读，SSE 由集成应用适配'
  ],
  dataShape: '不声明数据槽；relatedDataSources 显式引用、relatedSections 收集可见分区、或 scope: container 收集直接所属区域；采用非明细字段，文字不参与',
  authoringShape: { bindsData: false },
  title: 'optional',
  defaultSpan: 12
});
