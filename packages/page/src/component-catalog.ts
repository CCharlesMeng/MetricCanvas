import { z } from 'zod';
import type { Component } from './page';
import { componentSchemas } from './schema/component';
import { componentCatalogRegistry } from './schema/registry';

export interface ComponentCatalogEntry {
  type: Component['type'];
  label: string;
  /** 用户话语中指代该组件形态的常用叫法;显式点名识别的词汇与 label 同源。 */
  aliases: string[];
  purpose: string;
  chooseWhen: string[];
  dataShape: string;
  requiredProps: string[];
  title: 'required' | 'optional' | 'unsupported';
  defaultSpan: number;
}

/**
 * 领域 DSL 的组件能力目录。它描述“何时选、需要什么数据”，供 Agent 组合页面；
 * 不是运行时组件注册表，也不允许 Agent 越过 Page Schema 发明新组件。
 *
 * 机械字段（type/requiredProps/defaultSpan 中的前两者由此处从 Zod 定义派生；
 * defaultSpan 与 label/purpose/chooseWhen/dataShape/title 是产品/领域决策，
 * 人写在 `./schema/registry.ts` 的 catalog registry 里，与对应组件的 Zod
 * 定义放在同一文件（`./schema/components/*.ts`）维护。
 */
export const componentCatalog: readonly ComponentCatalogEntry[] = componentSchemas.map(
  (componentSchema) => {
    const meta = componentCatalogRegistry.get(componentSchema);
    if (!meta) {
      throw new Error('组件缺少目录元数据：请在对应 schema/components/*.ts 里补 registry.add(...)');
    }
    const shape = componentSchema.shape as { type: z.ZodLiteral<string>; props: z.ZodObject };
    return {
      type: shape.type.value as Component['type'],
      label: meta.label,
      aliases: meta.aliases ?? [],
      purpose: meta.purpose,
      chooseWhen: meta.chooseWhen,
      dataShape: meta.dataShape,
      requiredProps: requiredPropsOf(shape.props),
      title: meta.title,
      defaultSpan: meta.defaultSpan
    };
  }
);

/**
 * 机械推导必填 props 路径：顶层必填字段原样列出；若某个必填字段本身是
 * “数组套对象”（如 metricCard 的 rows、table 的 columns），则展开为
 * `field[].nestedField` 提示 Agent 数组元素内部的必填项。
 */
function requiredPropsOf(propsSchema: z.ZodObject): string[] {
  const required: string[] = [];
  for (const [key, fieldSchema] of Object.entries(propsSchema.shape)) {
    const schema = fieldSchema as z.ZodTypeAny;
    if (schema.isOptional()) continue;
    if (schema instanceof z.ZodArray) {
      const elementShape = objectShapeOf(schema.element as z.ZodTypeAny);
      if (elementShape) {
        const nestedRequired = Object.entries(elementShape)
          .filter(([, nestedSchema]) => !(nestedSchema as z.ZodTypeAny).isOptional())
          .map(([nestedKey]) => `${key}[].${nestedKey}`);
        if (nestedRequired.length > 0) {
          required.push(...nestedRequired);
          continue;
        }
      }
    }
    required.push(key);
  }
  return required;
}

/**
 * 数组元素可能直接是对象（如 metricCard 的 rows），也可能是判别联合
 * （如 table 的 columns，元素是 tableColumnNode = tableColumn | tableColumnGroup）。
 * 后者取第一个对象分支代表"最常见形态"的必填字段——与迁移前手写目录
 * 里 `columns[].field` 的意图一致（表格列默认按字段列理解）。
 */
function objectShapeOf(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | undefined {
  if (schema instanceof z.ZodObject) return schema.shape;
  if (schema instanceof z.ZodUnion) {
    const options = schema.options as z.ZodTypeAny[];
    const firstObject = options.find((option) => option instanceof z.ZodObject);
    return firstObject instanceof z.ZodObject ? firstObject.shape : undefined;
  }
  return undefined;
}

export function componentCatalogEntry(
  type: Component['type']
): ComponentCatalogEntry {
  const entry = componentCatalog.find((candidate) => candidate.type === type);
  if (!entry) throw new Error(`未知组件类型:${type}`);
  return entry;
}
