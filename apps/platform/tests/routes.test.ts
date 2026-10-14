import {describe,it,expect} from 'vitest';
import {createHref,resolvePlatformRoute,workTaskKey} from '../src/lib/integration/routes';
const url=(path:string)=>new URL(path,'https://portal.test');
describe('platform route contract',()=>{
  it.each(['/metrics','/metrics/','/metrics/ask'])('preserves creation intent through the legacy entry %s',path=>{
    const result=resolvePlatformRoute(url(path+'?page=p&resource=r&info=1'),'/metrics');
    expect(result.url.pathname).toBe('/metrics/create');
    expect(result.route).toMatchObject({kind:'create',pageId:'p',resourceId:'r',showPageInfo:true});
    expect(resolvePlatformRoute(result.url,'/metrics')).toEqual(result);
  });
  it('distinguishes saved reading from editing by path, not reading query flags',()=>{
    expect(resolvePlatformRoute(url('/manage/pages/a%2Fb?resource=r'),'').route).toMatchObject({kind:'reading',pageId:'a/b',resourceId:'r'});
    const edit=resolvePlatformRoute(url('/manage/pages/a%2Fb/edit?resource=r&reading=1&info=1'),'');
    expect(edit.route).toMatchObject({kind:'create',pageId:'a/b',resourceId:'r',showPageInfo:true});
    expect(edit.url.searchParams.has('reading')).toBe(false);
  });
  it('canonicalizes trailing slashes, page numbers and completed new-task intent',()=>{
    expect(resolvePlatformRoute(url('/manage/?page=02&state=draft'),'').url.pathname+resolvePlatformRoute(url('/manage/?page=02&state=draft'),'').url.search).toBe('/manage?page=2&state=draft');
    const task=resolvePlatformRoute(url('/create/?new=1&task=t&page=p'),'');
    expect(task.route).toMatchObject({kind:'create',taskId:'t',newTask:false});
    expect(task.url.searchParams.has('new')).toBe(false);
    if(task.route.kind==='create')expect(workTaskKey(task.route)).toBe('new:t');
  });
  it.each(['/create?task=','/create?page=','/create?page=a&page=b','/create?resource=r','/create?new=0','/create?new=1&page=p','/manage?page=1.5','/manage?page=-1','/manage?state=other','/manage/pages/%E0%A4'])('rejects ambiguous or malformed parameters: %s',path=>{
    expect(resolvePlatformRoute(url(path),'').route.kind).toBe('invalid');
  });
  it('keeps opaque identities and unrelated view parameters without cross-prefix rewrites',()=>{
    const target=createHref('/mc',{pageId:'a/b + c',resourceId:'r&1'});
    const parsed=resolvePlatformRoute(url(target+'&filter=x'),'/mc');
    expect(parsed.route).toMatchObject({kind:'create',pageId:'a/b + c',resourceId:'r&1'});
    expect(parsed.url.searchParams.get('filter')).toBe('x');
    expect(resolvePlatformRoute(url('/mc-other/ask'),'/mc').url.pathname).toBe('/mc-other/ask');
  });
});
