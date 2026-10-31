import { Ajv, type AnySchemaObject, type ErrorObject, type ValidateFunction } from 'ajv';
import { pageSchema } from './schema';

const definitions = (pageSchema as unknown as { definitions: Record<string, AnySchemaObject> }).definitions;
const validators = sourceValidators();

function resolve(schema: AnySchemaObject): AnySchemaObject {
  return typeof schema.$ref === 'string' ? definitions[schema.$ref.slice('#/definitions/'.length)] : schema;
}

/** Diagnostic branches come from the same Schema as acceptance; no second protocol table. */
function sourceValidators(): Map<string, ValidateFunction> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const result = new Map<string, ValidateFunction>();
  for (const branch of definitions.dataSource.anyOf as AnySchemaObject[]) {
    const schema = resolve(branch);
    const source = resolve(schema.properties.source);
    result.set(source.properties.type.const, ajv.compile({ ...schema, definitions }));
  }
  return result;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function escapePointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointerValue(value: unknown, path: string): unknown {
  for (const part of path.split('/').slice(1)) {
    value = object(value)?.[part.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  return value;
}

function singleAlternative(error: ErrorObject): boolean {
  if (error.keyword !== 'oneOf' && error.keyword !== 'anyOf') return false;
  // AJV reports a referenced schema's local path (#/oneOf), without its definition name.
  const schema = error.instancePath === '/source/query' && error.schemaPath === '#/oneOf'
    ? definitions.pageQuery.oneOf : pointerValue(pageSchema, error.schemaPath.slice(1));
  return Array.isArray(schema) && schema.length === 1;
}

function scopedError(error: ErrorObject, value: unknown, path: string): ErrorObject {
  const actual = pointerValue(value, error.instancePath);
  return {
    ...error, instancePath: `${path}${error.instancePath}`,
    params: { ...error.params, actualCount: Array.isArray(actual) ? actual.length : undefined }
  };
}

function sourceErrors(value: unknown, path: string): ErrorObject[] | undefined {
  const type = object(object(value)?.source)?.type;
  if (typeof type !== 'string') return undefined;
  const validate = validators.get(type);
  if (!validate) return [{
    keyword: 'enum', instancePath: `${path}/source/type`, schemaPath: '#/definitions/dataSource',
    params: { allowedValues: [...validators.keys()] }
  }];
  validate(value);
  return (validate.errors ?? []).filter(error => !singleAlternative(error))
    .map(error => scopedError(error, value, path));
}

/** Replace only a known source's union noise, retaining all independent structural failures. */
export function dataSourceStructureErrors(document: unknown, errors: ErrorObject[]): ErrorObject[] {
  const sources = object(object(document)?.dataSources);
  if (!sources) return errors;
  const replacements = new Map<string, ErrorObject[]>();
  for (const [id, source] of Object.entries(sources)) {
    const path = `/dataSources/${escapePointer(id)}`;
    const selected = sourceErrors(source, path);
    if (selected) replacements.set(path, selected);
  }
  const result: ErrorObject[] = [];
  const emitted = new Set<string>();
  for (const error of errors) {
    const path = error.instancePath.match(/^\/dataSources\/[^/]+/)?.[0] ?? '';
    const selected = replacements.get(path);
    if (!selected) { result.push(error); continue; }
    if (emitted.has(path)) continue;
    result.push(...selected);
    emitted.add(path);
  }
  return result;
}
