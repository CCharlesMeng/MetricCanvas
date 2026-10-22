import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../../../page/src/validate';
import { metricConnectionItems } from '../src/metric-connections';
function cards() {
  const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/layout/metric-card-equation.json','utf8')));
  if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
  return parsed.page.sections.find(section=>section.id==='equation')!.components.filter(component=>component.type==='metricCard');
}
it('四卡连接保持原组件身份、索引与整行十二列',()=>{
  const source=cards(), items=metricConnectionItems(source);
  expect(items).toHaveLength(1);expect(items[0].span).toBe(12);
  expect(items[0].members.map(member=>member.index)).toEqual([0,1,2,3]);
  expect(items[0].members[2].component).toBe(source[2]);
});
it('隐藏只检查原相邻端点，不把第三张卡的符号连到第一张卡',()=>{
  const source=cards(), items=metricConnectionItems(source,new Set([source[0].id,source[2].id,source[3].id]));
  expect(items.map(item=>item.members.map(member=>member.index))).toEqual([[0],[2,3]]);
});
it('无连接声明的组件保持原来的单元格和跨度',()=>{
  const source=cards().map(component=>({...component,layout:{span:3}}));
  expect(metricConnectionItems(source).map(item=>({span:item.span,count:item.members.length})))
    .toEqual(Array.from({length:4},()=>({span:3,count:1})));
});
