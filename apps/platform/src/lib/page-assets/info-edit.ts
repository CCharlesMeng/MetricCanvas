import type {PageInfoRecord,PageInfoChanges} from '../integration/contract';
export function infoChanges(before:PageInfoRecord,after:PageInfoRecord,replaceBoundTitle=false):PageInfoChanges {
  return {...(after.title!==before.title?{title:after.title,replaceBoundTitle}:{}),
    ...(after.description!==before.description?{description:after.description}:{}),
    ...(after.accessPath!==before.accessPath?{accessPath:after.accessPath}: {})};
}
export function validateInfo(record:PageInfoRecord):string {
  if(!record.title.trim())return '请填写页面标题。';
  if(record.accessPath===undefined)return '';
  try {
    const url=new URL(record.accessPath,'https://page.invalid');
    if(url.origin!=='https://page.invalid'||!record.accessPath.startsWith('/')||record.accessPath.startsWith('//'))return '请填写以 / 开始的站内访问路径。';
    const ids=[...url.searchParams.getAll('pageId'),...url.searchParams.getAll('page')];
    if(ids.length!==1||ids[0]!==record.pageId)return '访问路径须保留当前页面 ID。';
  } catch{return '访问路径格式无效。';}
  return '';
}
