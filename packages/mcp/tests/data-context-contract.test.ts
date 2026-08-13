import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import {
  createDataContextSearch,
  parseDataContextSnapshot,
  parseValueDomain,
  semanticSurfaceOf,
  type DataContextSnapshot
} from '../src/data-context';

/**
 * 数据上下文快照契约守护(#80):
 * - interface/parse ↔ docs/schema-metadata.schema.json 等价:对示例快照及其
 *   系统性变异逐条比对两侧裁决,任一侧单独改动即报警;
 * - parseDataContextSnapshot 给出路径级错误;
 * - sensitive 字段在语义面投影与检索侧被标注:字段可发现,取值域语义不外泄。
 */

const schemaPath = fileURLToPath(
  new URL('../../../docs/schema-metadata.schema.json', import.meta.url)
);
const examplePath = fileURLToPath(
  new URL('../../../docs/examples/schema-metadata.example.json', import.meta.url)
);

const jsonSchema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
const example = JSON.parse(readFileSync(examplePath, 'utf8')) as Record<string, unknown>;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const ajvValidate = ajv.compile(jsonSchema);

function verdicts(candidate: unknown): { parse: boolean; ajv: boolean } {
  return {
    parse: parseDataContextSnapshot(candidate).ok,
    ajv: ajvValidate(candidate) === true
  };
}

/** 深拷贝后在指定路径上执行变异。 */
function mutate(
  value: unknown,
  apply: (root: Record<string, unknown> | unknown[]) => void
): unknown {
  const copy = structuredClone(value) as Record<string, unknown> | unknown[];
  apply(copy);
  return copy;
}

/** 枚举 JSON 树里的全部对象节点路径(数组下标进入路径)。 */
function objectPaths(value: unknown, path: Array<string | number> = []): Array<Array<string | number>> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => objectPaths(item, [...path, index]));
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return [path, ...Object.entries(record).flatMap(([key, child]) => objectPaths(child, [...path, key]))];
  }
  return [];
}

function nodeAt(root: unknown, path: Array<string | number>): Record<string, unknown> {
  let current: unknown = root;
  for (const segment of path) {
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current as Record<string, unknown>;
}

describe('数据上下文快照契约:parse ↔ JSON Schema 等价守护', () => {
  it('示例快照两侧同判有效', () => {
    const { parse, ajv: ajvVerdict } = verdicts(example);
    expect(ajvVerdict).toBe(true);
    expect(parse).toBe(true);
  });

  it('对示例的每个对象节点做删键与加未知键变异,两侧裁决逐条一致', () => {
    const cases: Array<{ label: string; candidate: unknown }> = [];
    for (const path of objectPaths(example)) {
      const keys = Object.keys(nodeAt(example, path));
      for (const key of keys) {
        cases.push({
          label: `删除 /${[...path, key].join('/')}`,
          candidate: mutate(example, (root) => {
            delete nodeAt(root, path)[key];
          })
        });
      }
      cases.push({
        label: `未知键 /${[...path, '__unknown__'].join('/')}`,
        candidate: mutate(example, (root) => {
          nodeAt(root, path).__unknown__ = 1;
        })
      });
    }
    expect(cases.length).toBeGreaterThan(50);
    for (const { label, candidate } of cases) {
      const { parse, ajv: ajvVerdict } = verdicts(candidate);
      expect(parse, `${label}:parse=${parse} 与 ajv=${ajvVerdict} 不一致`).toBe(ajvVerdict);
    }
  });

  it.each([
    {
      label: 'formatVersion 非 1.0',
      apply: (root: Record<string, unknown>) => {
        root.formatVersion = '2.0';
      }
    },
    {
      label: 'generatedAt 非法日期时间',
      apply: (root: Record<string, unknown>) => {
        root.generatedAt = 'yesterday';
      }
    },
    {
      label: '字段 roleHints 含未知角色',
      apply: (root: Record<string, unknown>) => {
        nodeAt(root, [
          'executionEnvironments', 0, 'schemas', 0, 'objects', 0, 'fields', 0
        ]).roleHints = ['detail'];
      }
    },
    {
      label: '字段 type 不在闭集',
      apply: (root: Record<string, unknown>) => {
        nodeAt(root, [
          'executionEnvironments', 0, 'schemas', 0, 'objects', 0, 'fields', 0
        ]).type = 'json';
      }
    },
    {
      label: 'verifiedQuery role 不在枚举',
      apply: (root: Record<string, unknown>) => {
        nodeAt(root, [
          'executionEnvironments', 0, 'schemas', 0, 'verifiedQueries', 0, 'resultFields', 0
        ]).role = 'detail';
      }
    },
    {
      label: 'dsl_list 多于一项',
      apply: (root: Record<string, unknown>) => {
        const body = nodeAt(root, [
          'executionEnvironments', 0, 'schemas', 0, 'verifiedQueries', 0, 'body'
        ]);
        (body.dsl_list as unknown[]).push({});
      }
    },
    {
      label: 'constraints.readOnly 为 false',
      apply: (root: Record<string, unknown>) => {
        nodeAt(root, ['executionEnvironments', 0, 'constraints']).readOnly = false;
      }
    },
    {
      label: '空字符串 id',
      apply: (root: Record<string, unknown>) => {
        root.id = '';
      }
    }
  ])('定向变异「$label」两侧同判无效', ({ apply }) => {
    const candidate = mutate(example, (root) => apply(root as Record<string, unknown>));
    const { parse, ajv: ajvVerdict } = verdicts(candidate);
    expect(ajvVerdict).toBe(false);
    expect(parse).toBe(false);
  });

  it('解析失败时给出路径级错误', () => {
    const candidate = mutate(example, (root) => {
      nodeAt(root, [
        'executionEnvironments', 0, 'schemas', 0, 'objects', 0, 'fields', 0
      ]).name = '';
    });
    const result = parseDataContextSnapshot(candidate);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.path)).toContain(
      '/executionEnvironments/0/schemas/0/objects/0/fields/0/name'
    );
  });

  it('解析成功时产出类型化快照,消费方无需二次断言', () => {
    const result = parseDataContextSnapshot(example);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.executionEnvironments[0]?.schemas.map((schema) => schema.name)).toEqual([
      '客户活动',
      '运营分析',
      '客户经营'
    ]);
  });
});

