import type {Page} from './page';
import type {DimensionFilterDeclaration,FilterDeclaration} from './filter';
import type {TypedError} from './errors';
import {queryFilterIds} from './amount-filter';
import {filterDependencies} from './filter-dependencies';
import {queryLeaves,querySelection} from './query-selection';
import {supportsIndependentExclusionCandidates} from './version';

/** Only unambiguous dynamic exclusion predicates can ignore candidate membership. */
export function independentExclusionFilterIds(page:Page):Set<string> {
  if(!supportsIndependentExclusionCandidates(page.schemaVersion))return new Set();
  const uses=new Map<string,boolean>();
  for(const source of Object.values(page.dataSources)){
    if(source.source.type!=='query')continue;
    const query=source.source.query,selector=querySelection(query);
    if(selector)uses.set(selector.filterId,false);
    for(const leaf of queryLeaves(query))for(const id of queryFilterIds(leaf)){
      const binding=leaf.filterBindings?.[id];
      const exclusion=binding?.target==='dimension'&&binding.operator==='!=';
      uses.set(id,uses.get(id)!==false&&exclusion);
    }
  }
  return new Set((page.filters??[]).filter(filter=>retainsExclusion(filter)&&uses.get(filter.id)===true).map(filter=>filter.id));
}
function retainsExclusion(filter:FilterDeclaration):boolean {
  if(filter.type!=='dimension'||filter.selection?.required||filter.hierarchy||filter.display==='tree'||filter.options)return false;
  if(filter.clearOnChangeOf?.length||filter.candidateContext?.reconcile==='intersection')return false;
  return !!(filter.candidates||filter.candidateContext);
}

export function conditionalExclusionDefaultErrors(page: Page): TypedError[] {
  const filters = page.filters ?? [];
  const withDefaults = filters.filter((filter): filter is DimensionFilterDeclaration & {defaultWhen: NonNullable<DimensionFilterDeclaration['defaultWhen']>} =>
    filter.type === 'dimension' && filter.defaultWhen !== undefined
  );
  if (!withDefaults.length) return [];
  const exclusions = independentExclusionFilterIds(page);
  const privateIds = new Set((page.detailViews ?? []).flatMap(view => view.filters ?? []));
  const byId = new Map(filters.map(filter => [filter.id, filter]));
  return withDefaults.flatMap(filter => {
    const driver = byId.get(filter.defaultWhen.filter);
    const message = conditionalDefaultIssue(filter, driver, exclusions, privateIds);
    return message ? [{type:'SCHEMA_ERROR', path:`/filters/${filters.indexOf(filter)}/defaultWhen`, message}] : [];
  });
}

function conditionalDefaultIssue(filter: DimensionFilterDeclaration, driver: FilterDeclaration | undefined, exclusions: ReadonlySet<string>, privateIds: ReadonlySet<string>): string | undefined {
  if (!exclusions.has(filter.id) || filter.selection?.mode !== 'multiple') return '联动默认值仅用于可选的动态多选排除条件';
  if (!filter.default?.length || filter.default.some(value => !value.trim())) return '联动默认值需要非空的 default 名单';
  const values = filter.defaultWhen!.values;
  if (new Set(values).size !== values.length || values.some(value => !value.trim())) return '联动默认条件必须使用非空且唯一的筛选值';
  if (driver?.type !== 'dimension' || driver.selection?.mode !== 'single' || filterDependencies(driver).length) return '联动默认条件须引用一个独立的显式单选维度';
  if (privateIds.has(filter.id) || privateIds.has(driver.id)) return '联动默认值须使用页级公共筛选器';
}
