import { describe, expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import {
  commitPageEdit,
  createPageEditorHistory,
  editComponent,
  listEditableComponents,
  moveComponent,
  redoPageEdit,
  undoPageEdit
} from '../src/lib/page-editor';

const document: Page = {
  schemaVersion: '1.0',
  id: 'sales-overview',
  dataSources: {
    summary: {
      fields: { gmv: { type: 'number', role: 'metric' } },
      source: { type: 'query', query: { metrics: ['gmv'], aggregation: 'sum' } }
    }
  },
  sections: [
    {
      id: 'overview',
      title: '经营概览',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'header',
          type: 'reportHeader',
          layout: { span: 12 },
          props: { title: '销售概览', subtitle: '原始说明' }
        },
        {
          id: 'gmv',
          type: 'metricCard',
          layout: { span: 3 },
          data: { main: 'summary' },
          props: { title: '成交总额', rows: [{ label: '成交总额', valueField: 'gmv' }] }
        }
      ]
    }
  ]
};

describe('页面修订编辑工作副本', () => {
  it('列出可选择组件并按组件类型暴露可编辑内容', () => {
    expect(listEditableComponents(document)).toEqual([
      expect.objectContaining({
        locator: { sectionId: 'overview', componentId: 'header' },
        typeLabel: '报告页头',
        title: '销售概览',
        detail: '原始说明',
        detailLabel: '副标题',
        span: 12
      }),
      expect.objectContaining({
        locator: { sectionId: 'overview', componentId: 'gmv' },
        typeLabel: '指标卡',
        title: '成交总额',
        detailLabel: null,
        span: 3
      })
    ]);
  });

  it('在不改变基线文档的前提下修改内容和布局', () => {
    const edited = editComponent(
      document,
      { sectionId: 'overview', componentId: 'header' },
      { title: '区域经营概览', detail: '更新至今日', span: 10 }
    );

    expect(document.sections[0]?.components[0]).toMatchObject({
      layout: { span: 12 },
      props: { title: '销售概览', subtitle: '原始说明' }
    });
    expect(edited.sections[0]?.components[0]).toMatchObject({
      layout: { span: 10 },
      props: { title: '区域经营概览', subtitle: '更新至今日' }
    });
  });

  it('调整同一内容分区中的组件顺序', () => {
    const moved = moveComponent(
      document,
      { sectionId: 'overview', componentId: 'gmv' },
      -1
    );
    expect(moved.sections[0]?.components.map((component) => component.id)).toEqual([
      'gmv',
      'header'
    ]);
  });

  it('工作副本支持撤销、重做，提交新操作后清空重做栈', () => {
    const initial = createPageEditorHistory(document);
    const firstDocument = editComponent(
      initial.current,
      { sectionId: 'overview', componentId: 'gmv' },
      { span: 6 }
    );
    const first = commitPageEdit(initial, firstDocument);
    const undone = undoPageEdit(first);
    const redone = redoPageEdit(undone);
    const alternate = commitPageEdit(
      undone,
      editComponent(
        undone.current,
        { sectionId: 'overview', componentId: 'gmv' },
        { title: 'GMV' }
      )
    );

    expect(undone.current.sections[0]?.components[1]?.layout.span).toBe(3);
    expect(redone.current.sections[0]?.components[1]?.layout.span).toBe(6);
    expect(alternate.future).toEqual([]);
  });
});
