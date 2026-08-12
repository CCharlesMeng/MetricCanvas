import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv';
import inlineReport from '../fixtures/contract-valid/inline-report.json';
import mixedPage from '../fixtures/contract-valid/mixed-page.json';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';
import { pageSchema } from '../src';
import { legacyPageSchema } from './legacy-schema-snapshot';

/**
 * 阶段三A 的安全网:在把 page.ts/schema.ts/component-catalog.ts 收敛到 Zod 4
 * 单一真源之前,先证明"迁移前的手写 schema.ts"(冻结在 `legacy-schema-snapshot.ts`)
 * 与"迁移后 `z.toJSONSchema` 产出的 schema.ts"经 ajv 校验的结果一致。
 *
 * 比对口径:同一份文档喂给两个 ajv 编译产物,断言
 *   1) 有效性(valid/invalid)完全一致;
 *   2) 无效时,报错定位到的 JSON Pointer 集合完全一致
 *      (不比较具体 keyword/message 文本——`oneOf`→`anyOf` 之类的已知语义等价
 *      改写会改变 ajv 错误对象的 keyword,但不改变"哪些指针出了问题")。
 *
 * 覆盖范围:
 *   - `pages/*.json` 全部真实页面：只用存量组件的页面继续与 legacy 等价；
 *     使用新增组件/字段的页面只要求当前 Schema 接受；
 *   - `packages/page/fixtures/contract-valid/*.json` 全部构造合法文档;
 *   - 对上述每份文档做结构变异(逐节点删除 / 替换成错误类型 / 清空数组 /
 *     插入多余字段),覆盖 additionalProperties、required、enum、pattern、
 *     minItems/minProperties 等约束;
 *   - 针对三处已知差异(anyOf/oneOf 改写、componentAction 判别式重复、
 *     dataSource/fieldReference/fieldBinding/tableColumnNode/timeRangeFilter
 *     等非判别式联合)手写的边界文档。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const pagesDir = path.join(repoRoot, 'pages');

function loadRealPages(): Array<{ name: string; document: unknown }> {
  return readdirSync(pagesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      name,
      document: JSON.parse(readFileSync(path.join(pagesDir, name), 'utf-8'))
    }));
}

const realPages = loadRealPages();
// 迁移安全网的前提之一:真实页面数量以实际目录内容为准,不能悄悄少测。
if (realPages.length < 1) {
  throw new Error('pages/ 目录下没有找到任何 *.json,等价性测试失去意义');
}

const fixturePages: Array<{ name: string; document: unknown }> = [
  { name: 'fixtures/inline-report.json', document: inlineReport },
  { name: 'fixtures/mixed-page.json', document: mixedPage },
  { name: 'fixtures/query-dashboard.json', document: queryDashboard }
];

function usesCurrentOnlyComponent(document: unknown): boolean {
  if (typeof document !== 'object' || document === null) return false;
  const sections = (document as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return false;
  return sections.some((section) => {
    if (typeof section !== 'object' || section === null) return false;
    const components = (section as { components?: unknown }).components;
    if (!Array.isArray(components)) return false;
    return components.some((component) => {
      if (typeof component !== 'object' || component === null) return false;
      const candidate = component as { type?: unknown; props?: { series?: unknown } };
      if (candidate.type === 'rankingDetailCard') return true;
      if (candidate.type !== 'barChart' || !Array.isArray(candidate.props?.series)) return false;
      return candidate.props.series.some(
        (series) =>
          typeof series === 'object' &&
          series !== null &&
          Object.hasOwn(series, 'role')
      );
    });
  });
}

const legacyCompatibleDocuments = [...realPages, ...fixturePages].filter(
  ({ document }) => !usesCurrentOnlyComponent(document)
);
const currentOnlyDocuments = realPages.filter(({ document }) =>
  usesCurrentOnlyComponent(document)
);

function compile(schema: unknown) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema as Record<string, unknown>);
}

const legacyValidate = compile(legacyPageSchema);
const nextValidate = compile(pageSchema);

interface Verdict {
  valid: boolean;
  pointers: string[];
}

function verdict(validateFn: ReturnType<typeof compile>, document: unknown): Verdict {
  const valid = validateFn(document) as boolean;
  const pointers = valid
    ? []
    : Array.from(
        new Set((validateFn.errors ?? []).map((error) => error.instancePath || '/'))
      ).sort();
  return { valid, pointers };
}

interface Mismatch {
  description: string;
  legacy: Verdict;
  next: Verdict;
}

function compareOne(description: string, document: unknown): Mismatch | undefined {
  const legacy = verdict(legacyValidate, document);
  const next = verdict(nextValidate, document);
  // recordList/detail 使字段 Schema 成为判别联合。当外层 dataSource
  // 的其他字段已经无效时，AJV 会额外报出另一字段分支的
  // type/role 诊断；这不改变旧文档的有效性或原有错误定位。
  const nextComparablePointers = next.pointers.filter(
    (pointer) =>
      legacy.pointers.includes(pointer) ||
      !/^\/dataSources\/[^/]+\/fields\/[^/]+\/(?:type|role)$/.test(pointer)
  );
  const equivalent =
    legacy.valid === next.valid &&
    legacy.pointers.length === nextComparablePointers.length &&
    legacy.pointers.every(
      (pointer, index) => pointer === nextComparablePointers[index]
    );
  return equivalent ? undefined : { description, legacy, next };
}

function assertAllEquivalent(cases: Array<{ description: string; document: unknown }>): void {
  const mismatches: Mismatch[] = [];
  for (const { description, document } of cases) {
    const mismatch = compareOne(description, document);
    if (mismatch) mismatches.push(mismatch);
  }
  if (mismatches.length > 0) {
    const preview = mismatches
      .slice(0, 10)
      .map(
        (m) =>
          `- ${m.description}\n  legacy: ${JSON.stringify(m.legacy)}\n  next:   ${JSON.stringify(m.next)}`
      )
      .join('\n');
    throw new Error(
      `${mismatches.length}/${cases.length} 份文档的 ajv 校验结果与旧 schema 不一致：\n${preview}`
    );
  }
}

describe('新旧 page schema 等价性(阶段三A 安全网)', () => {
  it('只使用存量组件的页面与构造文档在两份 schema 下同为有效', () => {
    for (const { name, document } of legacyCompatibleDocuments) {
      expect(legacyValidate(document), `legacy schema 应接受 ${name}`).toBe(true);
      expect(nextValidate(document), `next schema 应接受 ${name}`).toBe(true);
    }
  });

  it('使用新增组件或柱系列 role 的正式页面只由当前 Schema 验证', () => {
    for (const { name, document } of currentOnlyDocuments) {
      expect(nextValidate(document), `当前 schema 应接受 ${name}`).toBe(true);
      expect(legacyValidate(document), `legacy schema 不应认识 ${name}`).toBe(false);
    }
  });

  it('结构变异合集：逐节点删除/改型/清空数组/插入多余字段后两份 schema 结果一致', () => {
    const cases = legacyCompatibleDocuments.flatMap(({ name, document }) =>
      mutationsFor(document as JsonValue).map((mutation) => ({
        description: `${name} :: ${mutation.description}`,
        document: mutation.document
      }))
    );
    // 变异生成器本身要有产出，否则这份安全网什么也没测。
    expect(cases.length).toBeGreaterThan(200);
    assertAllEquivalent(cases);
  });

  describe('已知差异的边界文档（anyOf/oneOf 改写、非判别式联合）', () => {
    function groupedPage() {
      return structuredClone({
        schemaVersion: '5.0',
        id: 'grouped',
        dataSources: {
          current: {
            fields: {
              dimensions: { region: { queryField: '区域', type: 'string' } },
              measures: { revenue: { queryField: '销售额', type: 'number' } }
            },
            source: {
              type: 'query',
              query: {
                language: 'dqe',
                body: { dsl_list: [{ output_dims: ['区域'], output_metrics: ['销售额'] }] }
              }
            }
          }
        },
        sections: [
          {
            id: 'main',
            components: [
              {
                id: 'table',
                type: 'table',
                layout: { span: 12 },
                data: { main: 'current' },
                props: { columns: [{ field: 'region' }, { field: 'revenue' }] }
              }
            ]
          }
        ]
      });
    }

    it('groupedQueryFields 缺少 dimensions 与 measures 都无效(anyOf 边界)', () => {
      const document: any = groupedPage();
      document.dataSources.current.fields = {};
      assertAllEquivalent([{ description: 'grouped fields 空对象', document }]);
    });

    it('groupedQueryFields 同时声明 dimensions 与 measures 有效', () => {
      assertAllEquivalent([{ description: 'grouped fields 双分组', document: groupedPage() }]);
    });

    it('fieldReference/fieldBinding 非判别式联合：字符串简写与对象形式都有效，数字无效', () => {
      const doc: any = structuredClone(inlineReport);
      const original = doc.sections[0].components[1].props.rows[0].valueField;
      const cases = [
        { description: '字符串简写', document: withValueField(doc, original) },
        {
          description: '对象形式',
          document: withValueField(doc, { data: 'main', field: 'gmv' })
        },
        { description: '数字（两个分支都不匹配）', document: withValueField(doc, 42) }
      ];
      assertAllEquivalent(cases);

      function withValueField(base: any, value: unknown) {
        const clone = structuredClone(base);
        clone.sections[0].components[1].props.rows[0].valueField = value;
        return clone;
      }
    });

    it('componentAction 两个分支共享 on:"click" 判别值：writeFilter 与 navigate 都有效，混合两者无效', () => {
      const base: any = structuredClone(queryDashboard);
      const writeFilterAction = base.sections[0].components[0].props.actions[0];
      const navigateAction = {
        on: 'click',
        navigate: { page: 'other-page' }
      };
      const mixedAction = { on: 'click', writeFilter: writeFilterAction.writeFilter, navigate: navigateAction.navigate };

      const withAction = (action: unknown) => {
        const clone = structuredClone(base);
        clone.sections[0].components[0].props.actions = [action];
        return clone;
      };

      assertAllEquivalent([
        { description: 'writeFilter 分支', document: withAction(writeFilterAction) },
        { description: 'navigate 分支', document: withAction(navigateAction) },
        { description: '混合两个分支的多余字段', document: withAction(mixedAction) }
      ]);
    });

    it('tableColumnNode 递归联合：分组列嵌套分组列，及非法混合 kind', () => {
      const base: any = structuredClone(queryDashboard);
      const nestedGroup = {
        kind: 'group',
        id: 'g1',
        title: '分组',
        children: [
          {
            kind: 'group',
            id: 'g2',
            title: '嵌套分组',
            children: [{ field: 'region' }]
          }
        ]
      };
      const invalidMixed = { kind: 'group', field: 'region' };

      const withColumns = (columns: unknown) => {
        const clone = structuredClone(base);
        clone.sections[0].components[0].props.columns = columns;
        return clone;
      };

      assertAllEquivalent([
        { description: '嵌套分组列', document: withColumns([nestedGroup]) },
        { description: '分组与字段列字段混用（应无效）', document: withColumns([invalidMixed]) }
      ]);
    });

    it('dqeQuery.body.dsl_list 长度边界：0/1/2 项', () => {
      const withDslList = (dslList: unknown[]) => {
        const clone: any = structuredClone(queryDashboard);
        clone.dataSources.sales.source.query.body.dsl_list = dslList;
        return clone;
      };
      const item = (queryDashboard as any).dataSources.sales.source.query.body.dsl_list[0];
      assertAllEquivalent([
        { description: '0 项', document: withDslList([]) },
        { description: '1 项（有效）', document: withDslList([item]) },
        { description: '2 项', document: withDslList([item, item]) }
      ]);
    });

    it('timeRangeFilter.default 非判别式联合：预设字符串与绝对区间都有效，数字无效', () => {
      const base: any = structuredClone(queryDashboard);
      base.filters = [{ id: 'range', type: 'timeRange' }];
      const withDefault = (value: unknown) => {
        const clone = structuredClone(base);
        clone.filters[0].default = value;
        return clone;
      };
      assertAllEquivalent([
        { description: '预设字符串', document: withDefault('last7d') },
        { description: '绝对区间', document: withDefault({ from: '2026-01-01', to: '2026-01-31' }) },
        { description: '数字（两个分支都不匹配）', document: withDefault(42) }
      ]);
    });

    it('table.pagination 判别式联合：none/local/query 三态与非法 mode', () => {
      const base: any = structuredClone(queryDashboard);
      const tableComponent = base.sections[0].components.find(
        (component: any) => component.type === 'table'
      );
      if (!tableComponent) throw new Error('queryDashboard fixture 需要至少一个 table 组件');
      const withPagination = (pagination: unknown) => {
        const clone = structuredClone(base);
        const table = clone.sections[0].components.find((c: any) => c.type === 'table');
        table.props.pagination = pagination;
        return clone;
      };
      assertAllEquivalent([
        { description: 'mode:none', document: withPagination({ mode: 'none' }) },
        { description: 'mode:local', document: withPagination({ mode: 'local', pageSize: 10 }) },
        { description: 'mode:query', document: withPagination({ mode: 'query' }) },
        { description: 'mode:local 缺 pageSize（无效）', document: withPagination({ mode: 'local' }) },
        { description: '未知 mode（无效）', document: withPagination({ mode: 'unknown' }) }
      ]);
    });

    it('reportHeader/text/aiSummary 不接受 data 键（三个组件都没有数据槽）', () => {
      const base: any = structuredClone(inlineReport);
      const header = base.sections[0].components.find((c: any) => c.type === 'reportHeader');
      if (!header) throw new Error('inlineReport fixture 需要一个 reportHeader 组件');
      const withData = structuredClone(base);
      const cloneHeader = withData.sections[0].components.find(
        (c: any) => c.type === 'reportHeader'
      );
      cloneHeader.data = { main: 'overview' };
      assertAllEquivalent([{ description: 'reportHeader 携带非法 data', document: withData }]);
    });

    it('dataSource 联合：inline 与 query 都有效，混合两者字段无效', () => {
      const base: any = structuredClone(inlineReport);
      const mixedSource = structuredClone(base);
      mixedSource.dataSources.overview.source.query = {
        language: 'dqe',
        body: { dsl_list: [{}] }
      };
      assertAllEquivalent([
        { description: 'inline 数据源（有效）', document: base },
        { description: 'inline 数据源混入 query 字段（无效）', document: mixedSource }
      ]);
    });
  });
});

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** 每份种子文档采样的最大变异节点数，避免超大页面（如 5000+ 行）生成过多用例拖慢测试。 */
const MAX_SAMPLED_NODES = 120;

