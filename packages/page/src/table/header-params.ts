import type { Page, TableColumn, TableComponent } from '../page';
import type { TypedError } from '../errors';
import type { PageParamValue, PageParamDeclaration } from '../page-param';
import type { DqeQueryDefinition } from '../query';
import { bindingQueryFields } from '../query';
import { dqeDimensionConditions, dqeRecord } from '../dqe-object';
import { hasQueryFieldMapping } from '../field';
import { resolveDataSourceFields } from '../data-source';
import { walkDocumentComponents, walkPageComponents } from '../component-walk';
import { ordinaryQuery, queryLeaves } from '../query-selection';
import { mainColumnField, visitTableColumns } from './columns';
import { selectValueErrors } from './select-values';

const issue = (path: string, message: string): TypedError => ({type:'SCHEMA_ERROR',path,message});
/** Declaration-only scan: never inspect query bodies or inline row values as columns. */
export function tableHeaderParamReferences(document: unknown): Array<{id:string;source:string;path:string}> {
  const references: Array<{id:string;source:string;path:string}> = [];
  walkDocumentComponents(document, (node, path) => {
    if (node.type !== 'table') return;
    const table = node as unknown as TableComponent;
    if (!Array.isArray(table.props?.columns)) return;
    visitTableColumns(table.props.columns, path + '/props/columns', (column, own) => {
      if (column.kind !== 'group' && column.filterable?.mode === 'select' && typeof column.filterable.initialParam === 'string')
        references.push({id:column.filterable.initialParam,source:table.data.main,path:own+'/filterable/initialParam'});
    });
  });
  return references;
}
/** Follow explicit projection to actual query fields; constant union projections have no query target. */
function queryTargets(page: Page, id: string, field: string, visited: ReadonlySet<string> = new Set()): Array<{query:DqeQueryDefinition;field:string}> {
  const key = JSON.stringify([id,field]);
  if (visited.has(key)) return [];
  const next = new Set(visited).add(key);
  const data = page.dataSources[id], source = data?.source;
  if (!source) return [];
  if (source.type === 'query') {
    const definition = data.fields[field];
    return definition && hasQueryFieldMapping(definition) ? queryLeaves(source.query).map(query => ({query,field:definition.queryField})) : [];
  }
  if (source.type === 'pagedJoin') {
    const projection = source.projection[field];
    const member = projection && source.members[projection.member];
    return member ? queryTargets(page, member.source, projection.field, next) : [];
  }
  if (source.type !== 'pagedUnion') return [];
  return Object.values(source.members).flatMap(member => {
    const projection = member.projection[field];
    return projection && 'field' in projection ? queryTargets(page,member.source,projection.field,next) : [];
  });
}
function duplicateControl(page: Page, query: DqeQueryDefinition, field: string, id: string): boolean {
  const binding = query.paramBindings?.[id];
  if (binding?.target === 'dimension' && binding.queryField === field) return true;
  if (dqeDimensionConditions(ordinaryQuery(query).body.dsl_list[0]).some(condition => condition.dim_name === field && dqeRecord(condition.dim_value_list).param === id)) return true;
  return Object.entries(query.filterBindings ?? {}).some(([filterId,binding]) => {
    const filter = page.filters?.find(filter => filter.id === filterId);
    return bindingQueryFields(binding).includes(field) && filter?.type === 'dimension' && filter.initialParam === id;
  });
}
export function tableHeaderColumnParamErrors(page: Page, table: TableComponent, column: TableColumn, path: string): TypedError[] {
  if (column.filterable?.mode !== 'select' || column.filterable.initialParam === undefined) return [];
  const id = column.filterable.initialParam, target = path + '/filterable/initialParam';
  const errors: TypedError[] = [];
  if (column.filterable.defaultValues !== undefined) errors.push(issue(target,'initialParam 与 defaultValues 互斥'));
  const param = page.params?.find(param => param.id === id);
  if (param?.type !== 'dimension' || !param.path?.startsWith('/params/query/dimensions/')) errors.push(issue(target,'表头初值必须引用 params.query.dimensions 参数'));
  const field = mainColumnField(column.field);
  const data = page.dataSources[table.data.main];
  if (field === undefined || !data) return errors;
  if (resolveDataSourceFields(data)[field]?.type !== 'string') errors.push(issue(target,'参数初值首期只支持字符串维度列'));
  for (const mapped of queryTargets(page,table.data.main,field)) {
    if (param?.dimName !== mapped.field) errors.push(issue(target,'维度参数 dim_name 必须与查询目标一致'));
    if (duplicateControl(page,mapped.query,mapped.field,id)) errors.push(issue(target,'表头初值参数不得永久约束同一查询目标'));
  }
  return errors;
}
/** Validate effective inputs before any source is exposed; absence remains a valid optional input. */
export function tableHeaderInputErrors(page: Page, values: ReadonlyMap<string,PageParamValue> | undefined): TypedError[] {
  if (!values) return [];
  const errors: TypedError[] = [];
  walkPageComponents(page,(table,path) => {
    if (table.type !== 'table') return;
    const data = page.dataSources[table.data.main];
    if (!data) return;
    const fields = resolveDataSourceFields(data);
    visitTableColumns(table.props.columns,path+'/props/columns',(column,own) => {
      if (column.kind === 'group' || column.filterable?.mode !== 'select' || !column.filterable.initialParam) return;
      const value = values.get(column.filterable.initialParam);
      if (value === undefined) return;
      const field = mainColumnField(column.field);
      if (!Array.isArray(value) || field === undefined) { errors.push(issue(own+'/filterable/initialParam','表头参数必须为字符串维度值数组')); return; }
      for (const index of selectValueErrors(column,value,fields[field]?.type)) errors.push(issue(own+'/filterable/initialParam/'+index,'表头参数初值必须为字典内、类型正确且不重复的原始值'));
    });
  });
  return errors;
}

export function tableHeaderParamDeclarationErrors(document: unknown, declarations: ReadonlyMap<string,PageParamDeclaration>): TypedError[] {
  return tableHeaderParamReferences(document).flatMap(reference => {
    const param=declarations.get(reference.id);
    return param?.type === 'dimension' && param.path?.startsWith('/params/query/dimensions/') ? [] : [issue(reference.path,'表头初值必须引用 params.query.dimensions 参数')];
  });
}
