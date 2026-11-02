import type {DimensionValuesResult, FilterCandidatesResult} from '@metriccanvas/engine';
import {dqeDimensionConditions, dqeRecord} from '../../../../packages/page/src/dqe-object';
import mock from './mock.json';

const parents: Record<string, string> = mock.representative.parents;

/** Flat candidates for legacy preview filters. */
export function organizationDimensionValues(dimension: string): DimensionValuesResult {
  const values = dimension === 'representative' ? mock.representative.expectedOrganizations : dimension === 'region-dept' ? mock.expectedOrganizations : undefined;
  return values ? {kind: 'values', candidates: values.map(value => ({value, label: value}))} : {kind: 'unavailable'};
}

/** Synthetic IOC candidates preserve the fixture's real parent relationships. */
export function organizationFilterCandidates(filterId: string): FilterCandidatesResult {
  if (filterId !== 'region') return {kind: 'unavailable'};
  return {kind: 'values', candidates: [
    ...mock.expectedOrganizations.map(value => ({value, label: value, level: 'region-dept'})),
    ...mock.representative.expectedOrganizations.map(value => ({value, label: value, level: 'representative',
      parent: {level: 'region-dept', value: parents[value]}}))
  ]};
}

function matchesOrganization(id: string, row: {region: string}, field: string, values: unknown): boolean {
  if (!Array.isArray(values)) return false;
  const representative = id.endsWith('-representative');
  if (field === '地区部') return values.includes(representative ? parents[row.region] : row.region);
  if (field === '代表处') return representative ? values.includes(row.region) : values.some(value => parents[String(value)] === row.region);
  return true;
}

/** Filter only synthetic rows using the same declared organization predicates as real DQE. */
export function selectOrganizationRows<T extends {region: string}>(id: string, item: unknown, rows: readonly T[]): T[] {
  const conditions = dqeDimensionConditions(dqeRecord(item)).filter(field => field.dim_name === '地区部' || field.dim_name === '代表处');
  return rows.filter(row => conditions.every(field => matchesOrganization(id, row, String(field.dim_name), field.dim_value_list)));
}
