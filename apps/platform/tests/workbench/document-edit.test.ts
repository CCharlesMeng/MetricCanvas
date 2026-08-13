import { describe, expect, it } from 'vitest';
import { validate, type DqeQueryDefinition } from '@metriccanvas/page';
import { assembleTransientPage, type ExecutedDataRequestUnit } from '@metriccanvas/mcp';
import {
  changeComponentType,
  componentCandidatesFor,
  editComponent,
  locatorOfComponent,
  moveComponent,
  unitOfDataSource
} from '../../src/lib/workbench/document-edit';

function dqeQuery(outputDims: string[], outputMetrics: string[]): DqeQueryDefinition {
  return {
    language: 'dqe',
    body: {
      dsl_list: [
        {
          output_dims: outputDims,
          output_metrics: outputMetrics,
          filter: { dims: [], metrics: [] },
          order: {}
        }
      ]
    }
  };
}

const regionUnit: ExecutedDataRequestUnit = {
  dataSourceId: 'region-tokens',
  title: '区域消耗对比',
  fields: {
    region: { queryField: '区域', type: 'string', role: 'dimension', label: '区域', nullable: false },
    tokens: { queryField: '消耗量', type: 'number', role: 'measure', label: '消耗量', nullable: false }
  },
  query: dqeQuery(['区域'], ['消耗量']),
  initial: {
    capturedAt: '2026-08-13T00:00:00+08:00',
    rows: [
      { 区域: '华东', 消耗量: 42 },
      { 区域: '华南', 消耗量: 27 },
      { 区域: '华北', 消耗量: 21 },
      { 区域: '西南', 消耗量: 14 },
      { 区域: '华中', 消耗量: 10 },
      { 区域: '东北', 消耗量: 6 },
      { 区域: '西北', 消耗量: 3 }
    ],
    totalCount: 7
  },
  intent: 'comparison'
};

const trendUnit: ExecutedDataRequestUnit = {
  dataSourceId: 'monthly-tokens',
  title: '月度消耗趋势',
  fields: {
    month: { queryField: '月份', type: 'date', role: 'dimension', label: '月份', nullable: false },
    tokens: { queryField: '消耗量', type: 'number', role: 'measure', label: '消耗量', nullable: false }
  },
  query: dqeQuery(['月份'], ['消耗量']),
  initial: {
    capturedAt: '2026-08-13T00:00:00+08:00',
    rows: [
      { 月份: '2026-06-01', 消耗量: 88 },
      { 月份: '2026-07-01', 消耗量: 96 }
    ],
    totalCount: 2
  },
  intent: 'trend'
};

function assembled(): Record<string, unknown> {
  const result = assembleTransientPage({
    pageId: 'ask-transient-0badc0de',
    units: [regionUnit, trendUnit]
  });
  if (!result.ok) throw new Error('测试文档装配失败');
  return structuredClone(result.document) as unknown as Record<string, unknown>;
}

function componentAt(document: Record<string, unknown>, index: number) {
  const sections = document.sections as Array<{ id: string; components: Array<Record<string, unknown>> }>;
  return sections[0]!.components[index]!;
}

describe('画布与配置面板的本地文档改写', () => {
  it('由文档反推取数单元:字段契约、查询定义与内嵌初始行完整还原', () => {
    const document = assembled();
    const unit = unitOfDataSource(document, 'region-tokens');
    expect(unit).toMatchObject({
      dataSourceId: 'region-tokens',
      query: { language: 'dqe' },
      initial: { totalCount: 7 }
    });
    expect(Object.keys(unit!.fields)).toEqual(['region', 'tokens']);
  });

  it('组件候选由推荐唯一实现给出:硬闸拒绝的形态带原因', () => {
    const document = assembled();
    const candidates = componentCandidatesFor(document, 'region-tokens');
    const bar = candidates.find((candidate) => candidate.type === 'barChart');
    const metricCard = candidates.find((candidate) => candidate.type === 'metricCard');
    expect(bar?.ok).toBe(true);
    expect(metricCard?.ok).toBe(false);
    expect(metricCard?.reasons.length).toBeGreaterThan(0);
  });

  it('组件形态切换:type/props 由装配重建,id 与用户宽度保留,出口过 validate,输入不被修改', () => {
    const document = assembled();
    const original = structuredClone(document);
    const first = componentAt(document, 0);
    const locator = { sectionId: 'main', componentId: first.id as string };
    (first.layout as { span: number }).span = 5;

    const result = changeComponentType(document, locator, 'table');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const changed = componentAt(result.document, 0);
    expect(changed.type).toBe('table');
    expect(changed.id).toBe(first.id);
    expect((changed.layout as { span: number }).span).toBe(5);
    expect((changed.data as { main: string }).main).toBe('region-tokens');
    expect(validate(result.document)).toEqual([]);
    // 纯函数:输入文档不被修改(span 是本测试自己改的)。
    expect((componentAt(document, 0).type as string)).toBe(original.sections
      ? (componentAt(original as Record<string, unknown>, 0).type as string)
      : '');
  });

  it('切换到硬闸拒绝的形态失败并给出原因,不产出文档', () => {
    const document = assembled();
    const first = componentAt(document, 0);
    const result = changeComponentType(
      document,
      { sectionId: 'main', componentId: first.id as string },
      'metricCard'
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('组件重排:移动到目标组件之前,出口过 validate', () => {
    const document = assembled();
    const [first, second] = [componentAt(document, 0), componentAt(document, 1)];
    const result = moveComponent(
      document,
      { sectionId: 'main', componentId: second.id as string },
      { sectionId: 'main', componentId: first.id as string }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(componentAt(result.document, 0).id).toBe(second.id);
    expect(componentAt(result.document, 1).id).toBe(first.id);
    expect(validate(result.document)).toEqual([]);
  });

  it('标题与宽度编辑:宽度夹取 1–12,空标题移除 props.title', () => {
    const document = assembled();
    const first = componentAt(document, 0);
    const locator = { sectionId: 'main', componentId: first.id as string };

    const widened = editComponent(document, locator, { span: 99 });
    expect(widened.ok).toBe(true);
    if (!widened.ok) return;
    expect((componentAt(widened.document, 0).layout as { span: number }).span).toBe(12);

    const cleared = editComponent(widened.document, locator, { title: ' ' });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(
      (componentAt(cleared.document, 0).props as Record<string, unknown>).title
    ).toBeUndefined();
    expect(validate(cleared.document)).toEqual([]);
  });

  it('组件 id 反查定位:存在返回分区+组件,不存在返回 null', () => {
    const document = assembled();
    const first = componentAt(document, 0);
    expect(locatorOfComponent(document, first.id as string)).toEqual({
      sectionId: 'main',
      componentId: first.id
    });
    expect(locatorOfComponent(document, 'ghost')).toBeNull();
  });
});
