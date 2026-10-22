import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import scenario from '../../../../pages/platform/platform-canvas-experience.json';
import queryPage from './fixtures/document-edit.json';
import { createCanvasAuthoringDraft, deleteComponent, moveComponent, restoreCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';

function draftOf(document: Record<string, unknown> = scenario) {
  const result = createCanvasAuthoringDraft(document);
  if (!result.ok) throw Error(result.message);
  return result.draft;
}

describe('搭建画布删除与恢复', () => {
  it('删除分区最后一个组件后保留草稿分区，正式投影有效，原草稿可完整恢复', () => {
    const original = draftOf();
    const before = JSON.stringify(original);
    const result = deleteComponent(original, { sectionId: 'details', componentId: 'third' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.authoringSections[1]?.componentIds).toEqual([]);
    expect(result.draft.pageDocument.sections).toHaveLength(1);
    expect(validate(result.draft.pageDocument)).toEqual([]);
    expect(JSON.stringify(original)).toBe(before);
    expect(restoreCanvasAuthoringDraft(JSON.parse(before))).toEqual({ ok: true, draft: original });
    const moved = moveComponent(result.draft, { sectionId: 'overview', componentId: 'first' }, { sectionId: 'details', index: 0 });
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.draft.authoringSections[1]?.componentIds).toEqual(['first']);
  });

  it('删除查询消费者保留页面数据源、查询与其他消费者', () => {
    const original = draftOf(queryPage);
    const result = deleteComponent(original, { sectionId: queryPage.sections[0]!.id, componentId: queryPage.sections[0]!.components[0]!.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.draft.pageDocument.dataSources as object).length).toBeGreaterThan(0);
    expect(result.draft.pageDocument.dataSources).toEqual(queryPage.dataSources);
    expect(validate(result.draft.pageDocument)).toEqual([]);
  });

  it('拒绝陈旧定位及删除页面最后一个组件', () => {
    const original = draftOf();
    expect(deleteComponent(original, { sectionId: 'missing', componentId: 'first' }).ok).toBe(false);
    expect(deleteComponent(original, { sectionId: 'overview', componentId: 'missing' }).ok).toBe(false);
    let draft = original;
    for (const componentId of ['first', 'second']) {
      const result = deleteComponent(draft, { sectionId: 'overview', componentId });
      if (!result.ok) throw Error(result.message);
      draft = result.draft;
    }
    expect(deleteComponent(draft, { sectionId: 'details', componentId: 'third' })).toEqual({ ok: false, message: '页面至少需要一个组件，无法删除最后一个组件' });
    expect(draft.pageDocument.dataSources).toEqual(original.pageDocument.dataSources);
  });
});
