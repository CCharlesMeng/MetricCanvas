import { z } from 'zod';
import type { FieldType, JsonObject, JsonValue } from '@metriccanvas/page';

/**
 * 数据上下文快照契约(Schema 元数据 1.0)。
 *
 * 对外契约的三件事都在本模块完成,不得在消费方再写一份:
 * - 形状声明:下方 interface,与 docs/schema-metadata.schema.json 逐层对应
 *   (等价由 tests/data-context-contract.test.ts 的 ajv 守护测试保证);
 * - 结构校验:parseDataContextSnapshot,消费方不得以双重 cast 绕过;
 * - 语义面投影:semanticSurfaceOf,把快照投影为按业务域组织的检索面,
 *   受控句式(取值域)只在这里解析一次;敏感字段在投影与检索侧统一标注,
 *   其取值域语义不外泄(#80)。
 */

export interface DataContextSnapshot {
  formatVersion: '1.0';
  id: string;
  version: string;
  generatedAt: string;
  source: string;
  executionEnvironments: ExecutionEnvironment[];
}

export interface ExecutionEnvironment {
  id: string;
  name: string;
  language: 'dqe';
  endpointRef: string;
  description?: string;
  schemas: DataSchema[];
  constraints: {
    readOnly: true;
    maxRows: number;
    maxColumns: number;
    maxQueriesPerBatch: number;
    timeoutMs: number;
  };
  security: {
    scope: string;
    notes?: string[];
  };
}

export interface DataSchema {
  id: string;
  name: string;
  description: string;
  objects: DataObject[];
  relationships: DataRelationship[];
  verifiedQueries: VerifiedQuery[];
}

export interface DataObject {
  id: string;
  name: string;
  kind: 'dataset';
  description: string;
  fields: DataField[];
}

/** 字段角色提示;与 JSON Schema 的 roleHints 枚举一致('detail' 不属于快照契约)。 */
export type DataFieldRoleHint = 'dimension' | 'measure' | 'time';

export interface DataField {
  name: string;
  type: FieldType;
  description: string;
  aliases?: string[];
  roleHints: DataFieldRoleHint[];
  unit?: string;
  granularity?: string;
  nullable: boolean;
  sensitive: boolean;
}

export interface DataRelationship {
  id: string;
  from: { object: string; field: string };
  to: { object: string; field: string };
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-one';
  description: string;
}

export interface VerifiedQuery {
  id: string;
  question: string;
  description: string;
  language: 'dqe';
  body: { dsl_list: [JsonObject] };
  resultFields: Array<{
    name: string;
    type: FieldType;
    /** 与 JSON Schema 的 role 枚举一致:快照结果字段只有维度与度量。 */
    role: 'dimension' | 'measure';
    unit?: string;
    nullable: boolean;
  }>;
}

export interface DataContextProvider {
  current(): Promise<DataContextSnapshot>;
}

/* ---------- 结构校验:快照的唯一解析入口 ---------- */

const nonEmptyStringZ = z.string().min(1);
const fieldTypeZ = z.enum(['string', 'number', 'boolean', 'date', 'datetime']);

function uniqueItems(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

const dataFieldZ = z
  .strictObject({
    name: nonEmptyStringZ,
    type: fieldTypeZ,
    description: nonEmptyStringZ,
    aliases: z
      .array(nonEmptyStringZ)
      .refine(uniqueItems, { message: '别名不得重复' })
      .optional(),
    roleHints: z
      .array(z.enum(['dimension', 'measure', 'time']))
      .min(1)
      .refine(uniqueItems, { message: '角色提示不得重复' }),
    unit: nonEmptyStringZ.optional(),
    granularity: nonEmptyStringZ.optional(),
    nullable: z.boolean(),
    sensitive: z.boolean()
  });

const relationshipEndZ = z.strictObject({
  object: nonEmptyStringZ,
  field: nonEmptyStringZ
});

const relationshipZ = z.strictObject({
  id: nonEmptyStringZ,
  from: relationshipEndZ,
  to: relationshipEndZ,
  cardinality: z.enum(['one-to-one', 'one-to-many', 'many-to-one']),
  description: nonEmptyStringZ
});

const resultFieldZ = z.strictObject({
  name: nonEmptyStringZ,
  type: fieldTypeZ,
  role: z.enum(['dimension', 'measure']),
  unit: nonEmptyStringZ.optional(),
  nullable: z.boolean()
});

const jsonValueZ: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueZ),
    z.record(z.string(), jsonValueZ)
  ])
);
const jsonObjectZ: z.ZodType<JsonObject> = z.record(z.string(), jsonValueZ);

