import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';
import { requiredMinorVersion } from '../src/version';

function document(name = 'pie-table-legend') {
  return JSON.parse(readFileSync(new URL(`../../../pages/capabilities/chart/${name}.json`, import.meta.url), 'utf8'));
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

  it('requires 6.133 at every configured legend column', () => {
    const page = document('pie-legend-color-rule');
    expect(validate(page)).toEqual([]);
    expect(requiredMinorVersion(page)).toBe(133);
    page.schemaVersion = '6.132';
    expect(validate(page).map(error => error.path)).toEqual([
      '/sections/0/components/0/props/legend/columns/0/colorRule',
      '/sections/0/components/0/props/legend/columns/1/colorRule',
      '/sections/0/components/0/props/legend/columns/2/colorRule',
      '/sections/0/components/0/props/legend/columns/3/colorRule'
    ]);
  });

  it('rejects invalid rules and allows only numeric field bindings to use them', () => {
    const page = document('pie-legend-color-rule');
    const columns = page.sections[0].components[0].props.legend.columns;
    const rule = columns[0].colorRule;
    columns[0].colorRule = null;
    expect(validate(page)).not.toEqual([]);
    columns[0].colorRule = rule;
    columns[4].colorRule = rule;
    expect(validate(page)).not.toEqual([]);
    delete columns[4].colorRule;
    page.dataSources['customers-by-region'].fields.note = { type: 'string', role: 'measure', nullable: true };
    columns[0].field = 'note';
    expect(validate(page)).toContainEqual(expect.objectContaining({
      path: '/sections/0/components/0/props/legend/columns/0/colorRule',
      message: 'colorRule 只支持 number 或 money 字段'
    }));
  });
});
