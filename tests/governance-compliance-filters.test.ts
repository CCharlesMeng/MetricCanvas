import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../packages/page/src';
import type { QueryDataSource } from '../packages/page/src/internal';
import { initialFilterValues, parseFilterSearch } from '../packages/engine/runtime/src/filter-state';
import { compilePresentation } from '../packages/engine/runtime/src/presentation';
import { composeEffectiveQuery } from '../packages/data-execution/src/effective-query';

const search = 'mtime=month%3A2026-11&sdt-duration-site=国内&sdt-count-site=国内&biz-decision-site=国内&contract-decision-site=国内';
const charts = [
  ['sdt-duration-site', 'decision-validity-trend'],
  ['sdt-count-site', 'urgent-decision-trend'],
  ['biz-decision-site', 'apply-norm-trend'],
  ['contract-decision-site', 'contract-decision-trend']
] as const;

function setup(region: string) {
  const parsed = parsePage(JSON.parse(readFileSync('pages/temporary/governance-compliance-20261027/governance-compliance.json', 'utf8')));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page;
  const filters = new Map([...initialFilterValues(page.filters ?? []), ...parseFilterSearch(`${search}&${region}`, page.filters ?? [], new Date('2026-11-10T00:00:00Z'), true)]);
  const presentation = compilePresentation(page);
  const query = (id: string) => composeEffectiveQuery({ page, filters: page.filters, dataSource: page.dataSources[id] as QueryDataSource }, filters, 0, [], {});
  return { filters, presentation, query };
}

it.each(['region-dept=全球', 'region=全球&region.level=geo', ''])('shows all four chart filters at global scope: %s', region => {
  const { filters, presentation, query } = setup(region);
  for (const [filterId, sourceId] of charts) {
    expect(presentation.evaluate({ filters }).component(`${filterId}-filter`).eligible, filterId).toBe(true);
    expect(query(sourceId).filterValues).toContainEqual({ target: 'dimension', queryField: '国内或海外', values: ['国内'] });
    expect(query(sourceId).filterValues).toContainEqual(expect.objectContaining({ target: 'time' }));
    expect(query(sourceId).filterValues).not.toContainEqual(expect.objectContaining({ queryField: '地区部', values: ['全球'] }));
  }
});

it.each(['region-dept=海外地区部', 'rep-office=巴黎代表处'])('pauses hidden site predicates and restores independent selections: %s', region => {
  const { filters, presentation, query } = setup(region);
  filters.set('biz-decision-site', { type: 'dimension', dimension: 'data-site-type', values: ['海外'] });
  for (const [filterId, sourceId] of charts) {
    expect(presentation.evaluate({ filters }).component(`${filterId}-filter`).eligible).toBe(false);
    expect(query(sourceId).filterValues).not.toContainEqual(expect.objectContaining({ queryField: '国内或海外' }));
    expect(query(sourceId).filterValues).toContainEqual(expect.objectContaining({ target: 'time' }));
    expect(query(sourceId).filterValues).toContainEqual(expect.objectContaining({ queryField: region.startsWith('rep-office') ? '代表处' : '地区部' }));
  }
  filters.set('region', { type: 'dimension', dimension: 'region-dept-code', level: 'region-dept', values: ['全球'] });
  for (const [filterId, sourceId] of charts) {
    expect(presentation.evaluate({ filters }).component(`${filterId}-filter`).eligible).toBe(true);
    expect(query(sourceId).filterValues).toContainEqual({ target: 'dimension', queryField: '国内或海外', values: filterId === 'biz-decision-site' ? ['海外'] : ['国内'] });
  }
});
