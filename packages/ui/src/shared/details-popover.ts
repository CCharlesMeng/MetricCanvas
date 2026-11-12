import { observePopover, popoverPosition } from './popover';

/** A details menu stays in its DOM root and escapes ancestor scroll clipping. */
export function detailsPopover(details: HTMLDetailsElement) {
  const anchor = details.querySelector<HTMLElement>(':scope > summary')!;
  const panel = anchor.nextElementSibling as HTMLElement;
  panel.popover = 'auto';
  let stop: (() => void) | undefined;

  function position() {
    panel.style.setProperty('--mc-popover-anchor-width', `${anchor.getBoundingClientRect().width}px`);
    const rect = popoverPosition(anchor, panel);
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    if (!rect.visible || details.closest('[inert]')) details.open = false;
  }
  function sync() {
    stop?.();
    stop = undefined;
    if (!details.open) {
      if (panel.matches(':popover-open')) panel.hidePopover();
      return;
    }
    panel.showPopover();
    position();
    stop = observePopover(anchor, position, panel);
  }
  function closed(event: ToggleEvent) {
    if (event.newState === 'closed') details.open = false;
  }
  function keys(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    details.open = false;
    anchor.focus({ preventScroll: true });
  }
  // A constrained panel may keep its size when its options change, so its
  // ResizeObserver alone cannot restore the height after an empty search.
  const contentObserver = new MutationObserver(() => {
    if (details.open) position();
  });
  contentObserver.observe(panel, { childList: true, subtree: true, characterData: true });
  details.addEventListener('toggle', sync);
  details.addEventListener('keydown', keys);
  panel.addEventListener('toggle', closed);
  return { destroy() {
    contentObserver.disconnect();
    details.removeEventListener('toggle', sync);
    details.removeEventListener('keydown', keys);
    panel.removeEventListener('toggle', closed);
    stop?.();
    if (panel.matches(':popover-open')) panel.hidePopover();
  } };
}
