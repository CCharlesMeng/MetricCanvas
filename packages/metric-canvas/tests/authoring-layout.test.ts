import { describe, expect, it } from 'vitest';
import {
  authoringComponentDropIndex,
  authoringDropSlots,
  normalizeAuthoringDropTarget,
  resolveAuthoringSections
} from '../src/authoring-layout';
import type { PageSection } from '@metriccanvas/page';

describe('画布创作态插槽', () => {
  it('非空内容分区包含首位、组件之间与末位；空内容分区保留一个插槽', () => {
    expect(authoringDropSlots(3)).toEqual([0, 1, 2, 3]);
    expect(authoringDropSlots(0)).toEqual([0]);
  });

  it('组件主体左右半区分别映射到组件前后插槽', () => {
    expect(authoringComponentDropIndex(1, 119, 100, 40)).toBe(1);
    expect(authoringComponentDropIndex(1, 120, 100, 40)).toBe(2);
    expect(authoringComponentDropIndex(1, 139, 100, 40)).toBe(2);
  });

  it('同内容分区向后移动时扣除已经移出的组件位置', () => {
    expect(
      normalizeAuthoringDropTarget(
        { sectionId: 'main', index: 1 },
        { sectionId: 'main', index: 3 },
        3
      )
    ).toEqual({
      kind: 'move',
      destination: { sectionId: 'main', index: 2 }
    });
  });

  it('同内容分区拖回原组件两侧的等价插槽时不产生移动', () => {
    expect(
      normalizeAuthoringDropTarget(
        { sectionId: 'main', index: 1 },
        { sectionId: 'main', index: 1 },
        3
      )
    ).toEqual({ kind: 'unchanged' });
    expect(
      normalizeAuthoringDropTarget(
        { sectionId: 'main', index: 1 },
        { sectionId: 'main', index: 2 },
        3
      )
    ).toEqual({ kind: 'unchanged' });
  });

  it('跨内容分区保留目标插槽，并拒绝范围外索引', () => {
    expect(
      normalizeAuthoringDropTarget(
        { sectionId: 'main', index: 1 },
        { sectionId: 'secondary', index: 0 },
        0
      )
    ).toEqual({
      kind: 'move',
      destination: { sectionId: 'secondary', index: 0 }
    });
    expect(
      normalizeAuthoringDropTarget(
        { sectionId: 'main', index: 1 },
        { sectionId: 'secondary', index: 2 },
        1
      )
    ).toEqual({ kind: 'invalid' });
  });

  it('正式组件实体按创作草稿排布，允许保留空内容分区', () => {
    const pageSections = [
      {
        id: 'main',
        columnTracks: [29, 29, 22],
        components: [
          {
            id: 'one',
            type: 'text',
            layout: { span: 12 },
            props: { body: 'one' }
          }
        ]
      }
    ] satisfies PageSection[];

    const resolved = resolveAuthoringSections(pageSections, [
      { id: 'empty', title: '空分区', container: 'card', componentIds: [] },
      { id: 'main', componentIds: ['one'] }
    ]);

    expect(resolved.map((section) => section.id)).toEqual(['empty', 'main']);
    expect(resolved[0]).toMatchObject({
      id: 'empty',
      title: '空分区',
      container: 'card',
      components: []
    });
    expect(resolved[1]!.components[0]).toBe(pageSections[0]!.components[0]);
    expect(resolved[1]!.columnTracks).toEqual([29, 29, 22]);
    expect(
      resolveAuthoringSections(pageSections, [
        { id: 'main', componentIds: ['missing'] }
      ])
    ).toBe(pageSections);
  });
});
