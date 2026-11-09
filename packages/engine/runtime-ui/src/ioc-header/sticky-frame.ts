/** One mounted Header; the native top layer preserves its DOM, theme and focus. */
function scrollBoundary(anchor:HTMLElement):HTMLElement|undefined {
  for(let node=anchor.parentElement;node;node=node.parentElement){
    if(/auto|scroll/.test(getComputedStyle(node).overflowY))return node;
  }
  return undefined;
}
function closePopovers(content:HTMLElement):void {
  for(const details of content.querySelectorAll('details[open]'))details.removeAttribute('open');
}
function pinHeader(content:HTMLElement,rect:DOMRect,top:number,scale:number):void {
  content.style.cssText=`position:fixed;z-index:66;inset:auto;left:${rect.left}px;top:${top}px;width:${rect.width/scale}px;margin:0;padding:0;border:0;overflow:visible;background:transparent;transform:scale(${scale});transform-origin:top left;`;
  content.popover='manual';
  if(!content.matches(':popover-open'))content.showPopover();
  content.dataset.iocFloating='true';
}
export function attachHeaderFrame(anchor:HTMLElement,content:HTMLElement):()=>void {
  const root=anchor.closest<HTMLElement>('.runtime-view');
  if(!root)return ()=>{};
  const boundary=scrollBoundary(anchor),doc=anchor.ownerDocument;
  let frame=0,disposed=false;
  const restore=()=>{
    if(content.matches(':popover-open'))content.hidePopover();
    content.removeAttribute('popover');
    content.style.cssText='';anchor.style.height='';delete content.dataset.iocFloating;
  };
  const update=()=>{
    frame=0;if(disposed)return;
    if(!anchor.isConnected||anchor.getClientRects().length===0){restore();closePopovers(content);return;}
    const rect=anchor.getBoundingClientRect(),base=root.getBoundingClientRect();
    const top=boundary?Math.max(0,boundary.getBoundingClientRect().top+boundary.clientTop):0;
    if(rect.top>=top||base.bottom<=top){restore();return;}
    const scale=root.offsetWidth?base.width/root.offsetWidth:1;
    anchor.style.height=`${content.offsetHeight}px`;
    const pinned=Math.min(top,base.bottom-content.getBoundingClientRect().height);
    pinHeader(content,rect,pinned,scale);
  };
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(update);};
  const onscroll=()=>{cancelAnimationFrame(frame);update();};
  const resize=new ResizeObserver(schedule);resize.observe(anchor);resize.observe(content);resize.observe(root);
  const mutations=new MutationObserver(schedule);mutations.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  doc.addEventListener('scroll',onscroll,true);doc.defaultView?.addEventListener('resize',schedule);
  update();
  return ()=>{
    disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();
    doc.removeEventListener('scroll',onscroll,true);doc.defaultView?.removeEventListener('resize',schedule);
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
