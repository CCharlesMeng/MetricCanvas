export * from './types.js';
export { pageSpecSchema } from './schema.js';

import { Ajv, type ErrorObject } from 'ajv';
import { pageSpecSchema } from './schema.js';
import type { PageSpec, TypedError } from './types.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateStructure = ajv.compile(pageSpecSchema);

/**
 * 两级校验入口:结构校验(JSON Schema + 布局/唯一性规则)。
 * 语义校验(指标/维度存在性,需 CatalogSnapshot)在切片3 落地。
 */
export function validate(spec: unknown): TypedError[] {
  if (validateStructure(spec)) {
    return layoutAndIdentityErrors(spec as unknown as PageSpec);
  }
  return (validateStructure.errors ?? []).map(toTypedError);
}

function toTypedError(err: ErrorObject): TypedError {
  if (err.keyword === 'required') {
    const missing = (err.params as { missingProperty: string }).missingProperty;
    // Ajv 将缺失字段定位到父节点,拼上字段名使定位可直接使用
    return {
      type: 'SCHEMA_ERROR',
      path: `${err.instancePath}/${missing}`,
      message: `缺少必填字段 ${missing}`
    };
  }
  return { type: 'SCHEMA_ERROR', path: err.instancePath || '/', message: describe(err) };
}

function describe(err: ErrorObject): string {
  if (err.keyword === 'additionalProperties') {
    return `存在未定义字段 ${(err.params as { additionalProperty: string }).additionalProperty}(拼写错误?)`;
  }
  if (err.keyword === 'enum') {
    return `取值不在允许范围:${JSON.stringify((err.params as { allowedValues: unknown[] }).allowedValues)}`;
  }
  return err.message ?? '结构不合法';
}

/** JSON Schema 表达不了的结构规则:12 列网格越界、widget id 唯一 */
function layoutAndIdentityErrors(spec: PageSpec): TypedError[] {
  const errors: TypedError[] = [];
  const seen = new Set<string>();
  spec.widgets.forEach((widget, i) => {
    const { x, w } = widget.position;
    if (x + w > spec.layout.columns) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/position`,
        message: `布局越界:x(${x}) + w(${w}) 超出 ${spec.layout.columns} 列网格`
      });
    }
    if (seen.has(widget.id)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/id`,
        message: `widget id 重复:${widget.id}`
      });
    }
    seen.add(widget.id);
  });
  return errors;
}
