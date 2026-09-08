/** 只隔离平台内部背景，不锁定集成门户的 body，也不进入浏览器顶层。 */
export function activateApplicationModal(overlay: HTMLElement, onclose: () => void): () => void {
  const root = overlay.closest<HTMLElement>('.platform-app');
  const previousFocus = overlay.ownerDocument.activeElement;
  const inertElements: Array<{ element: HTMLElement; inert: boolean }> = [];
  for (let branch: HTMLElement | null = overlay; root && branch && branch !== root; branch = branch.parentElement) {
    for (const sibling of branch.parentElement?.children ?? []) {
      if (sibling !== branch && sibling instanceof HTMLElement) {
        inertElements.push({ element: sibling, inert: sibling.inert });
        sibling.inert = true;
      }
    }
  }
  const main = root?.querySelector<HTMLElement>('.shell-main');
  const previousOverflow = main?.style.overflow ?? '';
  if (main) main.style.overflow = 'hidden';

  function focusable(): HTMLElement[] {
    return Array.from(overlay.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
    )).filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'));
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    } else if (event.key === 'Tab') {
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && overlay.ownerDocument.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && overlay.ownerDocument.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  overlay.addEventListener('keydown', keydown);
  focusable()[0]?.focus();
  return () => {
    overlay.removeEventListener('keydown', keydown);
    for (const { element, inert } of inertElements) element.inert = inert;
    if (main) main.style.overflow = previousOverflow;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
}
