import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/report-pdf-export.json';
import { parsePage } from '../src';

describe('Report 内置 PDF 配置', () => {
  it('直接消费作者页面，允许日期、自定义文字、默认按钮及未启用对照', () => {
    expect(parsePage(fixture).ok).toBe(true);
  });
  it('6.27不能声明6.28的PDF能力，去掉新字段后仍可读取', () => {
    const page = structuredClone(fixture) as any;
    page.schemaVersion = '6.27';
    expect(parsePage(page).ok).toBe(false);
    for (const section of page.sections) for (const component of section.components) delete component.props.pdfExport;
    expect(parsePage(page).ok).toBe(true);
  });
  it('拒绝Dashboard下载工具带、空按钮名称及未知编码配置', () => {
    const dashboard = structuredClone(fixture) as any;
    dashboard.layout = 'dashboard';
    delete dashboard.sections[0].components[0].props.filterIds;
    expect(parsePage(dashboard).ok).toBe(false);
    for (const change of [{label:''}, {filename:''}, {encoder:'external'}]) {
      const page = structuredClone(fixture) as any;
      page.sections[0].components[0].props.pdfExport = change;
      expect(parsePage(page).ok).toBe(false);
    }
  });
});
