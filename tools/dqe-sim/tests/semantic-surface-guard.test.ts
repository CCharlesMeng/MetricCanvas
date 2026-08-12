/**
 * 同面守卫:docs/examples/schema-metadata.example.json 中两个业务域声明的
 * 指标、维度、取值域与时间粒度必须与组合式语义面的支持集合完全一致。
 * 比对基准由语义面唯一真源(semantic-surface.ts)经同面投影推导,
 * 本测试不手抄第二份指标/维度清单。
 */
import { describe, expect, it } from 'vitest';
import schemaMetadataExample from '../../../docs/examples/schema-metadata.example.json';
import { executeDqeItem } from '../src/execute';
import { semanticSurface } from '../src/semantic-surface';
import {
  projectDomainFields,
  type MetadataField
} from '../src/semantic-surface-metadata';

interface ExampleSchema {
  id: string;
  name: string;
  objects: Array<{ id: string; fields: MetadataField[] }>;
  verifiedQueries: Array<{
    id: string;
    body: { dsl_list: unknown[] };
    resultFields: Array<{ name: string }>;
  }>;
}

const exampleSchemas = (
  schemaMetadataExample.executionEnvironments as unknown as Array<{
    schemas: ExampleSchema[];
  }>
).flatMap((environment) => environment.schemas);

describe('数据上下文同面守卫', () => {
  it.each(semanticSurface.map((domain) => [domain.name, domain] as const))(
    '业务域「%s」在 Schema 元数据示例中恰好声明一次',
    (_name, domain) => {
      const matches = exampleSchemas.filter((schema) => schema.id === domain.id);
      expect(
        matches,
        `schema-metadata.example.json 应恰好声明一个 id 为 ${domain.id} 的 schema`
      ).toHaveLength(1);
      expect(matches[0]!.name).toBe(domain.name);
      expect(matches[0]!.objects).toHaveLength(1);
    }
  );

  it.each(semanticSurface.map((domain) => [domain.name, domain] as const))(
    '业务域「%s」的字段、取值域与时间粒度与语义面完全一致',
    (_name, domain) => {
      const schema = exampleSchemas.find((candidate) => candidate.id === domain.id)!;
      const actualFields = schema.objects[0]!.fields;
      const expectedFields = projectDomainFields(domain);

      const differences = diffFields(actualFields, expectedFields);
      expect(
        differences,
        `业务域「${domain.name}」的 Schema 元数据与语义面不同步:${differences.join(';')}`
      ).toEqual([]);
      expect(actualFields).toEqual(expectedFields);
    }
  );

  it('语义面指标名与维度名不与示例中其他 schema 的字段声明冲突', () => {
    const surfaceSchemaIds = new Set(semanticSurface.map((domain) => domain.id));
    const otherFieldNames = new Set(
      exampleSchemas
        .filter((schema) => !surfaceSchemaIds.has(schema.id))
        .flatMap((schema) => schema.objects.flatMap((object) => object.fields))
        .map((field) => field.name)
    );
    const surfaceNames = semanticSurface.flatMap((domain) => [
      ...domain.metrics.map((metric) => metric.name),
      ...domain.dimensions.map((dimension) => dimension.name)
    ]);

    // 「客户级别」在客户活动 schema 中已有精确匹配场景的声明,语义面沿用
    // 同名维度但取值域不同,这是刻意保留的近义场景;其余名称不得撞名。
    const collisions = surfaceNames.filter(
      (name) => name !== '客户级别' && otherFieldNames.has(name)
    );
    expect(collisions).toEqual([]);
  });

  it.each(
    semanticSurface.flatMap((domain) => {
      const schema = exampleSchemas.find((candidate) => candidate.id === domain.id);
      return (schema?.verifiedQueries ?? []).map(
        (query) => [domain.name, query.id, query] as const
      );
    })
  )(
    '业务域「%s」的已验证查询 %s 可经语义面真实执行',
    (_domainName, _queryId, query) => {
      expect(query.body.dsl_list).toHaveLength(1);
      const result = executeDqeItem(query.body.dsl_list[0]);

      expect(result.code).toBe('SUCCESS');
      expect(result.data.length).toBeGreaterThan(0);
      for (const field of query.resultFields) {
        expect(result.data[0]).toHaveProperty(field.name);
        expect(
          result.dqe.columns.map((column) => column.caption)
        ).toContain(field.name);
      }
    }
  );
});

function diffFields(
  actual: MetadataField[],
  expected: MetadataField[]
): string[] {
  const actualByName = new Map(actual.map((field) => [field.name, field]));
  const expectedByName = new Map(expected.map((field) => [field.name, field]));
  const differences: string[] = [];
  for (const name of expectedByName.keys()) {
    if (!actualByName.has(name)) differences.push(`示例缺少字段「${name}」`);
  }
  for (const name of actualByName.keys()) {
    if (!expectedByName.has(name)) differences.push(`示例多出字段「${name}」`);
  }
  for (const [name, expectedField] of expectedByName) {
    const actualField = actualByName.get(name);
    if (!actualField) continue;
    if (stableStringify(actualField) !== stableStringify(expectedField)) {
      differences.push(
        `字段「${name}」声明不一致(期望 ${JSON.stringify(expectedField)},实际 ${JSON.stringify(actualField)})`
      );
    }
  }
  return differences;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
