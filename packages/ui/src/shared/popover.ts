/** Private top-layer geometry; the panel always remains in its original DOM root. */
export function popoverPosition(anchor:HTMLElement,panel:HTMLElement) {
 const win=anchor.ownerDocument.defaultView!;const viewport=win.visualViewport;
 const x=viewport?.offsetLeft??0,y=viewport?.offsetTop??0;
 const width=viewport?.width??win.innerWidth,height=viewport?.height??win.innerHeight;
 const rect=anchor.getBoundingClientRect();const panelRect=panel.getBoundingClientRect();
 const panelWidth=Math.min(panelRect.width||rect.width,width-16);
 const panelHeight=Math.min(panel.scrollHeight,height-16);
 return {left:Math.max(x+8,Math.min(rect.left,x+width-panelWidth-8)),top:rect.bottom+4+panelHeight<=y+height-8?rect.bottom+4:Math.max(y+8,rect.top-panelHeight-4),width:Math.min(rect.width,width-16),visible:rect.bottom>=y&&rect.top<=y+height&&rect.right>=x&&rect.left<=x+width};
}
export function observePopover(anchor:HTMLElement,place:()=>void) {
 const doc=anchor.ownerDocument,win=doc.defaultView!;
 doc.addEventListener('scroll',place,true);win.addEventListener('resize',place);
 win.visualViewport?.addEventListener('resize',place);win.visualViewport?.addEventListener('scroll',place);
 const observer=new ResizeObserver(place);observer.observe(anchor);
 return()=>{doc.removeEventListener('scroll',place,true);win.removeEventListener('resize',place);win.visualViewport?.removeEventListener('resize',place);win.visualViewport?.removeEventListener('scroll',place);observer.disconnect();};
}
export function movePopoverFocus(event:KeyboardEvent,panel:HTMLElement) {
 if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return false;
 event.preventDefault();const items=[...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
 if(!items.length)return true;const current=items.indexOf(event.target as HTMLButtonElement);
 const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
 items[index]?.focus();return true;
}
