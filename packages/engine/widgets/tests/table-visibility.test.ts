import { afterEach, expect, it, vi } from 'vitest';
import { visibleAfterPaint } from '../src/shared/visible-after-paint';

afterEach(() => vi.unstubAllGlobals());

it('waits for visibility and two animation frames, restarts after enablement, and releases observers on destroy', () => {
  let intersect!: (visible: boolean) => void, sequence = 0;
  const frames = new Map<number, () => void>(), disconnect = vi.fn(), notify = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { intersect = visible => callback([{ isIntersecting: visible }]); }
    observe() {} disconnect = disconnect;
  });
  vi.stubGlobal('requestAnimationFrame', (work: () => void) => { const id = ++sequence; frames.set(id, work); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  function frame() { const [id, work] = [...frames][0]; frames.delete(id); work(); }
  const action = visibleAfterPaint({} as HTMLElement, notify);
  expect(notify).not.toHaveBeenCalled();
  intersect(true); frame(); expect(notify).not.toHaveBeenCalled();
  frame(); expect(notify).toHaveBeenLastCalledWith(true);
  action.update(undefined); expect(notify).toHaveBeenLastCalledWith(false);
  action.update(notify); intersect(true); expect(frames.size).toBe(1);
  frame(); frame(); expect(notify).toHaveBeenLastCalledWith(true);
  intersect(false); expect(notify).toHaveBeenLastCalledWith(false);
  intersect(true); action.destroy(); expect(frames.size).toBe(0); expect(disconnect).toHaveBeenCalledTimes(2);
});
