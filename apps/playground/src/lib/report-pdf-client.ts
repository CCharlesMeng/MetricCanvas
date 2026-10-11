/** Example integrating application: serialize the connected, prepared engine view. */
export async function encodeReportPdf(target: HTMLElement, signal: AbortSignal): Promise<{pdf:Blob;firstPage:string}> {
  signal.throwIfAborted();
  const copy = target.cloneNode(true) as HTMLElement;
  const originals = [target, ...target.querySelectorAll<HTMLElement>('*')];
  const copies = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
  const properties = ['display', 'box-sizing', 'width', 'max-width', 'min-width', 'overflow',
    'position', 'top', 'right', 'bottom', 'left', 'z-index', 'isolation', 'transform', 'object-fit',
    'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-clip',
    '-webkit-background-clip', '-webkit-text-fill-color', '-webkit-text-stroke-width',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'text-align', 'text-decoration', 'white-space', 'word-break', 'overflow-wrap', 'vertical-align',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'border-collapse', 'border-spacing',
    'grid-template-columns', 'grid-column', 'grid-row', 'gap', 'align-items', 'justify-content',
    'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'opacity'];
  originals.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const clone = copies[index];
    clone.removeAttribute('style');
    clone.style.cssText = properties.map(name => `${name}:${computed.getPropertyValue(name)}`).join(';');
    if (element.matches('.report-header, .report-cover')) clone.style.minHeight = computed.minHeight;
    // Static charts need their measured dimensions; other blocks must fragment naturally.
    if (element instanceof HTMLImageElement) {
      clone.style.width = `${element.getBoundingClientRect().width}px`;
      clone.style.height = `${element.getBoundingClientRect().height}px`;
    }
    for (const attribute of Array.from(clone.attributes)) {
      if (attribute.name.startsWith('on')) clone.removeAttribute(attribute.name);
    }
  });
  copy.style.width = '100%';
  copy.style.padding = '0';
  const response = await fetch('/__report-pdf', {
    method: 'POST', headers: { 'Content-Type': 'text/html' }, body: copy.outerHTML, signal
  });
  if (!response.ok) throw new Error(await response.text());
  const payload: {pdf:string;firstPage:string} = await response.json();
  const bytes = Uint8Array.from(atob(payload.pdf), character => character.charCodeAt(0));
  return {pdf:new Blob([bytes],{type:'application/pdf'}),firstPage:`data:image/png;base64,${payload.firstPage}`};
}