function collectPointers(root: JsonValue): string[] {
  const pointers: string[] = [];
  const visit = (value: JsonValue, pointer: string) => {
    if (pointer !== '') pointers.push(pointer);
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pointer}/${index}`));
    } else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) visit(child, `${pointer}/${key}`);
    }
  };
  visit(root, '');
  return pointers;
}

function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const sampled: T[] = [];
  for (let i = 0; i < max; i++) sampled.push(items[Math.floor(i * step)]!);
  return sampled;
}

function getAtPointer(root: JsonValue, pointer: string): JsonValue {
  let current: JsonValue = root;
  for (const segment of pointer.split('/').slice(1)) {
    current = (current as Record<string, JsonValue>)[segment];
  }
  return current;
}

function withPointer(
  root: JsonValue,
  pointer: string,
  mutate: (parent: Record<string, JsonValue> | JsonValue[], key: string) => void
): JsonValue {
  const clone = structuredClone(root);
  const segments = pointer.split('/').slice(1);
  let parent: any = clone;
  for (let i = 0; i < segments.length - 1; i++) parent = parent[segments[i]!];
  mutate(parent, segments[segments.length - 1]!);
  return clone;
}

function mutationsFor(root: JsonValue): Array<{ description: string; document: JsonValue }> {
  const pointers = sample(collectPointers(root), MAX_SAMPLED_NODES);
  const results: Array<{ description: string; document: JsonValue }> = [];

  for (const pointer of pointers) {
    const value = getAtPointer(root, pointer);

    results.push({
      description: `删除 ${pointer}`,
      document: withPointer(root, pointer, (parent, key) => {
        if (Array.isArray(parent)) parent.splice(Number(key), 1);
        else delete (parent as Record<string, JsonValue>)[key];
      })
    });

    const wrongTypeValue: JsonValue =
      typeof value === 'string'
        ? 12345
        : typeof value === 'number'
          ? 'wrong-type'
          : typeof value === 'boolean'
            ? 'wrong-type'
            : 'wrong-type';
    results.push({
      description: `把 ${pointer} 替换成错误类型`,
      document: withPointer(root, pointer, (parent, key) => {
        (parent as Record<string, JsonValue>)[key] = wrongTypeValue;
      })
    });

    if (Array.isArray(value) && value.length > 0) {
      results.push({
        description: `清空数组 ${pointer}`,
        document: withPointer(root, pointer, (parent, key) => {
          (parent as Record<string, JsonValue>)[key] = [];
        })
      });
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      results.push({
        description: `在 ${pointer} 插入多余字段`,
        document: withPointer(root, pointer, (parent, key) => {
          const target = (parent as Record<string, JsonValue>)[key] as Record<string, JsonValue>;
          target.__unexpected__ = 'x';
        })
      });
    }
  }
  return results;
}
