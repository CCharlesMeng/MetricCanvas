import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '../src/validate';

const example = () => JSON.parse(readFileSync('packages/page/tests/fixtures/metric-before-legacy.json', 'utf8'));
const cards = (page: ReturnType<typeof example>) => page.sections.find((section: {id:string}) => section.id === 'equation').components;

describe('指标卡前置连接文字', () => {
  it('验收原有声明：四张卡各占三列，连接文字不再作为组件占列', () => {
    const page = example(), original = structuredClone(page);
    expect(parsePage(page).ok).toBe(true);
    expect(cards(page).map((card: {layout:{span:number}}) => card.layout.span)).toEqual([3,3,3,3]);
    expect(cards(page).map((card: {layout:{before?:{text:string}}}) => card.layout.before?.text)).toEqual([undefined,'=','+','+']);
    expect(page).toEqual(original);
  });
  it.each([4,8,12,16,24,undefined])('支持受控间距 %s', gap => {
    const page=example(); cards(page)[1].layout.before.gap=gap;
    expect(parsePage(page).ok).toBe(true);
  });
  it.each([-1,0,7,32,'8','8px'])('拒绝非法间距 %s', gap => {
    const page=example(); cards(page)[1].layout.before.gap=gap;
    expect(parsePage(page).ok).toBe(false);
  });
  it.each(['report','tracks','nested','panel','backdrop','connect','span','empty','previous','after','version'])('拒绝超出首期范围：%s', kind => {
    const page=example(), section=page.sections.find((s:{id:string})=>s.id==='equation');
    if(kind==='report')page.layout='report';
    if(kind==='tracks')section.columnTracks=[1,1,1,1];
    if(kind==='panel')section.container='panel';
    if(kind==='backdrop')section.components[0].layout.layer='backdrop';
    if(kind==='connect')section.components[0].layout.connectPrevious=true;
    if(kind==='span')section.components[0].layout.span=4;
    if(kind==='empty')section.components[1].layout.before.text='   ';
    if(kind==='previous')section.components[0]={id:'plain',type:'text',layout:{span:3},props:{body:'正文'}};
    if(kind==='after')section.components[0].layout.after={text:'+'};
    if(kind==='version')page.schemaVersion='6.33';
    if(kind==='nested')section.components=[{id:'nested',type:'compositeCard',layout:{span:12},props:{components:section.components}}];
    expect(parsePage(page).ok).toBe(false);
    if(kind==='version')expect(validate(page).some(error=>error.path.endsWith('/layout/before'))).toBe(true);
  });
  it('缺失可选参数只移除对应连接，不删除指标卡或改写原文', () => {
    const page=example(); page.params=[{id:'connector',type:'string',required:false}];
    cards(page)[1].layout.before.text={param:'connector'};
    const parsed=parsePage(page);
    expect(parsed.ok).toBe(true); if(!parsed.ok)return;
    const section=parsed.page.sections.find(s=>s.id==='equation')!;
    expect(section.components).toHaveLength(4);
    expect(section.components[1].layout).not.toHaveProperty('before');
    expect(cards(page)[1].layout.before.text).toEqual({param:'connector'});
  });
  it('首卡 before 保留声明，实际是否显示由相邻排布决定', () => {
    const page=example(); cards(page)[0].layout.before={text:'其中'};
    expect(parsePage(page).ok).toBe(true);
  });
});
