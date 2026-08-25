import { z } from 'zod';
import { supportedVersions } from '../version';
import { idZ, nonEmptyTextValueZ, pageParamZ } from './primitives';
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
    title: nonEmptyTextValueZ.optional(),
    container: sectionContainerZ.optional(),
    components: z.array(componentZ).min(1)
  })
  .strict()
  .meta({ id: 'section' });

/**
 * 页面布局形态：页面外框几何与画布外观的唯一真源，封闭两档。
 * `report` 是缺省，保持定宽居中的报表观感；`dashboard` 占满宿主给出的
 * 全部宽度并使用中性画布，供作战地图这类看板形态使用。12 列网格在两档
 * 下都是统一运行时不变量，形态不改变分区内部的几何。
 */
export const pageLayoutFormZ = z
  .enum(['report', 'dashboard'])
  .meta({
    id: 'pageLayoutForm',
    description:
      'report 定宽居中报表外框（缺省）；dashboard 满宽看板外框，中性画布、无外层留白'
  });

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
    layoutForm: pageLayoutFormZ.optional(),
    params: z.array(pageParamZ).min(1).optional(),
    dataSources: z.record(idZ, dataSourceDocumentZ),
    filters: z.array(filterDeclarationZ).optional(),
    sections: z.array(sectionZ).min(1)
  })
  .strict()
  .meta({ title: '页面' });
