import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../../page/src/validate';
import { resolveAuthoringSections } from '../src/authoring-layout';
function source(){
  const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/layout/metric-card-equation.json','utf8')));
  if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));return parsed.page.sections;
}
it('搭建草稿重排时只清理断开的连接，原页面保持原样',()=>{
  const sections=source(), original=structuredClone(sections);
  const drafts=sections.map(section=>({id:section.id,title:section.title,container:section.container,
    componentIds:section.id==='equation'?['total-card','service-card','product-card','other-card']:section.components.map(c=>c.id)}));
  const projected=resolveAuthoringSections(sections,drafts).find(s=>s.id==='equation')!;
  expect(projected.components.every(c=>c.type!=='metricCard'||!c.layout.before)).toBe(true);
  expect(sections).toEqual(original);
});
it('无顺序变更时前置连接字段保持',()=>{
  const sections=source();
  const drafts=sections.map(section=>({id:section.id,title:section.title,container:section.container,componentIds:section.components.map(c=>c.id)}));
  expect(resolveAuthoringSections(sections,drafts)).toEqual(sections);
});
