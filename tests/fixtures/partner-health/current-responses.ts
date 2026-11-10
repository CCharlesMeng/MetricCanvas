import { readFileSync } from 'node:fs';
import { parsePage } from '../../../packages/page/src';
import type { JsonObject } from '../../../packages/page/src/query';

const result = parsePage(JSON.parse(readFileSync(new URL('../../../pages/partner-health.json', import.meta.url), 'utf8')));
if (!result.ok) throw Error(JSON.stringify(result.errors));
const fieldTypes = new Map(Object.values(result.page.dataSources).flatMap(source =>
  Object.values(source.fields).flatMap(field => 'queryField' in field ? [[field.queryField, field.type] as const] : [])));
const indices = [8, 2, 12, 4, 10, 6, 1, 9, 3, 11, 5, 7];

/** Synthetic overall scores differ from organization rows and arrive overseas first. */
export function currentHealthResult(query: JsonObject, state = 'ready') {
  const fields = (query.output_fields ?? [...query.output_dims as string[] ?? [], ...query.output_metrics as string[] ?? []]) as string[];
  if (fields.length === 1 && ['geo-pc-code','region-dept-code','rep-office-code'].includes(fields[0])) {
    const data = ['全球', ...indices.map(index => `合成地区部${String(index).padStart(2,'0')}`)].map(value => ({[fields[0]]:value}));
    return {code:'SUCCESS',data,total_count:data.length};
  }
  if (state === 'error') return { code: 'DQE_QUERY_REJECTED', data: [], total_count: 0 };
  const organization = fields.includes('地区部') || fields.includes('代表处');
  const rows = (organization ? indices : [2, 1]).map(index => Object.fromEntries(fields.map(field =>
    [field, cell(field, index, organization)])));
  const data = state === 'empty' ? [] : rows;
  return { code: 'SUCCESS', data, total_count: data.length };
}
function cell(field: string, index: number, organization: boolean) {
  if (field === '国内或海外') return index === 2 ? '海外' : '国内';
  if (field === '地区部') return `合成地区部${String(index).padStart(2, '0')}`;
  if (field === '代表处') return `合成代表处${String(index).padStart(2, '0')}`;
  if (fieldTypes.get(field) !== 'number') return `合成${field}`;
  if (organization) return index;
  if (field === '扣分') return index === 2 ? -3 : -2;
  return index;
}
