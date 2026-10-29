import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {validate} from '../src/validate';
import {computeDependencies, computeOutputFields} from '../src/compute';

const fixture = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/union-keys-demo.json',import.meta.url),'utf8'));

describe('6.74 组织键并集协议', () => {
  it('接受正式 sources/keys 声明，并把所有依赖及产出键纳入图', () => {
    const page = fixture();
    expect(validate(page)).toEqual([]);
    expect(page.dataSources.combined.compute[0]).toEqual({op:'unionKeys',sources:['a','b'],keys:['org']});
    expect(computeDependencies(page.dataSources.combined.compute)).toEqual(['a','b']);
    expect(computeOutputFields(page.dataSources.combined.compute)).toEqual(['org','a','b','total']);
    expect(validate({...page,schemaVersion:'6.73'}).some(e=>e.message.includes('6.74'))).toBe(true);
  });
  it.each([
    ['未知源', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute[0].sources.push('missing')],
    ['自循环', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute[0].sources.push('combined')],
    ['重复源', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute[0].sources.push('a')],
    ['空源', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute[0].sources=[]],
    ['重复键', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute[0].keys.push('org')],
    ['无键', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute[0].keys=[]],
    ['错误属性名', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute[0].source='a'],
    ['键类型失配', (p: ReturnType<typeof fixture>) => p.dataSources.b.fields.org.type='number'],
    ['键角色失配', (p: ReturnType<typeof fixture>) => p.dataSources.b.fields.org.role='measure'],
    ['伪造输入行', (p: ReturnType<typeof fixture>) => p.dataSources.combined.source.rows.push({org:'假行'})],
    ['非首位算子', (p: ReturnType<typeof fixture>) => p.dataSources.combined.compute.reverse()]
  ])('拒绝%s', (_, change) => {const page=fixture(); change(page); expect(validate(page).length).toBeGreaterThan(0);});
  it('查询依赖须完整，窗口查询不可进入组织并集', () => {
    const page=fixture();
    page.dataSources.a.fields.org.queryField='组织';
    page.dataSources.a.fields.value.queryField='得分';
    page.dataSources.a.source={type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['组织'],output_metrics:['得分']}]}}};
    expect(validate(page).some(e=>e.message.includes('完整行集'))).toBe(true);
    page.dataSources.a.source.resultScope='complete';
    expect(validate(page)).toEqual([]);
    page.dataSources.a.source.query.body.dsl_list[0].order={limit:1};
    expect(validate(page).some(e=>e.message.includes('完整行集'))).toBe(true);
  });
});
