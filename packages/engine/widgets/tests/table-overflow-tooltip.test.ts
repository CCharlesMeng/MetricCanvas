import { describe, expect, it, vi } from 'vitest';
import { hasCellOverflow, overflowTooltip } from '../src/components/table/overflow-tooltip';

function fixture(rect = { left: 700, right: 800, top: 550, bottom: 571 }) {
  const win = Object.assign(new EventTarget(), { innerWidth: 800, innerHeight: 600 });
  const doc = Object.assign(new EventTarget(), { defaultView: win });
  const anchor = Object.assign(new EventTarget(), {
    scrollWidth: 400, clientWidth: 100, scrollHeight: 21, clientHeight: 21,
    getBoundingClientRect: () => rect
  });
  let opened = false;
  const panel = Object.assign(new EventTarget(), {
    textContent: '', style: { left: '', top: '' },
    matches: () => opened,
    showPopover: vi.fn(() => { opened = true; }),
    hidePopover: vi.fn(() => { opened = false; }),
    contains: (target: EventTarget) => target === panel,
    getBoundingClientRect: () => ({ width: 300, height: 100 })
  });
  const root = Object.assign(new EventTarget(), {
    ownerDocument: doc,
    querySelector: (selector: string) => selector === '.cell-text' ? anchor : panel
  });
  return { anchor, panel, root, doc, win, action: overflowTooltip(root as unknown as HTMLElement, '审批意见全文\n最终结论') };
}

describe('table overflow tooltip', () => {
  it('uses rendered overflow instead of a character-count threshold', () => {
    expect(hasCellOverflow({ scrollWidth: 80, clientWidth: 80, scrollHeight: 21, clientHeight: 21 })).toBe(false);
    expect(hasCellOverflow({ scrollWidth: 81, clientWidth: 80, scrollHeight: 21, clientHeight: 21 })).toBe(true);
  });

  it('shows plain full text on hover, fits the viewport and closes on data changes', () => {
    const { anchor, panel, action } = fixture();
    anchor.dispatchEvent(new Event('mouseenter'));
    expect(panel.showPopover).toHaveBeenCalledOnce();
    expect(panel.textContent).toBe('审批意见全文\n最终结论');
    expect(panel.style).toEqual({ left: '492px', top: '492px' });
    action.update('<script>原样文本</script>');
    expect(panel.hidePopover).toHaveBeenCalledOnce();
    anchor.dispatchEvent(new Event('mouseenter'));
    expect(panel.textContent).toBe('<script>原样文本</script>');
    action.destroy();
    anchor.dispatchEvent(new Event('mouseenter'));
    expect(panel.showPopover).toHaveBeenCalledTimes(2);
  });

  it('places the tooltip on the right when space permits', () => {
    const { anchor, panel, action } = fixture({ left: 100, right: 200, top: 50, bottom: 71 });
    anchor.dispatchEvent(new Event('mouseenter'));
    expect(panel.style).toEqual({ left: '206px', top: '10.5px' });
    action.destroy();
  });

  it('keeps the last-column tooltip at the right viewport edge instead of flipping left', () => {
    const { anchor, panel, action } = fixture({ left: 100, right: 800, top: 50, bottom: 71 });
    anchor.dispatchEvent(new Event('mouseenter'));
    expect(panel.style.left).toBe('492px');
    action.destroy();
  });

  it('ignores short cells and dismisses on pointer leave, scroll and resize', () => {
    vi.useFakeTimers();
    const { anchor, panel, doc, win, action } = fixture();
    anchor.scrollWidth = 100;
    anchor.dispatchEvent(new Event('mouseenter'));
    expect(panel.showPopover).not.toHaveBeenCalled();
    anchor.scrollWidth = 400;
    anchor.dispatchEvent(new Event('mouseenter'));
    anchor.dispatchEvent(new Event('mouseleave'));
    panel.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(150);
    expect(panel.hidePopover).not.toHaveBeenCalled();
    panel.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(150);
    expect(panel.hidePopover).toHaveBeenCalledOnce();
    anchor.dispatchEvent(new Event('mouseenter'));
    doc.dispatchEvent(new Event('scroll'));
    anchor.dispatchEvent(new Event('mouseenter'));
    win.dispatchEvent(new Event('resize'));
    expect(panel.hidePopover).toHaveBeenCalledTimes(3);
    action.destroy();
    vi.useRealTimers();
  });
});
