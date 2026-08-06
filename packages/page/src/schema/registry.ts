import { z } from 'zod';

/**
 * 组件目录的人写字段（label/purpose/chooseWhen/dataShape/title）与每个组件的
 * Zod 定义放在一起维护，通过独立的 registry 关联——不用 `.meta()`，
 * 避免这些面向 Agent 的说明性字段混入 `z.toJSONSchema` 产出的结构校验 Schema。
 */
export interface ComponentCatalogMeta {
  label: string;
  purpose: string;
  chooseWhen: string[];
  dataShape: string;
  /** 该组件在页面中是否必须出现。 */
  title: 'required' | 'optional' | 'unsupported';
  defaultSpan: number;
}

export const componentCatalogRegistry = z.registry<ComponentCatalogMeta>();
