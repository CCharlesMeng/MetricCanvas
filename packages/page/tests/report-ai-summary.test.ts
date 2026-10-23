import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/capabilities/ai-summary/report-ai-summary.json';
import { validate } from '../src/internal';

describe('Report summary modes', () => {
  it('accepts provided and generated modes including section inference', () => {
    expect(validate(fixture)).toEqual([]);
  });
  it('rejects Dashboard, unknown sections, absent scope and invalid mode combinations', () => {
    const dashboard = structuredClone(fixture); dashboard.layout = 'dashboard';
    expect(validate(dashboard).some(error => error.message.includes('仅支持 Report'))).toBe(true);
    const unknown = structuredClone(fixture);
    Object.assign(unknown.sections[2]!.components[1]!.props, { relatedSections: ['unknown'] });
    expect(validate(unknown).some(error => error.message.includes('未知内容分区'))).toBe(true);
    const absent = structuredClone(fixture);
    Reflect.deleteProperty(absent.sections[2]!.components[1]!.props, 'relatedSections');
    expect(validate(absent).some(error => error.message.includes('需要 relatedData'))).toBe(true);
    const mixed = structuredClone(fixture);
    Object.assign(mixed.sections[1]!.components[0]!.props, { promptTemplate: '不应调用' });
    expect(validate(mixed).some(error => error.message.includes('不能同时声明生成输入'))).toBe(true);
  });
  it('declares the capability version floor', () => {
    const old = { ...fixture, schemaVersion: '6.50' };
    expect(validate(old).some(error => error.message.includes('6.51'))).toBe(true);
  });
  it('validates direct source references and their version floor', () => {
    const unknown = structuredClone(fixture);
    Object.assign(unknown.sections[3]!.components[1]!.props, { relatedDataSource: ['missing'] });
    expect(validate(unknown)).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/1/props/relatedDataSource/0', message: '关联数据引用了未知数据源:missing'
    }));
    const duplicate = structuredClone(fixture);
    Object.assign(duplicate.sections[3]!.components[1]!.props, { relatedDataSource: ['comparison', 'comparison'] });
    expect(validate(duplicate).some(error => error.message.includes('数据源引用不能重复'))).toBe(true);
    const empty = structuredClone(fixture);
    Object.assign(empty.sections[3]!.components[1]!.props, { relatedDataSource: [] });
    expect(validate(empty).length).toBeGreaterThan(0);
    expect(validate({ ...fixture, schemaVersion: '6.51' }).some(error => error.message.includes('6.52'))).toBe(true);
  });
  it('rejects direct sources in provided mode and mixed legacy declarations', () => {
    const provided = structuredClone(fixture);
    Object.assign(provided.sections[1]!.components[0]!.props, { relatedDataSource: ['comparison'] });
    expect(validate(provided).some(error => error.message.includes('不能同时声明生成输入'))).toBe(true);
    const mixed = structuredClone(fixture);
    Object.assign(mixed.sections[3]!.components[1]!.props, { relatedData: {
      legacy: { source: 'comparison', description: '旧来源', fields: [{ field: 'tokens', term: 'Tokens' }] }
    } });
    expect(validate(mixed).some(error => error.message.includes('不能与旧 relatedData 同时声明'))).toBe(true);
  });
  it('counts direct summary references when checking query pagination ownership', () => {
    const document = structuredClone(fixture);
    Object.assign(document.sections[3]!.components[0]!.props, { pagination: { mode: 'query' } });
    Object.assign(document.dataSources.comparison.source.query.body.dsl_list[0]!.order, { offset: 0, limit: 20 });
    expect(validate(document)).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/0/data/main',
      message: '查询分页表格必须独占页面数据源 comparison，当前引用 2 次'
    }));
  });
});
