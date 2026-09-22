import { navigationTargetZ } from './navigation';
import { z } from 'zod';
import { fieldReferenceZ, idZ } from './primitives';

/**
 * 组件交互动作。两个分支都以 `on: 'click'` 为固定字面量，不构成可判别的
 * discriminant（zod 的 discriminatedUnion 要求分支取值互斥），因此用普通
 * union 表达，JSON Schema 侧从手写的 `oneOf` 变为生成的 `anyOf`——语义等价，
 * 结构互斥（`additionalProperties:false` 决定），仅 ajv 错误对象形状不同。
 */
export const writeFilterActionZ = z
  .object({
    on: z.literal('click'),
    writeFilter: idZ,
    field: fieldReferenceZ
  })
  .strict();

export const navigateActionZ = z
  .object({
    on: z.literal('click'),
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
    openDetail: z
      .object({
        surface: z.enum(['modal', 'drawer']),
        /** 标题取被点行的某个字段；省略时用组件标题。 */
        titleField: fieldReferenceZ.optional(),
        fields: z
          .array(
            z
              .object({ label: z.string().min(1), field: fieldReferenceZ })
              .strict()
          )
          .min(1)
      })
      .strict()
  })
  .strict();

export const componentActionZ = z
  .union([writeFilterActionZ, navigateActionZ, openDetailActionZ])
  .meta({ id: 'componentAction' });

export const actionsZ = z
  .array(componentActionZ)
  .min(1)
  .meta({ id: 'actions' });
