import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';
import { requiredMinorVersion } from '../src/version';

function definition() {
  return JSON.parse(readFileSync(new URL('../../../pages/capabilities/chart/chart-tooltip-color-rule.json', import.meta.url), 'utf8'));
}

describe('chart tooltip color rule protocol', () => {
  it('validates scoped rules on bar, line and mixed series and requires Schema 6.134', () => {
    const page = definition();
    expect(validate(page)).toEqual([]);
    expect(requiredMinorVersion(page)).toBe(134);
    page.schemaVersion = '6.133';
    const paths = validate(page).map(error => error.path);
    expect(paths).toHaveLength(6);
    expect(paths).toContain('/sections/0/components/1/props/series/0/tooltip/colorRule');
    expect(paths).toContain('/sections/0/components/2/props/series/1/tooltip/colorRule');
  });

  it('requires a nested rule and a numeric field', () => {
    const page = definition();
    const series = page.sections[0].components[0].props.series[0];
    const tooltip = series.tooltip;
    series.tooltip = {};
    expect(validate(page)).not.toEqual([]);
    delete series.tooltip;
    series.tooltipColorRule = tooltip.colorRule;
    expect(validate(page)).not.toEqual([]);
    delete series.tooltipColorRule;
    series.tooltip = tooltip;
    page.dataSources.changes.fields.note = { type: 'string', role: 'measure', nullable: true };
    series.field = 'note';
    expect(validate(page)).toContainEqual(expect.objectContaining({
      path: '/sections/0/components/0/props/series/0/tooltip/colorRule',
      message: 'colorRule 只支持 number 或 money 字段'
    }));
  });
});
