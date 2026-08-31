import { z } from 'zod';
import { supportedVersions } from '../version';
import { idZ, nonEmptyTextValueZ, pageParamZ } from './primitives';
import { componentZ } from './component';
import { filterDeclarationZ } from './filter';
import { dataSourceDocumentZ } from './data-source';

export const pageMetaZ = z
  .object({
    /** 页面级展示标题；缺席时由消费方回退到 ReportHeader，再回退到页面 id。 */
    title: nonEmptyTextValueZ.optional(),
    description: z.string().optional()
  })
  .strict();

/**
 * 分区容器：内容分区外观的唯一真源，封闭三档、命名表现中性。
 * 缺省为通用看板外观（白色分区 + 带边框组件单元格）。几何布局
 * 缺省为 12 列等权 Grid；可选受控权重列轨由 ADR-0054 定义。
 */
export const sectionContainerZ = z
  .enum(['plain', 'panel', 'card'])
  .meta({
    id: 'sectionContainer',
    description:
      'plain 无容器组件自带外观；panel 渐变章节面板+居中图标标题+内层白底；card 白色小节卡片+左对齐小标题'
  });

/**
 * 分区列轨权重（ADR-0054）：缺省仍是 12 条等权列；只有外部结构事实无法
 * 用等权列表达时，页面才声明最多 12 条正整数权重轨。权重只表达比例，
 * 不接受 px/CSS 字符串，也不开放 gap、坐标或高度。
 */
export const sectionColumnTracksZ = z
  .array(z.int().min(1).max(1000))
  .min(1)
  .max(12)
  .meta({
    id: 'sectionColumnTracks',
    description: '内容分区的受控列轨权重；缺省为 12 条等权列'
  });

export const sectionZ = z
  .object({
    id: idZ,
    title: nonEmptyTextValueZ.optional(),
    container: sectionContainerZ.optional(),
    columnTracks: sectionColumnTracksZ.optional(),
    components: z.array(componentZ).min(1)
  })
  .strict()
  .meta({ id: 'section' });

/**
 * 页面布局形态：页面外框几何与画布外观的唯一真源，封闭两档。
 * `report` 是缺省，保持定宽居中的报表观感；`dashboard` 占满宿主给出的
 * 全部宽度并使用中性画布，供作战地图这类看板形态使用。12 列网格在两档
 * 下都由统一运行时解释，形态不改变分区内部的几何。
 */
export const pageLayoutFormZ = z
  .enum(['report', 'dashboard'])
  .meta({
    id: 'pageLayoutForm',
    description:
      'report 定宽居中报表外框（缺省）；dashboard 满宽看板外框，中性画布、无外层留白'
  });

/**
 * Dashboard 统一工具栏的页面级显隐声明。缺省 visible 保持存量页面行为；
 * hidden 仅供页面已经显式声明自有页头时使用，避免运行时工具栏与页面组件重复。
 */
export const dashboardToolbarZ = z
  .union([
    z.enum(['visible', 'hidden']),
    z
      .object({
        variant: z.literal('compact'),
        readOnly: z.boolean().optional(),
        note: z.string().min(1).optional()
      })
      .strict()
  ])
  .meta({
    id: 'dashboardToolbar',
    description: 'dashboard 页面统一工具栏显隐或紧凑只读呈现；缺省 visible'
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
    dashboardToolbar: dashboardToolbarZ.optional(),
    params: z.array(pageParamZ).min(1).optional(),
    dataSources: z.record(idZ, dataSourceDocumentZ),
    filters: z.array(filterDeclarationZ).optional(),
    sections: z.array(sectionZ).min(1)
  })
  .strict()
  .meta({ title: '页面' });
