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
  schemaVersion: '5.0',
  id: 'sales-overview',
  dataSources: {
    summary: {
      fields: { gmv: { type: 'number', role: 'measure' } },
      source: { type: 'inline', rows: [{ gmv: 128600 }] }
    }
  },
  sections: [
    {
      id: 'overview',
      title: '经营概览',
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

  it('组合卡只作为顶层原子编辑，修改标题与跨度不破坏子组件 JSON', () => {
    const compositeDocument: Page = {
      ...document,
      schemaVersion: '5.2',
      sections: [{
        id: 'overview',
        components: [{
          id: 'summary-card',
          type: 'compositeCard',
          layout: { span: 4 },
          props: {
            title: '机会点概况',
            components: [{
              id: 'summary-metrics',
              type: 'metricCard',
              layout: { span: 12 },
              data: { main: 'summary' },
              props: { rows: [{ label: '成交总额', valueField: 'gmv' }] }
            }]
          }
        }]
      }]
    };
    const beforeChildren = JSON.stringify(
      (compositeDocument.sections[0]!.components[0] as Extract<Page['sections'][number]['components'][number], { type: 'compositeCard' }>).props.components
    );

    expect(listEditableComponents(compositeDocument).map((item) => item.locator)).toEqual([
      { sectionId: 'overview', componentId: 'summary-card' }
    ]);
    const edited = editComponent(
      compositeDocument,
      { sectionId: 'overview', componentId: 'summary-card' },
      { title: '机会点总览', span: 6 }
    );
    const card = edited.sections[0]!.components[0];
    if (card?.type !== 'compositeCard') throw new Error('组合卡丢失');
    expect(card.layout.span).toBe(6);
    expect(card.props.title).toBe('机会点总览');
    expect(JSON.stringify(card.props.components)).toBe(beforeChildren);
  });
});
