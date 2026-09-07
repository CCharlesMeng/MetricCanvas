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

export const componentActionZ = z
  .union([writeFilterActionZ, navigateActionZ])
  .meta({ id: 'componentAction' });

export const actionsZ = z
  .array(componentActionZ)
  .min(1)
  .meta({ id: 'actions' });
