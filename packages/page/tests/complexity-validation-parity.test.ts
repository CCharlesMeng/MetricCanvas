import { describe, expect, it } from 'vitest';
import dateFixture from '../fixtures/contract-valid/report-date-filters-page.json';
import joinFixture from '../fixtures/contract-valid/paged-join-page.json';
import expected from './fixtures/complexity-validation-errors.json';
import { reportDateFilterErrors } from '../src/report-date-filters';
import { pagedJoinErrors } from '../src/validate-paged-join';

// Freeze the rule entry points' complete ordered diagnostics from before the refactor.
function invalidDatePage() {
  const page = JSON.parse(JSON.stringify(dateFixture));
  page.layout = 'dashboard';
  page.sections[0].components[0].props.filterIds = ['missing', 'missing', 'period-filter', 'period-filter'];
  page.filters[0].visible = false;
  page.filters[0].display = 'period';
  page.filters[0].initialMode = 'year';
  page.dataSources.sales.source.query.body.dsl_list[0].filter.time = { period: 'day', start: '2026-01' };
  return page;
}

function invalidJoinPage() {
  const page = JSON.parse(JSON.stringify(joinFixture));
  const joined = page.dataSources['office-overview'];
  joined.fields['rep-office-code'].nullable = true;
  joined.source.members.bidding.key.queryField = '';
  joined.source.projection['bidding-amount'].field = 'missing';
  joined.fields['support-rate'].nullable = false;
  joined.source.ordering.sortableFields = ['rank', 'rank', 'missing'];
  joined.source.ordering.default = [{ field: 'rank', direction: 'asc' }, { field: 'rank', direction: 'desc' }];
  page.sections[0].components.push(structuredClone(page.sections[0].components[1]));
  return page;
}

describe('validation refactor preserves diagnostic order and inputs', () => {
  it.each([
    ['date', invalidDatePage, reportDateFilterErrors],
    ['join', invalidJoinPage, pagedJoinErrors],
  ] as const)('preserves the complete error list for simultaneous %s violations', (kind, createPage, validate) => {
    const page = createPage();
    const original = structuredClone(page);
    expect(validate(page)).toEqual(expected[kind]);
    expect(page).toEqual(original);
  });
});
