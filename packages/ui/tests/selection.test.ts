import {describe,it,expect} from 'vitest';
import {selectionNodes,flattenNodes,filterNodes,toggleSelection,selectionState} from '../src/components/select/selection';
const tree=selectionNodes([{value:'CN',label:'中国地区部',children:[{value:'SZ',label:'深圳代表处'},{value:'BJ',label:'北京代表处'}]},{value:'EU',label:'欧洲地区部'}]);
describe('selection rules',()=>{
 it('searches names, codes and paths without mutating source',()=>{
  expect(flattenNodes(filterNodes(tree,' sz ')).map(n=>n.value)).toEqual(['CN','SZ']);
  expect(flattenNodes(filterNodes(tree,'中国')).map(n=>n.value)).toEqual(['CN','SZ','BJ']);
  expect(flattenNodes(tree)).toHaveLength(4);
 });
 it('single commits own stable value, never descendants',()=>{
  expect(toggleSelection(['SZ'],tree[0],false,'descendants')).toEqual(['CN']);
  expect(toggleSelection(['SZ'],tree[0],false,'leaf')).toEqual(['SZ']);
 });
 it('independent, descendants and leaf are distinct contracts',()=>{
  expect(toggleSelection([],tree[0],true,'independent')).toEqual(['CN']);
  expect(toggleSelection([],tree[0],true,'descendants')).toEqual(['CN','SZ','BJ']);
  expect(toggleSelection([],tree[0],true,'leaf')).toEqual(['SZ','BJ']);
  expect(selectionState(tree[0],['SZ'],'descendants').partial).toBe(true);
  expect(toggleSelection(['EU','CN','SZ','BJ'],tree[0],true,'descendants')).toEqual(['EU']);
 });
 it('structural and disabled nodes cannot invent a business value',()=>{
  const [node]=selectionNodes([{value:'structure:CN',label:'中国',selectable:false,children:[{value:'SZ',label:'深圳'},{value:'BJ',label:'北京',disabled:true}]}]);
  expect(toggleSelection([],node,false,'independent')).toEqual([]);
  expect(toggleSelection([],node,true,'descendants')).toEqual(['SZ']);
 });
});
