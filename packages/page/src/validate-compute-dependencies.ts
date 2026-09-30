import type { Page } from './page';
import type { TypedError } from './errors';
import { computeDependencies, computeOutputFields } from './compute';
import { flattenPageComponents } from './component-walk';
import type { DataSource } from './data-source';
import type { FieldDefinition } from './field';

/** 跨源约束只用于新算子，不收紧存量单源页面。 */
export function crossSourceComputeErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const error = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const pointer = (id: string) => `/dataSources/${id.replaceAll('~', '~0').replaceAll('/', '~1')}`;
  const paged = new Set(flattenPageComponents(page).flatMap(component =>
    component.type === 'table' && component.props.pagination?.mode === 'query' ? [component.data.main] : []));
  const full = (id: string, source: DataSource, path: string) => {
    if (source.source.type === 'inline') return;
    const query = source.source.query.body.dsl_list[0];
    const order = query?.order;
    if (source.source.resultScope !== 'complete' || paged.has(id) ||
      (order && typeof order === 'object' && ('limit' in order || 'offset' in order))) {
      error(path, `跨源计算要求完整行集；查询源 ${id} 必须声明 resultScope: complete，且不得带查询分页窗口`);
    }
  };
  const compatible = (a: FieldDefinition, b: FieldDefinition) =>
    a.type === b.type && a.role === b.role && ('unit' in a ? a.unit : undefined) === ('unit' in b ? b.unit : undefined) &&
    (a.type !== 'money' || (b.type === 'money' && a.currency === b.currency));

  for (const [id, source] of Object.entries(page.dataSources)) {
    if (!(source.compute ?? []).some(op => ['joinAggregate', 'sumFields', 'cagr', 'timeFill', 'selectField'].includes(op.op))) continue;
    if ((source.compute ?? []).some(op => op.op === 'joinAggregate' || op.op === 'timeFill')) full(id, source, pointer(id));
    const produced = new Set(computeOutputFields(source.compute ?? []));
    const available = new Set(Object.keys(source.fields).filter(field => !produced.has(field)));
    for (const [index, op] of (source.compute ?? []).entries()) {
      const path = `${pointer(id)}/compute/${index}`;
      if (op.op === 'selectField' && !page.filters?.some(f => f.id === op.filter && f.type === 'dimension')) error(`${path}/filter`, '字段模式必须引用已声明的维度筛选器');
      if (op.op === 'timeFill' && 'filter' in op.range) {
        const filterId = op.range.filter;
        if (!page.filters?.some(f => f.id === filterId && f.type === 'timeRange')) error(`${path}/range/filter`, '时间补齐范围必须引用时间范围筛选器');
      }
      if (op.op === 'joinAggregate') {
        const dependency = Object.hasOwn(page.dataSources, op.source) ? page.dataSources[op.source] : undefined;
        if (!dependency) error(`${path}/source`, `未知数据依赖:${op.source}`);
        else {
          full(op.source, dependency, `${path}/source`);
          const localKeys = new Set<string>();
          const foreignKeys = new Set<string>();
          for (const [keyIndex, key] of op.keys.entries()) {
            const a = source.fields[key.local];
            const b = dependency.fields[key.foreign];
            if (!available.has(key.local) || !a || !b || a.role !== 'dimension' || b.role !== 'dimension' || !compatible(a, b)) {
              error(`${path}/keys/${keyIndex}`, '组合键必须引用可用且类型、单位相容的维度字段');
            }
            if (localKeys.has(key.local) || foreignKeys.has(key.foreign)) error(`${path}/keys/${keyIndex}`, '组合键字段不得重复');
            localKeys.add(key.local); foreignKeys.add(key.foreign);
          }
          for (const [valueIndex, value] of op.values.entries()) {
            const input = dependency.fields[value.field];
            const output = source.fields[value.output];
            if (!input || !output || input.role !== 'measure' || !['number', 'money'].includes(input.type) || !compatible(input, output)) {
              error(`${path}/values/${valueIndex}`, '关联度量与产出字段必须为相同类型、单位、币种的数值度量');
            }
            if (output?.nullable === false) error(`${path}/values/${valueIndex}/output`, '缺关联行产出 null，字段必须允许为空');
            if (value.aggregate === 'sum' && (!input || input.role !== 'measure' || input.collapsible !== true)) {
              error(`${path}/values/${valueIndex}/aggregate`, 'sum 要求依赖字段显式声明 collapsible: true');
            }
          }
        }
      }
      // 新跨源计算链禁止读到尚未产生的字段。
      const inputs = op.op === 'timeFill' ? [op.timeField, ...op.measures, ...(op.groupBy ?? [])]
        : op.op === 'selectField' ? Object.values(op.cases)
        : op.op === 'sumFields' ? op.fields
        : op.op === 'cagr' ? [op.beginning, op.ending, op.periods]
        : op.op === 'ratio' ? [op.numerator, op.denominator]
        : op.op === 'delta' ? [op.minuend, op.subtrahend]
        : op.op === 'pivot' ? [op.categoryField, op.valueField, ...(op.keyFields ?? [])]
        : op.op === 'grandTotal' ? op.measures
        : op.op === 'groupSubtotal' ? [op.groupBy, ...op.measures] : [];
      for (const field of inputs) if (!available.has(field)) error(path, `算子输入尚不可用:${field}`);
      for (const field of computeOutputFields([op])) available.add(field);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) { error(pointer(id), '页面数据源计算依赖不得成环'); return; }
    if (visited.has(id) || !Object.hasOwn(page.dataSources, id)) return;
    visiting.add(id);
    for (const dependency of computeDependencies(page.dataSources[id].compute ?? [])) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const id of Object.keys(page.dataSources)) visit(id);
  return errors;
}
