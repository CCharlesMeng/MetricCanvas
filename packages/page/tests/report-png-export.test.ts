import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/report-png-export.json';
import longFixture from '../../../pages/report-png-long-export.json';
import legacy from '../fixtures/contract-valid/report-png-export.json';
import fallback from '../../../pages/report-export-scale-fallback.json';
import { parsePage, normalizePageDocument, resolvePageParams } from '../src';

describe('Report 统一导出按钮', () => {
  it('作者页面直接合法，新按钮需要6.31，旧配置继续读取', () => {
    expect(parsePage(fixture).ok).toBe(true);
    expect(parsePage(longFixture).ok).toBe(true);
    expect(parsePage(legacy).ok).toBe(true);
    expect(parsePage({ ...fixture, schemaVersion:'6.30' }).ok).toBe(false);
  });
  it('拒绝其他图片格式、多文件、空名称和旧新混用', () => {
    for (const change of [{format:'jpeg'}, {multiple:true}, {filename:''}, {label:''}]) {
      const page = structuredClone(fixture);
      const props = page.sections[0].components[0].props;
      if (!('exportButtons' in props)) throw Error('Expected exportButtons');
      Object.assign(props.exportButtons[1],change);
      expect(parsePage(page).ok).toBe(false);
    }
    const mixed = structuredClone(fixture);
    Object.assign(mixed.sections[0].components[0].props, {pngExport:{}});
    expect(parsePage(mixed).ok).toBe(false);
    expect(parsePage({ ...longFixture, layout:'dashboard' }).ok).toBe(false);
  });
  it('支持同一配置结构中的自定义名称、不同倍率及已应用期间文件名', () => {
    const result = resolvePageParams(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const header = result.resolvedPage.sections[0].components[0];
    if (header.type !== 'reportHeader') throw Error('Expected reportHeader');
    expect(header.props.exportButtons).toMatchObject([
      {format:'pdf',label:'导出 PDF',scale:2,filename:'经营分析报告-2026-09'},
      {format:'png',scale:3,filename:'经营分析报告-2026-09'}
    ]);
    for (const scale of [2,3,4]) {
      const page=structuredClone(fixture);
      const props=page.sections[0].components[0].props;
      if (!('exportButtons' in props)) throw Error('Expected exportButtons');
      props.exportButtons[0].scale=scale;
      expect(parsePage(page).ok).toBe(true);
    }
  });
});


describe('不支持的清晰度等同未配置', () => {
  it('正常页面与旧配置的完整回退场景可以打开，规范化不改动原始文档', () => {
    const original=structuredClone(fallback);
    const result=normalizePageDocument(fallback);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const headers=result.document.sections.flatMap(section=>section.components).filter(component=>component.type==='reportHeader');
    expect(headers[0].props.exportButtons).toMatchObject([{format:'pdf'},{format:'png'}]);
    for (const button of headers[0].props.exportButtons ?? []) expect(button).not.toHaveProperty('scale');
    expect(headers[1].props.pngExport).not.toHaveProperty('scale');
    expect(normalizePageDocument(result.document)).toEqual(result);
    expect(fallback).toEqual(original);
  });
  it.each([1,0,-1,2.5,99,'3','4','invalid',null,false,[],{}, {param:'not-a-page-param'}])('忽略无效值 %j，保留其余导出配置', scale => {
    const document=structuredClone(fixture);
    const props=document.sections[0].components[0].props;
    if (!('exportButtons' in props)) throw Error('Expected exportButtons');
    props.exportButtons.forEach(button=>Object.assign(button,{scale}));
    expect(resolvePageParams(document).ok).toBe(true);
    const result=normalizePageDocument(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const header=result.document.sections[0].components[0];
    if (header.type!=='reportHeader') throw Error('Expected header');
    const buttons=header.props.exportButtons!;
    expect(buttons[0]).toMatchObject({format:'pdf',label:'导出 PDF'});
    for (const button of buttons) expect(button).not.toHaveProperty('scale');
    const originalButton=props.exportButtons[1];
    if (!('filename' in originalButton)) throw Error('Expected filename');
    expect(buttons[1].filename).toEqual(originalButton.filename);
  });
  it('PNG的2倍回退；PDF的2倍与3/4倍有效值保持', () => {
    const document=structuredClone(fixture);
    const props=document.sections[0].components[0].props;
    if (!('exportButtons' in props)) throw Error('Expected exportButtons');
    props.exportButtons[1].scale=2;
    const parsed=parsePage(document);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    const header=parsed.page.sections[0].components[0];if(header.type!=='reportHeader')throw Error('Expected header');
    expect(header.props.exportButtons?.[0].scale).toBe(2);
    expect(header.props.exportButtons?.[1]).not.toHaveProperty('scale');
  });
});
