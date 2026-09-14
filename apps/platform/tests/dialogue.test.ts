import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { describe, expect, it, vi } from 'vitest';
import { DRAFT_SAVED_EVENT, readDraftSavedDetail, type DialogueAdapter } from '../src/lib/dialogue/port';
import { stubDialogueAdapter } from '../src/lib/dialogue/stub-adapter';
import { attachDialogue } from '../src/lib/dialogue/lifecycle';

// 仅实现 stub 使用的 DOM 接缝；不需要浏览器或真实 SDK。
function createHost() {
  const children = new Set<unknown>();
  const placeholder = {
    textContent: '',
    setAttribute: vi.fn(),
    remove: () => { children.delete(placeholder); }
  };
  const element = {
    ownerDocument: { createElement: vi.fn(() => placeholder) },
    appendChild: (child: unknown) => { children.add(child); }
  } as unknown as HTMLElement;
  return { element, children, placeholder };
}

describe('dialogue seam', () => {
  it('mounts a placeholder and destroys only its own node, repeatedly and independently', async () => {
    const { element, children, placeholder } = createHost();
    const existing = {};
    children.add(existing);
    const other = createHost();
    const destroy = await stubDialogueAdapter.mount(element);
    const destroyOther = await stubDialogueAdapter.mount(other.element);
    expect(children.has(placeholder)).toBe(true);
    expect(placeholder.textContent).toBe('对话服务尚未接通。');
    destroy();
    destroy();
    expect([...children]).toEqual([existing]);
    expect(other.children.size).toBe(1);
    destroyOther();
    expect(other.children.size).toBe(0);
  });

  it('releases an injected adapter exactly once', async () => {
    const destroy = vi.fn();
    const adapter: DialogueAdapter = { mount: vi.fn(async () => destroy) };
    const { element } = createHost();
    const stop = attachDialogue(adapter, element, vi.fn());
    await Promise.resolve();
    expect(adapter.mount).toHaveBeenCalledWith(element);
    stop();
    stop();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys a late mount after the container was removed', async () => {
    let resolveMount!: (destroy: () => void) => void;
    const pending = new Promise<() => void>((resolve) => { resolveMount = resolve; });
    const destroy = vi.fn();
    const stop = attachDialogue({ mount: () => pending }, createHost().element, vi.fn());
    stop();
    resolveMount(destroy);
    await Promise.resolve();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('reports mount failure but ignores failure after disposal', async () => {
    const failure = new Error('unavailable');
    const onError = vi.fn();
    const adapter: DialogueAdapter = { mount: async () => { throw failure; } };
    attachDialogue(adapter, createHost().element, onError);
    await Promise.resolve();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    onError.mockClear();
    attachDialogue(adapter, createHost().element, onError)();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });

  it('delivers an immutable exact draft reference across the event boundary', () => {
    const target = new EventTarget();
    const detail = { draftId: 'draft/revision-17' };
    const received = vi.fn();
    const listener = (event: Event) => received(readDraftSavedDetail(event));
    target.addEventListener(DRAFT_SAVED_EVENT, listener);
    target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail }));
    detail.draftId = 'draft/revision-18';
    const snapshot = received.mock.calls[0]?.[0];
    expect(snapshot).toEqual({ draftId: 'draft/revision-17' });
    expect(Object.isFrozen(snapshot)).toBe(true);
    target.removeEventListener(DRAFT_SAVED_EVENT, listener);
    target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail }));
    expect(received).toHaveBeenCalledTimes(1);
  });

  it.each([
    null, undefined, {}, { draftId: 42 }, { draftId: '' }, { draftId: '  ' },
    { draftId: ' draft-1' }, { draftId: 'draft-1', pageDocument: {} },
    { draftId: 'a'.repeat(513) }, { draftId: 'draft\u0000-1' }
  ])(
    'rejects an invalid draft event payload: %j', (detail) => {
      expect(readDraftSavedDetail(new CustomEvent(DRAFT_SAVED_EVENT, { detail }))).toBeNull();
    }
  );

  it('rejects other events and events without detail', () => {
    expect(readDraftSavedDetail(new CustomEvent('other', { detail: { draftId: 'draft-1' } }))).toBeNull();
    expect(readDraftSavedDetail(new Event(DRAFT_SAVED_EVENT))).toBeNull();
  });

  it('compiles the injectable container for client and server', () => {
    const file = new URL('../src/lib/dialogue/PanguDialogue.svelte', import.meta.url);
    const source = readFileSync(file, 'utf8');
    for (const generate of ['client', 'server'] as const) {
      expect(() => compile(source, { filename: file.pathname, generate })).not.toThrow();
    }
  });
});
