type BrowserURL = Pick<Location,'search'|'hash'>;

/** Explicit input, including an empty string, always owns this instance. */
export function resolveInitialSearch(explicit:string|undefined,url:BrowserURL):string{
  if(explicit!==undefined)return explicit.startsWith('?')?explicit.slice(1):explicit;
  const query=new URLSearchParams(url.search);
  const route=/^#!?\/[^?]*\?([^#]*)/.exec(url.hash);
  if(!route)return query.toString();
  const hashQuery=new URLSearchParams(route[1]);
  for(const key of new Set(hashQuery.keys())){
    query.delete(key);
    for(const value of hashQuery.getAll(key))query.append(key,value);
  }
  return query.toString();
}