const verifiedQueryZ = z.strictObject({
  id: nonEmptyStringZ,
  question: nonEmptyStringZ,
  description: nonEmptyStringZ,
  language: z.literal('dqe'),
  body: z.strictObject({
    dsl_list: z.tuple([jsonObjectZ])
  }),
  resultFields: z.array(resultFieldZ)
});

const dataObjectZ = z.strictObject({
  id: nonEmptyStringZ,
  name: nonEmptyStringZ,
  kind: z.literal('dataset'),
  description: nonEmptyStringZ,
  fields: z.array(dataFieldZ)
});

const dataSchemaZ = z.strictObject({
  id: nonEmptyStringZ,
  name: nonEmptyStringZ,
  description: nonEmptyStringZ,
  objects: z.array(dataObjectZ),
  relationships: z.array(relationshipZ),
  verifiedQueries: z.array(verifiedQueryZ)
});

const executionEnvironmentZ = z.strictObject({
  id: nonEmptyStringZ,
  name: nonEmptyStringZ,
  language: z.literal('dqe'),
  endpointRef: nonEmptyStringZ,
  description: nonEmptyStringZ.optional(),
  schemas: z.array(dataSchemaZ),
  constraints: z.strictObject({
    readOnly: z.literal(true),
    maxRows: z.int().min(1),
    maxColumns: z.int().min(1),
    maxQueriesPerBatch: z.int().min(1),
    timeoutMs: z.int().min(1)
  }),
  security: z.strictObject({
    scope: nonEmptyStringZ,
    notes: z.array(nonEmptyStringZ).optional()
  })
});

const dataContextSnapshotZ = z.strictObject({
  formatVersion: z.literal('1.0'),
  id: nonEmptyStringZ,
  version: nonEmptyStringZ,
  generatedAt: z.iso.datetime({ offset: true }),
  source: nonEmptyStringZ,
  executionEnvironments: z.array(executionEnvironmentZ)
});

export interface DataContextSnapshotParseError {
  /** JSON Pointer 风格路径,如 /executionEnvironments/0/schemas/1/objects/0/fields/2/name。 */
  path: string;
  message: string;
}

export type DataContextSnapshotParseResult =
  | { ok: true; snapshot: DataContextSnapshot }
  | { ok: false; errors: DataContextSnapshotParseError[] };

/**
 * 数据上下文快照的唯一结构校验入口(#80):形状与
 * docs/schema-metadata.schema.json 等价(守护测试保证),失败给出路径级
 * 错误。消费方一律经由这里进入类型世界,不得 `as unknown as` 硬闯。
 */
export function parseDataContextSnapshot(
  value: unknown
): DataContextSnapshotParseResult {
  const result = dataContextSnapshotZ.safeParse(value);
  if (result.success) {
    // 编译期双向守护:zod 推导形状与导出 interface 互相可赋值,
    // 任何一侧单独改动都会在这里报编译错误。
    const snapshot: DataContextSnapshot = result.data;
    return { ok: true, snapshot };
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: `/${issue.path.map(String).join('/')}`,
      message: issue.message
    }))
  };
}

// 编译期反向守护:interface 声明的值必须能通过 zod 推导形状的赋值检查。
type ZodSnapshotShape = z.infer<typeof dataContextSnapshotZ>;
const _interfaceAssignableToZodShape = (
  snapshot: DataContextSnapshot
): ZodSnapshotShape => snapshot;
void _interfaceAssignableToZodShape;

/* ---------- 语义面投影:业务域检索面与受控句式的唯一解析 ---------- */

