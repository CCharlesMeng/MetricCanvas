function composedParent(node:HTMLElement):HTMLElement|undefined {
  if(node.assignedSlot)return node.assignedSlot;
  if(node.parentElement)return node.parentElement;
  const root=node.getRootNode();
  return root instanceof ShadowRoot?root.host as HTMLElement:undefined;
}
function scrollBoundary(anchor:HTMLElement):HTMLElement|undefined {
  for(let node=composedParent(anchor);node;node=composedParent(node)){
    if(/auto|scroll/.test(getComputedStyle(node).overflowY))return node;
  }
  return undefined;
}
function closePopovers(content:HTMLElement):void {
  for(const details of content.querySelectorAll('details[open]'))details.removeAttribute('open');
}
function scrollportTop(boundary: HTMLElement | undefined): number {
  if (!boundary) return 0;
  const rect = boundary.getBoundingClientRect();
  const scaleY = boundary.offsetHeight ? rect.height / boundary.offsetHeight : 1;
  return rect.top + boundary.clientTop * scaleY;
}

function nativeStickySection(anchor: HTMLElement, boundary: HTMLElement | undefined): HTMLElement | undefined {
  const section = anchor.closest<HTMLElement>('[data-ioc-dedicated-header]');
  if (!section || scrollBoundary(section) !== boundary) return;
  // A hidden overflow box is a CSS scroll container even when it cannot follow the host scroll.
  for (let node = composedParent(section); node && node !== boundary; node = composedParent(node)) {
    if (getComputedStyle(node).overflowY === 'hidden') return;
  }
  return section;
}

function updateNativeHeader(section: HTMLElement, content: HTMLElement, top: number, scrollTop: number): boolean {
  const canPin = top >= 0;
  if (section.hasAttribute('data-ioc-native-sticky') !== canPin) {
    section.toggleAttribute('data-ioc-native-sticky', canPin);
    content.style.removeProperty('top');
  }
  if (!canPin) return false;

  // CSS owns the position. The scroll handler only publishes the pinned state.
  const rect = section.getBoundingClientRect();
  if (scrollTop > 0 && rect.top <= top + 0.5 && rect.bottom > top) content.dataset.iocFloating = 'true';
  else delete content.dataset.iocFloating;
  return true;
}

export function attachHeaderFrame(anchor:HTMLElement,content:HTMLElement):()=>void {
  const root=anchor.closest<HTMLElement>('.runtime-view');
  if(!root)return ()=>{};
  const boundary = scrollBoundary(anchor);
  const win = anchor.ownerDocument.defaultView;
  const nativeSection = nativeStickySection(anchor, boundary);
  let frame=0,disposed=false;
  const restore = () => {
    delete content.dataset.iocFloating;
    content.style.removeProperty('top');
  };
  const update = () => {
    frame = 0;
    if (disposed) return;
    if (!anchor.isConnected || anchor.getClientRects().length === 0) {
      restore();
      closePopovers(content);
      return;
    }
    const edge = scrollportTop(boundary);
    if (nativeSection && updateNativeHeader(nativeSection, content, edge, boundary?.scrollTop ?? win?.scrollY ?? 0)) return;

    const rect = anchor.getBoundingClientRect();
    const bottom = root.getBoundingClientRect().bottom;
    const top = Math.max(0, edge);
    if (rect.top >= top || bottom <= top || rect.height === 0) {
      restore();
      return;
    }
    // The in-flow anchor keeps its unshifted geometry. Convert the viewport delta to local CSS pixels.
    const layoutHeight = parseFloat(getComputedStyle(anchor).height) || rect.height;
    const scaleY = rect.height / layoutHeight;
    const pinnedTop = Math.min(top, bottom - rect.height);
    content.style.top = `${(pinnedTop - rect.top) / scaleY}px`;
    content.dataset.iocFloating = 'true';
  };
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(update);};
  const onscroll=()=>{cancelAnimationFrame(frame);update();};
  const resize=new ResizeObserver(schedule);resize.observe(anchor);resize.observe(content);resize.observe(root);
  const mutations=new MutationObserver(schedule);mutations.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  // Update at window capture. Scroll events inside a ShadowRoot also need a direct listener.
  win?.addEventListener('scroll', onscroll, true);
  win?.addEventListener('resize', schedule);
  boundary?.addEventListener('scroll',onscroll);
  if(boundary)resize.observe(boundary);
  update();
  return ()=>{
    disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();
    win?.removeEventListener('scroll', onscroll, true);
    win?.removeEventListener('resize', schedule);
    boundary?.removeEventListener('scroll',onscroll);
    if (nativeSection) delete nativeSection.dataset.iocNativeSticky;
    restore();closePopovers(content);
  };
}

/** A hidden mounted group must also dispose its controls, including their popover listeners. */
export function watchHeaderVisibility(anchor:HTMLElement,onchange:(visible:boolean)=>void):()=>void {
  const root=anchor.closest('.runtime-view');
  if(!root)return ()=>{};
  const update=()=>onchange(anchor.getClientRects().length>0);
  const observer=new MutationObserver(update);
  observer.observe(root,{subtree:true,attributes:true,attributeFilter:['hidden']});
  update();return ()=>observer.disconnect();
}
