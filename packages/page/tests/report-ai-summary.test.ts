import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/capabilities/ai-summary/report-ai-summary.json';
import { validate } from '../src/internal';

function legacyFixture() {
  const document = structuredClone(fixture);
  for (const section of document.sections) {
    for (const component of section.components) {
      if (component.type === 'aiSummary' && Object.hasOwn(component.props, 'body')) Object.assign(component.props, { mode: 'provided' });
    }
  }
  return document;
}

describe('Report summary modes', () => {
  it('accepts provided and generated modes including section inference', () => {
    expect(validate(fixture)).toEqual([]);
  });
  it('authors the plural collection name next to relatedSections', () => {
    const props = fixture.sections[3]!.components[0]!.props;
    expect(props).toHaveProperty('relatedDataSources', ['comparison']);
    expect(Object.hasOwn(props, 'relatedDataSource')).toBe(false);
    expect(Object.hasOwn(fixture.sections[2]!.components[0]!.props, 'relatedSections')).toBe(true);
  });
  it('keeps the published 6.52 spelling readable with its original error path and version floor', () => {
    const document = legacyFixture();
    const props = document.sections[3]!.components[0]!.props;
    Reflect.deleteProperty(props, 'relatedDataSources');
    Object.assign(props, { relatedDataSource: ['comparison'] });
    document.schemaVersion = '6.52';
    expect(validate(document)).toEqual([]);
    expect(validate({ ...document, schemaVersion: '6.51' }).some(error => error.message.includes('6.52'))).toBe(true);
    Object.assign(props, { relatedDataSource: ['missing'] });
    expect(validate(document)).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/0/props/relatedDataSource/0', message: '关联数据引用了未知数据源:missing'
    }));
  });
  it('rejects simultaneous spellings, mistaken names and a scalar instead of an ID array', () => {
    const mixed = structuredClone(fixture);
    Object.assign(mixed.sections[3]!.components[0]!.props, { relatedDataSource: ['comparison'] });
    expect(validate(mixed).some(error => error.message.includes('relatedDataSources 不能与旧 relatedDataSource'))).toBe(true);
    const typo = structuredClone(fixture);
    Object.assign(typo.sections[3]!.components[0]!.props, { relatedDatasources: ['comparison'] });
    expect(validate(typo).length).toBeGreaterThan(0);
    const scalar = structuredClone(fixture);
    Object.assign(scalar.sections[3]!.components[0]!.props, { relatedDataSources: 'comparison' });
    expect(validate(scalar).length).toBeGreaterThan(0);
  });
  it('rejects Dashboard, unknown sections, absent scope and invalid mode combinations', () => {
    const dashboard = structuredClone(fixture); dashboard.layout = 'dashboard';
    expect(validate(dashboard).some(error => error.message.includes('仅支持 Report'))).toBe(true);
    const unknown = structuredClone(fixture);
    Object.assign(unknown.sections[2]!.components[0]!.props, { relatedSections: ['unknown'] });
    expect(validate(unknown).some(error => error.message.includes('未知内容分区'))).toBe(true);
    const absent = structuredClone(fixture);
    Reflect.deleteProperty(absent.sections[2]!.components[0]!.props, 'relatedSections');
    expect(validate(absent).some(error => error.message.includes('需要 relatedData'))).toBe(true);
    const blank = structuredClone(fixture);
    Object.assign(blank.sections[1]!.components[0]!.props, { body: ' \n ' });
    expect(validate(blank).some(error => error.message.includes('非空业务提示词'))).toBe(true);
  });
  it('declares the capability version floor', () => {
    const old = { ...fixture, schemaVersion: '6.50' };
    expect(validate(old).some(error => error.message.includes('6.51'))).toBe(true);
  });
  it('validates direct source references and their version floor', () => {
    const unknown = structuredClone(fixture);
    Object.assign(unknown.sections[3]!.components[0]!.props, { relatedDataSources: ['missing'] });
    expect(validate(unknown)).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/0/props/relatedDataSources/0', message: '关联数据引用了未知数据源:missing'
    }));
    const duplicate = structuredClone(fixture);
    Object.assign(duplicate.sections[3]!.components[0]!.props, { relatedDataSources: ['comparison', 'comparison'] });
    expect(validate(duplicate).some(error => error.message.includes('数据源引用不能重复'))).toBe(true);
    const empty = structuredClone(fixture);
    Object.assign(empty.sections[3]!.components[0]!.props, { relatedDataSources: [] });
    expect(validate(empty).length).toBeGreaterThan(0);
    expect(validate({ ...fixture, schemaVersion: '6.52' }).some(error => error.message.includes('6.53'))).toBe(true);
  });
  it('lets nonblank body take precedence over generation settings and legacy mode', () => {
    const provided = structuredClone(fixture);
    Object.assign(provided.sections[1]!.components[0]!.props, {
      mode: 'generated', relatedDataSources: ['missing'], relatedSections: ['unknown'], promptTemplate: '不会执行',
      relatedData: { ignored: { source: 'missing', description: '不会读取', fields: [{ field: 'unknown', term: '不会使用' }] } }
    });
    expect(validate(provided)).toEqual([]);
    expect(validate({ ...provided, schemaVersion: '6.53' }).some(error => error.message.includes('6.54'))).toBe(true);
  });
  it('keeps source declarations exclusive while generating', () => {
    const mixed = structuredClone(fixture);
    Object.assign(mixed.sections[3]!.components[0]!.props, { relatedData: {
      legacy: { source: 'comparison', description: '旧来源', fields: [{ field: 'tokens', term: 'Tokens' }] }
    } });
    expect(validate(mixed).some(error => error.message.includes('不能与旧 relatedData 同时声明'))).toBe(true);
  });
  it('authors direct body and generation without mode or initial parameters', () => {
    for (const section of fixture.sections) {
      for (const component of section.components) {
        if (component.type !== 'aiSummary') continue;
        expect(Object.hasOwn(component.props, 'mode')).toBe(false);
        expect(Object.hasOwn(component.props, 'initial')).toBe(false);
      }
    }
  });
  it('routes omitted, empty and whitespace body to generation', () => {
    for (const body of [undefined, '', ' \n\t ']) {
      const document = structuredClone(fixture);
      Object.assign(document.sections[2]!.components[0]!.props, { body });
      expect(validate(document)).toEqual([]);
    }
  });
  it('counts direct summary references when checking query pagination ownership', () => {
    const document = structuredClone(fixture);
    Object.assign(document.sections[3]!.components[1]!.props, { pagination: { mode: 'query' } });
    Object.assign(document.dataSources.comparison.source.query.body.dsl_list[0]!.order, { offset: 0, limit: 20 });
    expect(validate(document)).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/1/data/main',
      message: '查询分页表格必须独占页面数据源 comparison，当前引用 2 次'
    }));
    Object.assign(document.sections[3]!.components[0]!.props, { body: '直接展示，无需使用表格查询结果' });
    expect(validate(document)).toEqual([]);
  });
});
