import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/capabilities/filters/report-date-filter-example.json';
import { parsePage, resolvePageParams, normalizePageDocument } from '../src';
import { collectFilterTextValueReferences } from '../src/filter-text-value';
import { resolveParamTextValues, resolveTextValues } from '../src/text-value';

function document(): any { return structuredClone(fixture); }
const title = (raw: any) => raw.sections[0].components[0].props.title;

describe('text composition protocol', () => {
  it('materializes mixed parameters and filters without changing the saved declaration', () => {
    const raw = document();
    const filled = resolvePageParams(raw, { 'report-name': '月度经营报告' });
    if (!filled.ok) throw Error(JSON.stringify(filled.issues));
    expect(title(filled.resolvedPage)).toBe('2026-09 月度经营报告');
    expect(title(filled.document)).toEqual(title(raw));
    const normalized = normalizePageDocument(raw);
    expect(normalized.ok).toBe(true);
    if (normalized.ok) expect(title(normalized.document)).toEqual(title(raw));
  });
  it('gates composition independently of filter references, including literal-only text', () => {
    for (const value of [title(document()), { parts: ['经营', '报告'] }]) {
      const raw = document(); raw.schemaVersion = '6.22';
      raw.sections[0].components[0].props.title = value;
      const result = parsePage(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some(error => error.message.includes('6.23'))).toBe(true);
    }
  });
  it.each([
    { parts: [] }, { parts: [''] }, { parts: [{ parts: ['nested'] }] },
    { parts: Array(65).fill('x') }, { parts: [1] }, { parts: ['x'], separator: ' ' },
    { parts: [{ filter: 'missing' }] }, { parts: [{ param: 'missing' }] },
    { parts: [{ filter: 'report-month', format: 'number-2' }] },
    { parts: [{ filter: 'report-month', param: 'report-name' }] }
  ])('rejects malformed or invalid title composition: %j', value => {
    const raw = document(); raw.sections[0].components[0].props.title = value;
    expect(parsePage(raw).ok).toBe(false);
  });
  it('removes an optional text as a whole when a parameter part is absent, and rejects this in required text', () => {
    const raw = document(); raw.params.display.push({ id: 'optional', type: 'string', required: false });
    const props = raw.sections[0].components[0].props;
    props.subtitle = { parts: ['可选说明：', { param: 'optional' }, { filter: 'report-month', format: 'period' }] };
    props.tags = [props.subtitle, { parts: ['期间：', { filter: 'report-month', format: 'period' }] }];
    const filled = resolvePageParams(raw);
    if (!filled.ok) throw Error(JSON.stringify(filled.issues));
    const header = filled.resolvedPage.sections[0].components[0];
    if (header.type !== 'reportHeader') throw Error('header');
    expect(header.props.subtitle).toBeUndefined();
    expect(header.props.tags).toEqual(['期间：2026-09']);
    props.title = props.subtitle;
    expect(parsePage(raw).ok).toBe(false);
  });
  it('keeps data sources opaque and compiles bindings at the whole text location after parameter resolution', () => {
    const raw = document(); raw.dataSources = { opaque: { parts: [{ filter: 'ignored' }, { param: 'ignored' }] } };
    const partial: any = resolveParamTextValues(raw, { values: new Map([['report-name', '经营报告']]) });
    expect(partial.dataSources).toBe(raw.dataSources);
    expect(title(partial).parts).toEqual([{ filter: 'report-month', format: 'period' }, ' ', '经营报告']);
    const usage = collectFilterTextValueReferences(partial)[0];
    expect(usage.path).toBe('/sections/0/components/0/props/title/parts/0');
    expect(usage.composition?.path).toBe('/sections/0/components/0/props/title');
    const resolved: any = resolveTextValues(raw, { values: new Map([['report-name', '经营报告']]) });
    expect(title(resolved)).toBe('全部期间 经营报告');
    expect(resolved.dataSources).toBe(raw.dataSources);
  });
});
