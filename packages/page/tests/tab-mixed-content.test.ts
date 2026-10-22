import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '../src/validate';
import { initialTabSelections, tabSearch } from '../src/tab-state';
import fixture from '../fixtures/contract-valid/tab-mixed-content.json';

describe('Tab content contract', () => {
  for (const type of ['table', 'metricCard', 'barChart', 'lineChart', 'pieChart', 'mapChart', 'gauge', 'compositeCard', 'categoryBreakdown', 'rankingCard', 'rankingDetailCard', 'keyValuePanel', 'text', 'fieldText', 'aiSummary']) {
    it(`accepts ${type} through the same complete page validator`, () => {
      const page = JSON.parse(readFileSync(new URL(`../fixtures/contract-valid/tab-content-${type.toLowerCase()}.json`, import.meta.url), 'utf8'));
      expect(validate(page)).toEqual([]);
    });
  }
  it('rejects headers, nested Tabs, a backdrop and an insufficient capability version', () => {
    for (const component of [
      { id: 'header', type: 'reportHeader', layout: { span: 12 }, props: { title: '非法页头' } },
      structuredClone(fixture.sections[0].components[0])
    ]) {
      const page: any = structuredClone(fixture);
      page.sections[0].components[0].props.tabs[0].components = [component];
      expect(validate(page).length).toBeGreaterThan(0);
    }
    const backdrop = structuredClone(fixture) as any;
    backdrop.sections[0].components[0].props.tabs[0].components[0].layout.layer = 'backdrop';
    expect(validate(backdrop).some(error => error.path.endsWith('/layout/layer'))).toBe(true);
    expect(validate({ ...fixture, schemaVersion: '6.31' }).length).toBeGreaterThan(0);
  });
  it('rejects malformed raw Tab entries without throwing from guided diagnostics', () => {
    const malformed: any = structuredClone(fixture);
    malformed.sections[0].components[0].props.tabs = [null, 4, { id: 'bad', components: 'invalid' }];
    expect(() => validate(malformed)).not.toThrow();
    expect(validate(malformed).length).toBeGreaterThan(0);
  });
  it('restores only declared Tabs and preserves other URL inputs across several containers', () => {
    const result = parsePage(fixture); if (!result.ok) throw Error(JSON.stringify(result.errors));
    expect(initialTabSelections(result.page, 'tab.analysis=details')).toEqual({ analysis: 'details' });
    expect(initialTabSelections(result.page, 'tab.analysis=missing')).toEqual({ analysis: 'overview' });
    expect(new URLSearchParams(tabSearch('revision=123&orders-region=CN&tab.other=two', { analysis: 'details' })).get('tab.other')).toBe('two');
  });
});
