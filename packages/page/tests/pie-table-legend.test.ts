import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';
import { requiredMinorVersion } from '../src/version';

function document() {
  return JSON.parse(readFileSync(new URL('../../../pages/capabilities/chart/pie-table-legend.json', import.meta.url), 'utf8'));
}

describe('pie table legend contract', () => {
  it('accepts omitted units and alignment and validates each supported alignment', () => {
    const page = document();
    expect(validate(page)).toEqual([]);
    for (const align of ['left', 'center', 'right']) {
      page.sections[0].components[0].props.legend.columns[0].align = align;
      page.sections[0].components[0].props.legend.columns[0].unit = '家';
      expect(validate(page)).toEqual([]);
    }
    page.sections[0].components[0].props.legend.columns[0].align = 'justify';
    expect(validate(page).length).toBeGreaterThan(0);
  });

  it('validates the real Playground declaration and requires its capability version', () => {
    const page = document();
    expect(validate(page)).toEqual([]);
    expect(requiredMinorVersion(page)).toBe(64);
    page.schemaVersion = '6.63';
    expect(validate(page).some(error => error.type === 'SCHEMA_ERROR')).toBe(true);
  });

  it('checks legend field roles and mutually exclusive ordering declarations', () => {
    const page = document();
    const props = page.sections[0].components[0].props;
    props.legend.columns[0].field = 'band';
    props.sort = 'desc';
    props.categoryOrder = ['a', 'a'];
    const issues = validate(page);
    expect(issues.some(error => error.path.endsWith('/legend/columns/0/field'))).toBe(true);
    expect(issues.filter(error => error.path.endsWith('/categoryOrder'))).toHaveLength(2);
  });

  it('rejects competing native legends and compact-only layout', () => {
    const page = document();
    const props = page.sections[0].components[0].props;
    props.echartsOption = { legend: { show: true } };
    props.variant = 'compactRing';
    const issues = validate(page);
    expect(issues.some(error => error.path.endsWith('/echartsOption/legend'))).toBe(true);
    expect(issues.some(error => error.path.endsWith('/props/legend'))).toBe(true);
  });
});
