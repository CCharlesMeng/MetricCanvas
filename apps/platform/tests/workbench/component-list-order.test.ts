import {describe, expect, it} from 'vitest';
import scenario from '../../../../pages/platform/platform-canvas-experience.json';
import {componentListMove} from '../../src/lib/workbench/component-list-order';
import {createCanvasAuthoringDraft, moveComponent} from '../../src/lib/workbench/document-edit';

function draft() {
  const result = createCanvasAuthoringDraft(structuredClone(scenario));
  if (!result.ok) throw Error(result.message);
  return result.draft;
}

describe('检查器列表复用画布移动语义', () => {
  it.each([
    ['second', 'first', false, [['second', 'first'], ['third']]],
    ['first', 'second', true, [['second', 'first'], ['third']]],
    ['first', 'third', true, [['second'], ['third', 'first']]],
    ['third', 'first', false, [['third', 'first', 'second'], []]]
  ] as const)('将 %s 拖到 %s 的相邻插槽', (source, target, after, expected) => {
    const current = draft(), before = structuredClone(current);
    const intent = componentListMove(current.authoringSections, source, target, after);
    expect(intent).not.toBeNull();
    if (!intent) return;
    const moved = moveComponent(current, intent.locator, intent.destination);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.draft.authoringSections.map(section => section.componentIds)).toEqual(expected);
    expect(current).toEqual(before);
  });

  it.each([
    ['first', 'first', false], ['first', 'first', true],
    ['first', 'second', false], ['second', 'first', true],
    ['removed', 'first', false], ['first', 'removed', true]
  ] as const)('不提交无变化或过期的移动 %s -> %s', (source, target, after) => {
    expect(componentListMove(draft().authoringSections, source, target, after)).toBeNull();
  });
});