/**
 * Schema 元数据 1.0 的字段结构封闭,维度取值域以受控句式
 * 「取值域:值1、值2。」写在字段 description(与 DQE 仿真语义面的
 * 同面投影一致)。这是该句式的唯一解析声明,不得另写第二份 pattern。
 */
const VALUE_DOMAIN_PATTERN = /取值域[:：]([^。]+)/u;

export function parseValueDomain(description: string): string[] | undefined {
  const match = VALUE_DOMAIN_PATTERN.exec(description);
  if (!match) return undefined;
  const values = match[1]!
    .split('、')
    .map((value) => value.trim())
    .filter((value) => value !== '');
  return values.length > 0 ? values : undefined;
}

/** 敏感字段标注(#80):字段可被发现,但取值域语义不外泄。 */
function redactSensitiveField(field: DataField): DataField {
  if (!field.sensitive) return field;
  return {
    ...field,
    description: field.description.replace(VALUE_DOMAIN_PATTERN, '取值域:(敏感,已隐去)')
  };
}

/** 业务域摘要:域路由阶段注入模型的全部内容(上下文裁剪,ADR-0037)。 */
export interface BusinessDomainSummary {
  /** 业务域名,即快照中 schema 的 name。 */
  name: string;
  description: string;
}

export interface SemanticSurfaceMetric {
  name: string;
  aliases: string[];
  /** 口径说明(含可加性与时间聚合方式的受控句式原文)。 */
  description: string;
  type: FieldType;
  unit?: string;
  nullable: boolean;
  sensitive: boolean;
}

export interface SemanticSurfaceDimension {
  name: string;
  aliases: string[];
  description: string;
  type: FieldType;
  /** 受控句式解析出的封闭取值域;未声明或敏感字段不投影取值。 */
  values?: string[];
  nullable: boolean;
  sensitive: boolean;
}

export interface SemanticSurfaceTimeDimension {
  name: string;
  aliases: string[];
  description: string;
  type: FieldType;
  /** 该时间维度支持的粒度(granularity 逗号分隔声明)。 */
  granularities: string[];
}

/** 一个业务域的语义面投影:路由命中后注入模型的检索面形状。 */
export interface DomainSemanticSurface {
  businessDomain: string;
  description: string;
  metrics: SemanticSurfaceMetric[];
  dimensions: SemanticSurfaceDimension[];
  timeDimensions: SemanticSurfaceTimeDimension[];
}

/**
 * 把快照投影为按业务域(schema)组织的语义面。V0 两域可全量注入,
 * 形状为多域预留:消费方按命中域取子集,不必一次持有全部投影。
 * 敏感字段保留条目但标注并隐去取值域语义(#80 裁决:标注而非过滤)。
 */
export function semanticSurfaceOf(
  snapshot: DataContextSnapshot
): DomainSemanticSurface[] {
  return snapshot.executionEnvironments.flatMap((environment) =>
    environment.schemas.map((schema) => {
      const surface: DomainSemanticSurface = {
        businessDomain: schema.name,
        description: schema.description,
        metrics: [],
        dimensions: [],
        timeDimensions: []
      };
      for (const object of schema.objects) {
        for (const rawField of object.fields) {
          const field = redactSensitiveField(rawField);
          if (field.roleHints.includes('measure')) {
            surface.metrics.push({
              name: field.name,
              aliases: field.aliases ?? [],
              description: field.description,
              type: field.type,
              ...(field.unit === undefined ? {} : { unit: field.unit }),
              nullable: field.nullable,
              sensitive: field.sensitive
            });
          }
          if (field.roleHints.includes('time')) {
            surface.timeDimensions.push({
              name: field.name,
              aliases: field.aliases ?? [],
              description: field.description,
              type: field.type,
              granularities: (field.granularity ?? '')
                .split(',')
                .map((granularity) => granularity.trim())
                .filter((granularity) => granularity !== '')
            });
          } else if (field.roleHints.includes('dimension')) {
            const values = field.sensitive
              ? undefined
              : parseValueDomain(field.description);
            surface.dimensions.push({
              name: field.name,
              aliases: field.aliases ?? [],
              description: field.description,
              type: field.type,
              ...(values === undefined ? {} : { values }),
              nullable: field.nullable,
              sensitive: field.sensitive
            });
          }
        }
      }
      return surface;
    })
  );
}

