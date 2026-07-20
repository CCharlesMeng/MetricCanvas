import { Ajv, type ErrorObject } from 'ajv';
import { pageSchema } from './schema';
import type { Page } from './page';
import type { TypedError } from './errors';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateStructure = ajv.compile(pageSchema);

/**
 * 两级校验入口:结构校验(JSON Schema + 布局/唯一性不变式)。
 * 文档进、页面出:输入是不可信的页面文档,通过后才可视为 Page(ADR-0007)。
 * 语义校验(指标/维度存在性,需 CatalogSnapshot)在切片3(#4)落地。
 */
export function validate(document: unknown): TypedError[] {
  if (validateStructure(document)) {
    return invariantErrors(document as unknown as Page);
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

/** JSON Schema 表达不了的页面不变式:12 列网格越界、widget id 唯一 */
function invariantErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const seen = new Set<string>();
  page.widgets.forEach((widget, i) => {
    const { x, w } = widget.position;
    if (x + w > page.layout.columns) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `/widgets/${i}/position`,
        message: `布局越界:x(${x}) + w(${w}) 超出 ${page.layout.columns} 列网格`
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
