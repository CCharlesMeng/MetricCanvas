import { describe, expect, it } from 'vitest';
import { validate, type DqeQueryDefinition } from '@metriccanvas/page';
import { assembleTransientPage, type ExecutedDataRequestUnit } from '@metriccanvas/mcp';
import {
  changeComponentType,
  componentCandidatesFor,
  createCanvasAuthoringDraft,
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

function authoringDraftOf(document: Record<string, unknown>) {
  const result = createCanvasAuthoringDraft(document);
  if (!result.ok) throw new Error(`测试草稿创建失败：${result.message}`);
  return result.draft;
}

function componentAt(document: Record<string, unknown>, index: number) {
  const sections = document.sections as Array<{ id: string; components: Array<Record<string, unknown>> }>;
  return sections[0]!.components[index]!;
}

describe('画布与配置面板的本地文档改写', () => {
  it('创作草稿允许最后一个组件跨分区后保留空内容分区，正式投影仍通过页面校验', () => {
    const document = assembled();
    const sections = document.sections as Array<{
      id: string;
      title?: string;
      container?: 'plain' | 'panel' | 'card';
      components: Array<Record<string, unknown>>;
    }>;
    const secondaryComponent = sections[0]!.components.pop()!;
    sections[0]!.title = '可暂时为空';
    sections[0]!.container = 'card';
    sections.push({ id: 'secondary', components: [secondaryComponent] });
    expect(validate(document)).toEqual([]);
    const original = structuredClone(document);

    const created = createCanvasAuthoringDraft(document);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const sourceComponent = sections[0]!.components[0]!;
    const moved = moveComponent(
      created.draft,
      { sectionId: 'main', componentId: sourceComponent.id as string },
      { sectionId: 'secondary', index: 0 }
    );

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const canvasSections = moved.draft.canvasDocument.sections as Array<{
      id: string;
      title?: string;
      container?: string;
      components: Array<Record<string, unknown>>;
    }>;
    expect(canvasSections[0]).toMatchObject({
      id: 'main',
      title: '可暂时为空',
      container: 'card',
      components: []
    });
    expect(moved.draft.authoringSections[0]).toEqual({
      id: 'main',
      title: '可暂时为空',
      container: 'card',
      componentIds: []
    });
    expect(
      (moved.draft.pageDocument.sections as Array<{ id: string }>).map(
        (section) => section.id
      )
    ).toEqual(['secondary']);
    expect(validate(moved.draft.pageDocument)).toEqual([]);
    expect(document).toEqual(original);

    const movedBack = moveComponent(
      moved.draft,
      { sectionId: 'secondary', componentId: sourceComponent.id as string },
      { sectionId: 'main', index: 0 }
    );
    expect(movedBack.ok).toBe(true);
    if (!movedBack.ok) return;
    expect(
      (movedBack.draft.canvasDocument.sections as Array<{
        id: string;
        components: Array<{ id: string }>;
      }>).map((section) => ({
        id: section.id,
        componentIds: section.components.map((component) => component.id)
      }))
    ).toEqual([
      { id: 'main', componentIds: [sourceComponent.id] },
      { id: 'secondary', componentIds: [secondaryComponent.id] }
    ]);
    expect(validate(movedBack.draft.pageDocument)).toEqual([]);
  });

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

    const result = changeComponentType(authoringDraftOf(document), locator, 'table');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const changed = componentAt(result.draft.canvasDocument, 0);
    expect(changed.type).toBe('table');
    expect(changed.id).toBe(first.id);
    expect((changed.layout as { span: number }).span).toBe(5);
    expect((changed.data as { main: string }).main).toBe('region-tokens');
    expect(validate(result.draft.pageDocument)).toEqual([]);
    // 纯函数:输入文档不被修改(span 是本测试自己改的)。
    expect((componentAt(document, 0).type as string)).toBe(original.sections
      ? (componentAt(original as Record<string, unknown>, 0).type as string)
      : '');
  });

  it('切换到硬闸拒绝的形态失败并给出原因,不产出文档', () => {
    const document = assembled();
    const first = componentAt(document, 0);
    const result = changeComponentType(
      authoringDraftOf(document),
      { sectionId: 'main', componentId: first.id as string },
      'metricCard'
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('组件重排:移动到目标插槽,出口过 validate', () => {
    const document = assembled();
    const [first, second] = [componentAt(document, 0), componentAt(document, 1)];
    const result = moveComponent(
      authoringDraftOf(document),
      { sectionId: 'main', componentId: second.id as string },
      { sectionId: 'main', index: 0 }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(componentAt(result.draft.canvasDocument, 0).id).toBe(second.id);
    expect(componentAt(result.draft.canvasDocument, 1).id).toBe(first.id);
    expect(validate(result.draft.pageDocument)).toEqual([]);
  });

  it('组件重排:支持同内容分区末位和跨内容分区首位,组件字段逐项保持', () => {
    const document = assembled();
    const first = componentAt(document, 0);
    const second = componentAt(document, 1);
    const originalFirst = structuredClone(first);
    const sections = document.sections as Array<{
      id: string;
      components: Array<Record<string, unknown>>;
    }>;
    sections[0]!.components.pop();
    sections.push({ id: 'secondary', components: [second] });
    expect(validate(document)).toEqual([]);

    const crossSection = moveComponent(
      authoringDraftOf(document),
      { sectionId: 'main', componentId: first.id as string },
      { sectionId: 'secondary', index: 0 }
    );
    expect(crossSection.ok).toBe(true);
    if (!crossSection.ok) return;
    const movedSections = crossSection.draft.canvasDocument.sections as Array<{
      id: string;
      components: Array<Record<string, unknown>>;
    }>;
    expect(movedSections[0]!.components).toEqual([]);
    expect(movedSections[1]!.components).toEqual([originalFirst, second]);
    expect(validate(crossSection.draft.pageDocument)).toEqual([]);

    const moveToEnd = moveComponent(
      authoringDraftOf(assembled()),
      { sectionId: 'main', componentId: first.id as string },
      { sectionId: 'main', index: 2 }
    );
    expect(moveToEnd.ok).toBe(true);
    if (!moveToEnd.ok) return;
    expect(componentAt(moveToEnd.draft.canvasDocument, 1).id).toBe(first.id);
  });

  it('组件重排:无效插槽失败，原插槽等价移动成功但文档内容不变', () => {
    const document = assembled();
    const original = structuredClone(document);
    const first = componentAt(document, 0);

    const draft = authoringDraftOf(document);
    const invalid = moveComponent(
      draft,
      { sectionId: 'main', componentId: first.id as string },
      { sectionId: 'main', index: 99 }
    );
    expect(invalid).toEqual({ ok: false, message: '目标插槽不在当前文档里' });
    expect(document).toEqual(original);

    const unchanged = moveComponent(
      draft,
      { sectionId: 'main', componentId: first.id as string },
      { sectionId: 'main', index: 1 }
    );
    expect(unchanged.ok).toBe(true);
    if (!unchanged.ok) return;
    expect(unchanged.draft).toBe(draft);
    expect(unchanged.draft.canvasDocument).toEqual(original);
  });

  it('标题与宽度编辑:宽度夹取 1–12,空标题移除 props.title', () => {
    const document = assembled();
    const first = componentAt(document, 0);
    const locator = { sectionId: 'main', componentId: first.id as string };

    const widened = editComponent(authoringDraftOf(document), locator, { span: 99 });
    expect(widened.ok).toBe(true);
    if (!widened.ok) return;
    expect((componentAt(widened.draft.canvasDocument, 0).layout as { span: number }).span).toBe(12);

    const cleared = editComponent(widened.draft, locator, { title: ' ' });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(
      (componentAt(cleared.draft.canvasDocument, 0).props as Record<string, unknown>).title
    ).toBeUndefined();
    expect(validate(cleared.draft.pageDocument)).toEqual([]);
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
