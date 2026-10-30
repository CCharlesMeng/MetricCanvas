import {parsePage} from '../../../packages/page/src';
import {isQueryDataSource} from '../../../packages/page/src/internal';
import {dqeDimensionConditions, dqeRecord} from '../../../packages/page/src/dqe-object';
import document from '../../../pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json';
import mock from '../../../apps/playground/fixtures/organization-union/mock.json';
import {selectOrganizationRows} from '../../../apps/playground/fixtures/organization-union/organizations';

type RecordValue = Record<string, unknown>;
type Row = {region: string; value: number | string | null};
const parsed = parsePage(document);
if (!parsed.ok) throw new Error('伙伴健康度 Mock 页面无效');
const sources = Object.entries(parsed.page.dataSources).filter(([, source]) => isQueryDataSource(source));
const fixtures: Record<string, Row[]> = mock.sources;
const representativeFixtures: Record<string, Row[]> = mock.representative.sources;
const scopes: Record<string, Record<string, Row['value']>> = mock.overview.scopes;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);

function signature(item: RecordValue): string {
  return JSON.stringify(['query_type', 'object_type', 'schema_id', 'output_fields', 'output_dims', 'output_metrics'].map(key => item[key]));
}

function overviewRows(item: RecordValue, prefix: string, state: string): Row[] {
  const dims = dqeDimensionConditions(dqeRecord(item));
  const selection = dims.find(dim => record(dim) && dim.dim_name === '国内或海外');
  const values = record(selection) && Array.isArray(selection.dim_value_list) ? selection.dim_value_list : [];
  return values.filter(value => Object.hasOwn(scopes, String(value))).map(value => ({
    region: String(value), value: state === 'overviewMissing' ? null : state === 'overviewZero' ? 0 : scopes[String(value)][prefix]
  }));
}

function selectedRows(id: string, item: RecordValue, state: string): Row[] {
  const prefix = id.replace(/-(region|representative|overview)$/, '');
  const organizationFixtures = id.endsWith('-representative') ? representativeFixtures : fixtures;
  if (state === 'empty' || (state === 'emptyMain' && prefix === 'voice-closure-score')) return [];
  const rows = selectOrganizationRows(id, item, id.endsWith('-overview') ? overviewRows(item, prefix, state) : organizationFixtures[prefix] ?? []);
  return state === 'duplicate' && rows.length ? [...rows, rows[0]] : rows;
}

/** Explicit HTTP fixture selector keeps synthetic receipts out of ordinary DQE requests. */
export function executePartnerHealth(item: unknown, state: string) {
  const match = record(item) && sources.find(([, source]) => {
    if (!isQueryDataSource(source)) return false;
    const query = source.source.query;
    const bodies = [query.body, ...Object.values(query.queryModes?.cases ?? {}).map(mode => mode.body)];
    return bodies.some(body => {
      const dsl = body?.dsl_list[0];
      return record(dsl) && signature(dsl) === signature(item);
    });
  });
  if (!match || !record(item)) return {code: 'DQE_SIM_UNSUPPORTED_QUERY', data: [], total_count: 0};
  const [id, source] = match;
  if (state === 'error' && id.startsWith('customer-eval-score')) return {code: 'MOCK_QUERY_FAILED', data: [], total_count: 0};
  const scopeValues = dqeDimensionConditions(dqeRecord(item)).find(field => field.dim_name === '国内或海外')?.dim_value_list;
  const scope = Array.isArray(scopeValues) ? scopeValues[0] : null;
  const data = selectedRows(id, item, state).map(row => Object.fromEntries(Object.entries(source.fields).flatMap(([field, mapping]) =>
    'queryField' in mapping ? [[mapping.queryField, field === 'domestic-overseas' ? scope : field === 'region' || field === 'china-overseas' ? row.region : row.value]] : [])));
  const total = state === 'truncated' && id.startsWith('voice-closure-score') ? 15 : data.length;
  return {code: 'SUCCESS', data, total_count: state === 'zeroTotal' ? 0 : total};
}
