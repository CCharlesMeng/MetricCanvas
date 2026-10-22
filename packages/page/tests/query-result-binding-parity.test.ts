import { expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/query-result-page-window-page.json';
import expected from './fixtures/query-result-binding-errors.json';
import { ordinaryQuery } from '../src/time-mode';
import { parsePage } from '../src/validate';
import { isQueryDataSource } from '../src/data-source';
import { queryResultBindingErrors } from '../src/validate-query-results';

function simultaneousViolations() {
  const parsed = parsePage(structuredClone(fixture));
  if (!parsed.ok) throw Error('fixture');
  const page = parsed.page;
  const upstream = page.dataSources.projects, downstream = page.dataSources['details-high'];
  if (!isQueryDataSource(upstream) || !isQueryDataSource(downstream)) throw Error('query fixture');
  upstream.source.resultScope = 'complete';
  ordinaryQuery(upstream.source.query).body.dsl_list[0].order = { offset: 3, limit: 0 };
  upstream.compute = [{ op: 'grandTotal', measures: ['amount'], rowKind: { field: 'kind', value: 'total' }, label: { field: 'project-id', value: 'total' } }];
  const binding = downstream.source.query.resultBindings![0];
  downstream.source.query.resultBindings = [
    { ...binding, where: { field: 'missing', op: 'gt', value: 1 } },
    { ...binding }
  ];
  upstream.source.query.resultBindings = [{ source: 'details-high', field: 'project-id', target: 'dimension', queryField: 'cycle', maxValues: 1 }];
  return page;
}

it('preserves the full ordered pre-refactor diagnostics for simultaneous result-binding and dependency violations', () => {
  const page = simultaneousViolations(), original = structuredClone(page);
  expect(queryResultBindingErrors(page)).toEqual(expected);
  expect(page).toEqual(original);
});
