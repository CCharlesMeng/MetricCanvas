import { interactionShape } from './condition';
import { navigationTargetZ, navigationBindingZ } from './navigation';
import { z } from 'zod';
import { fieldNameZ, fieldReferenceZ, idZ, valueFormatPresetZ } from './primitives';

const detailTitleZ = z.union([z.string().min(1), z.object({
  parts: z.array(z.union([z.string(), z.object({
    field: fieldNameZ,
    format: valueFormatPresetZ.optional()
  }).strict()])).min(1).max(64).meta({description:'按声明顺序连接的1—64个固定文字或当前行字段片段，不自动添加分隔符'})
}).strict()]).meta({ id: 'detailTitle', description: '按顺序拼接固定文字与当前行字段，不执行表达式' });

const detailTitleShape = {
  title: detailTitleZ.optional(),
  titleField: fieldReferenceZ.optional()
};

/**
 * 组件交互动作。两个分支都以 `on: 'click'` 为固定字面量，不构成可判别的
 * discriminant（zod 的 discriminatedUnion 要求分支取值互斥），因此用普通
 * union 表达，JSON Schema 侧从手写的 `oneOf` 变为生成的 `anyOf`——语义等价，
 * 结构互斥（`additionalProperties:false` 决定），仅 ajv 错误对象形状不同。
 */
export const writeFilterActionZ = z.union([
  z.object({ on: z.literal('click'), ...interactionShape, writeFilter: idZ, field: fieldReferenceZ, level: idZ.optional() }).strict(),
  z.object({ on: z.literal('click'), ...interactionShape, writeFilter: idZ, value: z.string(), level: idZ.optional() }).strict()
]);

export const navigateActionZ = z
  .object({
    on: z.literal('click'),
    ...interactionShape,
    navigate: navigationTargetZ
  })
  .strict();

/**
 * 页内详情动作(ADR-0087):点击在页内打开一层浮层，展示被点那一行的若干
 * 字段，不离开当前页。`fields` 必须非空——空的详情浮层是个什么都不说的
 * 弹窗，比没有更糟。
 */
export const openDetailActionZ = z
  .object({
    on: z.literal('click'),
    ...interactionShape,
    openDetail: z.union([z.object({
        surface: z.enum(['modal', 'drawer']),
        ...interactionShape,
        /** 标题取被点行的某个字段；省略时用组件标题。 */
        ...detailTitleShape,
        fields: z
          .array(
            z
              .object({ label: z.string().min(1), field: fieldReferenceZ })
              .strict()
          )
          .min(1)
      })
      .strict(), z.object({
        surface: z.enum(['modal', 'drawer']),
        ...interactionShape,
        ...detailTitleShape,
        view: idZ,
        bindings: z.record(idZ, navigationBindingZ).optional()
      }).strict()])
  })
  .strict();

export const componentActionZ = z
  .union([writeFilterActionZ, navigateActionZ, openDetailActionZ])
  .meta({ id: 'componentAction' });

export const actionsZ = z
  .array(componentActionZ)
  .min(1)
  .meta({ id: 'actions' });
