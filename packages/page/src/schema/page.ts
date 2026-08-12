import { z } from 'zod';
import { supportedVersions } from '../version';
import { idZ } from './primitives';
import { componentZ } from './component';
import { filterDeclarationZ } from './filter';
import { dataSourceDocumentZ } from './data-source';

export const pageMetaZ = z
  .object({
    description: z.string().optional()
  })
  .strict();

/**
 * 分区容器：内容分区外观的唯一真源，封闭三档、命名表现中性。
 * 缺省为通用看板外观（白色分区 + 带边框组件单元格）。几何布局
 * 恒为 12 列 Grid，是统一运行时不变量，不进入页面文档。
 */
export const sectionContainerZ = z
  .enum(['plain', 'panel', 'card'])
  .meta({
    id: 'sectionContainer',
    description:
      'plain 无容器组件自带外观；panel 渐变章节面板+居中图标标题+内层白底；card 白色小节卡片+左对齐小标题'
  });

export const sectionZ = z
  .object({
    id: idZ,
    title: z.string().min(1).optional(),
    container: sectionContainerZ.optional(),
    components: z.array(componentZ).min(1)
  })
  .strict()
  .meta({ id: 'section' });

/**
 * 文档态的完整页面根 Schema，唯一职责是喂给 `z.toJSONSchema` 生成
 * `schema.ts` 的 `pageSchema`（ajv 结构校验的单一真源）。它的
 * `dataSources` 允许 query 页面数据源使用按角色分组的局部显式字段
 * （文档态才有的形状，见 `page-document.ts`），因此不能作为 `Page`
 * 领域类型的推导来源——领域类型继续见 `../page.ts`。
 */
export const pageDocumentSchemaZ = z
  .object({
    schemaVersion: z
      .enum(supportedVersions() as [string, ...string[]])
      .meta({
        description: `页面文档契约版本；当前支持 ${supportedVersions().join(' / ')}`
      }),
    id: idZ,
    meta: pageMetaZ.optional(),
    dataSources: z.record(idZ, dataSourceDocumentZ),
    filters: z.array(filterDeclarationZ).optional(),
    sections: z.array(sectionZ).min(1)
  })
  .strict()
  .meta({ title: '看板页面' });