function snapshotWithSensitiveDimension(): DataContextSnapshot {
  const parsed = parseDataContextSnapshot(example);
  if (!parsed.ok) throw new Error('示例快照必须可解析');
  const snapshot = structuredClone(parsed.snapshot);
  const fields = snapshot.executionEnvironments[0]!.schemas[1]!.objects[0]!.fields;
  fields.push({
    name: '客户名单',
    type: 'string',
    description: '客户主体名称。取值域:甲公司、乙公司。',
    aliases: ['客户名称'],
    roleHints: ['dimension'],
    nullable: false,
    sensitive: true
  });
  return snapshot;
}

describe('sensitive 字段:检索侧标注,取值域语义不外泄(#80)', () => {
  it('语义面投影保留敏感字段条目,但隐去取值域', () => {
    const surfaces = semanticSurfaceOf(snapshotWithSensitiveDimension());
    const operations = surfaces.find((surface) => surface.businessDomain === '运营分析');
    const sensitiveDimension = operations?.dimensions.find(
      (dimension) => dimension.name === '客户名单'
    );
    expect(sensitiveDimension).toBeDefined();
    expect(sensitiveDimension?.sensitive).toBe(true);
    expect(sensitiveDimension?.values).toBeUndefined();
    expect(sensitiveDimension?.description).not.toContain('甲公司');

    // 非敏感维度不受影响:取值域照常投影。
    const region = operations?.dimensions.find((dimension) => dimension.name === '区域');
    expect(region?.values).toContain('华东');
  });

  it('数据上下文检索返回的敏感字段同样被标注:描述不含取值,且取值不可作为检索词命中', async () => {
    const snapshot = snapshotWithSensitiveDimension();
    const search = createDataContextSearch({ current: async () => snapshot });

    const byName = await search.search({ query: '客户名单' });
    const fieldMatch = byName.matches.find((match) => match.kind === 'field');
    expect(fieldMatch?.kind).toBe('field');
    if (fieldMatch?.kind !== 'field') return;
    expect(fieldMatch.field.sensitive).toBe(true);
    expect(fieldMatch.field.description).not.toContain('甲公司');

    const byValue = await search.search({ query: '甲公司' });
    expect(byValue.matches).toEqual([]);
  });

  it('取值域受控句式只有一份解析声明', () => {
    expect(parseValueDomain('客户经营分层。取值域:卓越、战略、核心、成长。')).toEqual([
      '卓越',
      '战略',
      '核心',
      '成长'
    ]);
    expect(parseValueDomain('没有取值域声明的描述')).toBeUndefined();
  });
});
