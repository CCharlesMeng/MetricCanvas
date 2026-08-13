import { z } from 'zod';

/**
 * 组件目录的人写字段（label/purpose/chooseWhen/dataShape/title）与每个组件的
 * Zod 定义放在一起维护，通过独立的 registry 关联——不用 `.meta()`，
 * 避免这些面向 Agent 的说明性字段混入 `z.toJSONSchema` 产出的结构校验 Schema。
 */
export interface ComponentCatalogMeta {
  label: string;
  /**
   * 用户话语中指代该组件形态的常用叫法(如「表格」之于明细表),供显式
   * 点名的确定性识别。必须是明确指代组件形态的名词,不得收录意图词
   * (「对比」「排行」属于意图,归 chooseWhen)。
   */
  aliases?: string[];
  purpose: string;
  chooseWhen: string[];
  dataShape: string;
  /** 该组件在页面中是否必须出现。 */
  title: 'required' | 'optional' | 'unsupported';
  defaultSpan: number;
}

export const componentCatalogRegistry = z.registry<ComponentCatalogMeta>();
