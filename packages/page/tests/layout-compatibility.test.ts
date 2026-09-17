import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizePageDocument, parsePage, validate, canonicalizeJson } from '../src/index';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/contract-valid/${name}.json`, import.meta.url), 'utf8'));
const legacyBase = () => { const { layout: _layout, ...base } = fixture('inline-report'); return base; };

describe('6.1 layout 兼容公开边界', () => {
  for (const schemaVersion of ['6.0', '6.1']) {
    for (const form of ['report', 'dashboard']) {
      it(`${schemaVersion} layoutForm ${form} 保持布局且只写新版`, () => {
        const input = { ...legacyBase(), schemaVersion, layoutForm: form };
        const before = canonicalizeJson(input);
        const result = normalizePageDocument(input);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(result.document).toEqual({ ...legacyBase(), schemaVersion: '6.1', layout: form });
        expect(parsePage(input)).toEqual(parsePage(result.document));
        expect(normalizePageDocument(result.document)).toEqual(result);
        expect(canonicalizeJson(input)).toBe(before);
        expect(result.document).not.toHaveProperty('layoutForm');
      });
    }
    it(`${schemaVersion} 缺省布局规范化为 report`, () => {
      const result = normalizePageDocument({ ...legacyBase(), schemaVersion });
      expect(result).toMatchObject({ ok: true, document: { schemaVersion: '6.1', layout: 'report' } });
    });
  }
  it.each(['report', 'dashboard'])('6.1 layout %s 原生可读', (layout) => {
    const input = fixture(`layout-6-1-${layout}`);
    expect(validate(input)).toEqual([]);
    expect(normalizePageDocument(input)).toMatchObject({ ok: true, document: { ...input, schemaVersion: '6.1' } });
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
  it.each(['4.0', '5.5', '6.5', '7.0', '06.1'])('未知或非规范版本 %s 不得自动升级', (schemaVersion) => {
    const input = { ...fixture('layout-6-1-dashboard'), schemaVersion };
    expect(normalizePageDocument(input)).toMatchObject({ ok: false, errors: [expect.objectContaining({ path: '/schemaVersion' })] });
  });
  it.each(['5.0', '5.1', '5.2', '5.3', '5.4'])('%s 通过当前结构校验并规范化为 6.1 的唯一写出形状', (schemaVersion) => {
    const { layout: _layout, ...legacyContent } = fixture('inline-report');
    const result = normalizePageDocument({ ...legacyContent, schemaVersion });
    expect(result).toMatchObject({
      ok: true,
      document: { ...legacyContent, schemaVersion: '6.1', layout: 'report' }
    });
  });
  it('5.4 的完整站内导航规范化为 6.x 普通 URL 导航，且不改写输入', () => {
    const document = {
      schemaVersion: '5.4', id: 'legacy',
      dataSources: { values: { fields: {
        code: { type: 'string', role: 'dimension' },
        amount: { type: 'number', role: 'measure' }
      }, source: { type: 'inline', rows: [{ code: 'CN', amount: 1 }] } } },
      filters: [{ id: 'region', type: 'dimension', dimension: 'region', default: ['CN'] }],
      sections: [{ id: 'main', components: [{
        id: 'chart', type: 'barChart', layout: { span: 12 }, data: { main: 'values' }, props: {
          categoryField: 'code', series: [{ field: 'amount' }], actions: [{ on: 'click', navigate: {
            page: 'detail', carryFilters: ['region'], setFilters: { targetRegion: 'code' },
            setParams: { projectCode: { data: 'main', field: 'code' } }
          } }]
        }
      }]}]
    };
    const before = canonicalizeJson(document);
    const result = normalizePageDocument(document);
    if (!result.ok) throw Error(JSON.stringify(result.errors));
    expect(result).toMatchObject({
      ok: true,
      document: {
        schemaVersion: '6.1', layout: 'report',
        sections: [{ components: [{ props: { actions: [{ navigate: {
          href: '/pages/detail', query: {
            region: { source: 'filter', id: 'region' },
            targetRegion: { source: 'row', field: 'code' },
            projectCode: { source: 'row', field: 'code' }
          }
        } }] } }]}]
      }
    });
    expect(canonicalizeJson(document)).toBe(before);
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
