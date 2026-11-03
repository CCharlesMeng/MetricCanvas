/** One mounted Header; only its containing element moves within the same runtime root. */
function scrollBoundary(anchor:HTMLElement):HTMLElement|undefined {
  for(let node=anchor.parentElement;node;node=node.parentElement){
    if(/auto|scroll/.test(getComputedStyle(node).overflowY))return node;
  }
  return undefined;
}
function movePreservingFocus(content:HTMLElement,parent:HTMLElement):void {
  if(content.parentElement===parent)return;
  const active=(content.getRootNode() as Document|ShadowRoot).activeElement;
  parent.append(content);
  if(active instanceof HTMLElement&&content.contains(active))active.focus({preventScroll:true});
}
function closePopovers(content:HTMLElement):void {
  for(const details of content.querySelectorAll('details[open]'))details.removeAttribute('open');
}
export function attachHeaderFrame(anchor:HTMLElement,content:HTMLElement):()=>void {
  const root=anchor.closest<HTMLElement>('.runtime-view');
  if(!root)return ()=>{};
  const boundary=scrollBoundary(anchor),doc=anchor.ownerDocument;
  const portal=anchor.closest<HTMLElement>('.page-content')??root;
  let frame=0,disposed=false;
  const restore=()=>{
    movePreservingFocus(content,anchor);
    content.style.cssText='';anchor.style.height='';delete content.dataset.iocFloating;
  };
  const update=()=>{
    frame=0;if(disposed)return;
    if(!anchor.isConnected||anchor.getClientRects().length===0){restore();closePopovers(content);return;}
    const rect=anchor.getBoundingClientRect(),base=root.getBoundingClientRect();
    const top=boundary?boundary.getBoundingClientRect().top+boundary.clientTop:0;
    if(rect.top>=top||base.bottom<=top){restore();return;}
    const scale=root.offsetWidth?base.width/root.offsetWidth:1;
    anchor.style.height=`${content.offsetHeight}px`;
    movePreservingFocus(content,portal);
    const pinned=Math.min(top,base.bottom-content.getBoundingClientRect().height);
    content.style.cssText=`position:absolute;z-index:66;left:${(rect.left-base.left)/scale+root.scrollLeft}px;top:${(pinned-base.top)/scale+root.scrollTop}px;width:${rect.width/scale}px;`;
    content.dataset.iocFloating='true';
  };
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(update);};
  const resize=new ResizeObserver(schedule);resize.observe(anchor);resize.observe(content);resize.observe(root);
  const mutations=new MutationObserver(schedule);mutations.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  doc.addEventListener('scroll',schedule,true);doc.defaultView?.addEventListener('resize',schedule);
  update();
  return ()=>{
    disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();
    doc.removeEventListener('scroll',schedule,true);doc.defaultView?.removeEventListener('resize',schedule);
    restore();delete content.dataset.iocFloating;closePopovers(content);
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
