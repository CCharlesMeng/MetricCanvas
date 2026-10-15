import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePage } from '../src/validate';

const original = JSON.parse(readFileSync(new URL('../../../pages/chart-local-filter-page.json', import.meta.url), 'utf8'));

describe('Dashboard chart filter ownership', () => {
  it('accepts the actual four-chart page and a separate unfiltered comparison', () => {
    expect(parsePage(original).ok).toBe(true);
  });

  const cases: Array<[string, (document: typeof original) => void, RegExp]> = [
    ['version', d => { d.schemaVersion = '6.28'; }, /由 6.29 引入/],
    ['report', d => { d.layout = 'report'; }, /Dashboard/],
    ['unknown filter', d => { d.sections[0].components[0].props.filter.filterId = 'missing'; }, /必须引用/],
    ['duplicate values', d => { d.sections[0].components[0].props.filter.options[1].value = 'CN'; }, /不得重复/],
    ['unknown default', d => { d.filters[0].default = ['invalid']; }, /default/],
    ['multi default', d => { d.filters[0].default = ['CN', 'OVERSEAS']; }, /default/],
    ['missing default', d => { delete d.filters[0].default; }, /default/],
    ['hidden control', d => { d.filters[0].visible = false; }, /可见/],
    ['missing binding', d => { delete d.dataSources['orders-data'].source.query.filterBindings; }, /filterBindings/],
    ['shared source', d => { d.sections[0].components[4].data.main = 'orders-data'; }, /影响其他组件/],
    ['foreign binding', d => { d.dataSources['control-data'].source.query.filterBindings = {'orders-region': {target:'dimension',queryField:'chart_demo_region'}}; }, /依赖之外/],
    ['cascade', d => { d.filters[1].dependsOn = 'orders-region'; }, /级联/],
    ['result dependency', d => { d.dataSources['control-data'].source.query.resultBindings = [{source:'orders-data',field:'chart_demo_category',target:'dimension',queryField:'chart_demo_category',maxValues:100}]; }, /影响其他组件/],
    ['foreign computation', d => { d.dataSources['control-data'].compute = [{op:'selectField',filter:'orders-region',cases:{CN:'value',OVERSEAS:'value'},defaultMode:'CN',output:'selected'}]; }, /依赖之外/],
    ['foreign text', d => { d.sections[0].components[1].props.title = {filter:'orders-region'}; }, /其他位置的文字/],
    ['blank label', d => { d.sections[0].components[0].props.filter.options[0].label = ' '; }, /pattern/],
    ['shared owner', d => { d.sections[0].components[1].props.filter.filterId = 'orders-region'; }, /只能属于一张图/]
  ];
  it.each(cases)('rejects %s', (_name, change, message) => {
    const document = structuredClone(original); change(document);
    const parsed = parsePage(document);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.some(error => message.test(error.message))).toBe(true);
  });
});
