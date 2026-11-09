/** Actual rendered overflow, including preserved line breaks, controls the tooltip. */
export function hasCellOverflow(node: Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'scrollHeight' | 'clientHeight'>): boolean {
  return node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight;
}

/** The popover stays in the cell's root and escapes the table scroll container. */
export function overflowTooltip(root: HTMLElement, text: string) {
  const anchor = root.querySelector<HTMLElement>('.cell-text')!;
  const panel = root.querySelector<HTMLElement>('[role="tooltip"]')!;
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancelClose(): void {
    clearTimeout(timer);
  }
  function close(): void {
    cancelClose();
    if (panel.matches(':popover-open')) panel.hidePopover();
  }
  function position(): void {
    const rect = anchor.getBoundingClientRect();
    const tip = panel.getBoundingClientRect();
    const right = rect.right + 6;
    panel.style.left = `${Math.max(8, Math.min(right, win.innerWidth - tip.width - 8))}px`;
    const centered = (rect.top + rect.bottom - tip.height) / 2;
    panel.style.top = `${Math.max(8, Math.min(centered, win.innerHeight - tip.height - 8))}px`;
  }
  function show(): void {
    cancelClose();
    if (!hasCellOverflow(anchor)) return;
    panel.textContent = text;
    panel.showPopover();
    position();
  }
  function leave(): void {
    cancelClose();
    timer = setTimeout(close, 120);
  }
  function scroll(event: Event): void {
    if (!panel.contains(event.target as Node)) close();
  }
  function keys(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }
  anchor.addEventListener('mouseenter', show);
  anchor.addEventListener('mouseleave', leave);
  root.addEventListener('focusin', show);
  root.addEventListener('focusout', close);
  panel.addEventListener('mouseenter', cancelClose);
  panel.addEventListener('mouseleave', leave);
  doc.addEventListener('keydown', keys);
  doc.addEventListener('scroll', scroll, true);
  win.addEventListener('resize', close);
  return {
    update(value: string) { text = value; close(); },
    destroy() {
      close();
      anchor.removeEventListener('mouseenter', show);
      anchor.removeEventListener('mouseleave', leave);
      root.removeEventListener('focusin', show);
      root.removeEventListener('focusout', close);
      panel.removeEventListener('mouseenter', cancelClose);
      panel.removeEventListener('mouseleave', leave);
      doc.removeEventListener('keydown', keys);
      doc.removeEventListener('scroll', scroll, true);
      win.removeEventListener('resize', close);
    }
  };
}