export type DataContextMatch =
  | {
      kind: 'environment';
      environmentId: string;
      name: string;
      description?: string;
    }
  | {
      kind: 'schema';
      environmentId: string;
      schemaId: string;
      name: string;
      description: string;
    }
  | {
      kind: 'object';
      environmentId: string;
      schemaId: string;
      objectId: string;
      name: string;
      description: string;
    }
  | {
      kind: 'field';
      environmentId: string;
      schemaId: string;
      objectId: string;
      field: DataField;
    }
  | {
      kind: 'verifiedQuery';
      environmentId: string;
      schemaId: string;
      query: VerifiedQuery;
    };

export interface DataContextSearch {
  current(): Promise<DataContextSnapshot>;
  search(input: { query: string; limit?: number }): Promise<{
    dataContextVersion: string;
    matches: DataContextMatch[];
  }>;
}

export function createDataContextSearch(
  provider: DataContextProvider
): DataContextSearch {
  return {
    current: () => provider.current(),
    async search({ query, limit = 10 }) {
      const snapshot = await provider.current();
      const needle = query.trim().toLocaleLowerCase();
      if (!needle || limit <= 0) {
        return { dataContextVersion: snapshot.version, matches: [] };
      }
      const candidates: Array<{ match: DataContextMatch; text: string }> = [];
      for (const environment of snapshot.executionEnvironments) {
        candidates.push({
          match: {
            kind: 'environment',
            environmentId: environment.id,
            name: environment.name,
            ...(environment.description ? { description: environment.description } : {})
          },
          text: [environment.id, environment.name, environment.description].join(' ')
        });
        for (const schema of environment.schemas) {
          candidates.push({
            match: {
              kind: 'schema',
              environmentId: environment.id,
              schemaId: schema.id,
              name: schema.name,
              description: schema.description
            },
            text: [schema.id, schema.name, schema.description].join(' ')
          });
          for (const object of schema.objects) {
            candidates.push({
              match: {
                kind: 'object',
                environmentId: environment.id,
                schemaId: schema.id,
                objectId: object.id,
                name: object.name,
                description: object.description
              },
              text: [object.id, object.name, object.description].join(' ')
            });
            for (const rawField of object.fields) {
              // 敏感字段标注(#80):检索可发现字段,但匹配文本与返回内容
              // 都使用隐去取值域语义的投影,敏感取值不进入检索面。
              const field = redactSensitiveField(rawField);
              candidates.push({
                match: {
                  kind: 'field',
                  environmentId: environment.id,
                  schemaId: schema.id,
                  objectId: object.id,
                  field
                },
                text: [field.name, field.description, ...(field.aliases ?? [])].join(' ')
              });
            }
          }
          for (const verifiedQuery of schema.verifiedQueries) {
            candidates.push({
              match: {
                kind: 'verifiedQuery',
                environmentId: environment.id,
                schemaId: schema.id,
                query: verifiedQuery
              },
              text: [
                verifiedQuery.id,
                verifiedQuery.question,
                verifiedQuery.description
              ].join(' ')
            });
          }
        }
      }
      return {
        dataContextVersion: snapshot.version,
        matches: candidates
          .map((candidate) => ({
            ...candidate,
            score: matchScore(needle, candidate.text)
          }))
          .filter(({ score }) => Number.isFinite(score))
          .sort((left, right) => left.score - right.score)
          .slice(0, limit)
          .map(({ match }) => match)
      };
    }
  };
}

function matchScore(needle: string, text: string): number {
  const normalized = text.toLocaleLowerCase();
  if (normalized === needle) return 0;
  if (normalized.startsWith(needle)) return 1;
  if (normalized.includes(needle)) return 2;
  return Number.POSITIVE_INFINITY;
}
