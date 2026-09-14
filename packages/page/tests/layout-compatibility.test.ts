import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizePageDocument, parsePage, validate, canonicalizeJson } from '../src/index';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/contract-valid/${name}.json`, import.meta.url), 'utf8'));

describe('6.1 layout 兼容公开边界', () => {
  for (const schemaVersion of ['6.0', '6.1']) {
    for (const form of ['report', 'dashboard']) {
      it(`${schemaVersion} layoutForm ${form} 保持布局且只写新版`, () => {
        const input = { ...fixture('inline-report'), schemaVersion, layoutForm: form };
        const before = canonicalizeJson(input);
        const result = normalizePageDocument(input);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.document).toEqual({ ...fixture('inline-report'), schemaVersion: '6.1', layout: form });
        expect(parsePage(input)).toEqual(parsePage(result.document));
        expect(normalizePageDocument(result.document)).toEqual(result);
        expect(canonicalizeJson(input)).toBe(before);
        expect(result.document).not.toHaveProperty('layoutForm');
      });
    }
    it(`${schemaVersion} 缺省布局规范化为 report`, () => {
      const result = normalizePageDocument({ ...fixture('inline-report'), schemaVersion });
      expect(result).toMatchObject({ ok: true, document: { schemaVersion: '6.1', layout: 'report' } });
    });
  }
  it.each(['report', 'dashboard'])('6.1 layout %s 原生可读', (layout) => {
    const input = fixture(`layout-6-1-${layout}`);
    expect(validate(input)).toEqual([]);
    expect(normalizePageDocument(input)).toMatchObject({ ok: true, document: input });
  });
  it('旧版本不可使用新字段', () => {
    expect(validate({ ...fixture('layout-6-1-dashboard'), schemaVersion: '6.0' })).toEqual([
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/layout' })
    ]);
  });
  it.each(['report', 'dashboard'])('双字段 %s 拒绝，包括同值', (layoutForm) => {
    expect(validate({ ...fixture('layout-6-1-dashboard'), layoutForm })).toEqual([
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/layoutForm' })
    ]);
  });
  it.each(['5.4', '6.2', '7.0', '06.1'])('未知或非规范版本 %s 不得自动升级', (schemaVersion) => {
    const input = { ...fixture('layout-6-1-dashboard'), schemaVersion };
    expect(normalizePageDocument(input)).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '/schemaVersion' })] });
  });
  it.each(['grouped-fields-page', 'params-page', 'query-dashboard'])('规范化 %s 不物化业务字段/引用/原始行且支持 Proxy', (name) => {
    const input = fixture(name);
    const before = JSON.parse(JSON.stringify(input));
    const result = normalizePageDocument(new Proxy(input, {}));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const { schemaVersion: _version, layoutForm: _old, layout: _new, ...content } = result.document;
    const { schemaVersion: _inputVersion, layoutForm: _inputOld, layout: _inputNew, ...original } = before;
    expect(content).toEqual(original);
    expect(input).toEqual(before);
    expect(validate(result.document)).toEqual([]);
  });
});
