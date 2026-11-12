import { headerDeclarations, usesIocRegion, resolveHeaderBinding } from './header-binding';
import { filterURLKeys } from './filter-url';
export { filterURLKeys, readLevelURLSelection } from './filter-url';
import { navigationTargetErrors } from './navigation-target-validation';
import { walkPageComponents } from './component-walk';
import type { DataRow as Row } from './field';
import type { Page, TableColumn, TableColumnNode } from './page';
import type { TypedError } from './errors';
import type { NavigationTarget } from './schema/navigation';

export { isNavigationHref } from './navigation-target-validation';

export function navigationErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const fail = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  walkPageComponents(page, (component, path) => {
    const targets: Array<[NavigationTarget, string]> = [];
    if (component.type === 'table') {
      const visit = (columns: TableColumnNode[], columnPath: string) => columns.forEach((column, index) => {
        if (column.kind === 'group') visit(column.children, `${columnPath}/${index}/children`);
        else {
          if (column.navigate) targets.push([column.navigate, `${columnPath}/${index}/navigate`]);
          if (column.navigateBySource) {
            const field = page.dataSources[component.data.main]?.fields[column.navigateBySource.field];
            if (!field || field.type !== 'string' || field.role !== 'dimension') fail(`${columnPath}/${index}/navigateBySource/field`, '来源导航必须绑定文本维度');
            if (column.navigate || column.openDetail || column.selection) fail(`${columnPath}/${index}/navigateBySource`, '来源导航不能与其他单元格动作同时声明');
            for (const [id, target] of Object.entries(column.navigateBySource.cases)) targets.push([target, `${columnPath}/${index}/navigateBySource/cases/${id.replaceAll('~', '~0').replaceAll('/', '~1')}`]);
          }
        }
      });
      visit(component.props.columns, `${path}/props/columns`);
    }
    if (component.type === 'text') {
      (component.props.links ?? []).forEach((link, i) => targets.push([link, `${path}/props/links/${i}`]));
    } else if (component.type==='button' && 'navigate' in component.props.action) {
      targets.push([component.props.action.navigate,`${path}/props/action/navigate`]);
    } else if ('actions' in component.props) {
      component.props.actions?.forEach((a, i) => {
        if ('navigate' in a) targets.push([a.navigate, `${path}/props/actions/${i}/navigate`]);
      });
    }
    for (const [target, targetPath] of targets) errors.push(...navigationTargetErrors(page,target,targetPath,component));
  });
  for (const header of headerDeclarations(page)) {
    const identity = header.props.identity as import('./schema/ioc-header').IocHeaderDeclaration['identity'];
    if (!identity?.titleNavigate) continue;
    const path = `${header.path}/identity/titleNavigate`;
    if (!identity.title) fail(path, '标题导航必须同时声明 identity.title');
    errors.push(...navigationTargetErrors(page,identity.titleNavigate,path));
  }
  return errors;
}

export function urlInputErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const used = new Set((page.params ?? []).map(p => p.id));
  (page.filters ?? []).forEach((filter, i) => {
    const keys = filterURLKeys(filter, usesIocRegion(page));
    for (const part of Object.keys(filter.urlParams ?? {})) {
      if (!(part in keys)) errors.push({ type:'SCHEMA_ERROR', path:`/filters/${i}/urlParams/${part}`, message:'该筛选器不支持此 URL 分量' });
    }
    for (const [part, key] of Object.entries(keys)) {
      if (used.has(key)) errors.push({ type:'SCHEMA_ERROR', path:part.startsWith('node/')?`${resolveHeaderBinding(page)?.path??'/iocHeader'}/filterIds`:`/filters/${i}/urlParams/${part}`, message:`URL 参数名重复:${key}` });
      used.add(key);
    }
  });
  walkPageComponents(page, (component, path) => {
    if (component.type !== 'tabContainer' || component.props.initialTabUrlParam === undefined) return;
    const key = component.props.initialTabUrlParam;
    if (used.has(key)) errors.push({ type:'SCHEMA_ERROR', path:`${path}/props/initialTabUrlParam`, message:`URL 参数名重复:${key}` });
    used.add(key);
  });
  return errors;
}

/** Only protocol-owned navigation positions, never opaque source rows or custom payloads. */
export function declaredNavigationTargets(page: Page): NavigationTarget[] {
  const result: NavigationTarget[]=[];
  walkPageComponents(page,component=>{
    if(component.type==='button' && 'navigate' in component.props.action)result.push(component.props.action.navigate);
    else if(component.type==='text')result.push(...(Array.isArray(component.props?.links)?component.props.links:[]));
    else if(component.props&&'actions' in component.props)for(const action of Array.isArray(component.props.actions)?component.props.actions:[])if('navigate' in action)result.push(action.navigate);
    if(component.type==='table')visit(component.props?.columns??[]);
  });
  for(const header of headerDeclarations(page)){
    const identity=header.props.identity as import('./schema/ioc-header').IocHeaderDeclaration['identity'];
    if(identity?.titleNavigate)result.push(identity.titleNavigate);
  }
  return result;
  function visit(columns:TableColumnNode[]){if(!Array.isArray(columns))return;for(const column of columns)if(column?.kind==='group')visit(column.children??[]);else {if(column?.navigate)result.push(column.navigate);if(column?.navigateBySource)result.push(...Object.values(column.navigateBySource.cases));}}
}

/** Resolve only the matching row source; unmatched records remain ordinary text. */
export function tableColumnNavigation(column: TableColumn | undefined, row: Row): NavigationTarget | undefined {
  if (!column?.navigateBySource) return column?.navigate;
  const value = row[column.navigateBySource.field];
  const cases = column.navigateBySource.cases;
  return typeof value === 'string' && Object.hasOwn(cases, value) ? cases[value] : undefined;
}
