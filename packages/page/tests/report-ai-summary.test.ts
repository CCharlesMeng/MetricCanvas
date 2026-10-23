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
});
