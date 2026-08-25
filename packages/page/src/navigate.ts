import type { FieldDefinition, FieldReference } from './field';
import { fieldName } from './field';
import type { NavigateAction, Page } from './page';
import { walkPageComponents } from './component-walk';
import type { PageParamDeclaration, PageParamType } from './page-param';
import { resolveDataSourceFields } from './data-source';
import type { TypedError } from './errors';

/**
 * 跨文档引用校验入口(ADR-0047 / ADR-0048):目标页必须存在,
 * carryFilters / setFilters / setParams 的键必须在目标页合法,且类型匹配。
 * 由 validate CLI 组合调用;单文档校验无法独立确认全部跨页关系。
 */
export function crossPageReferenceErrors(
  page: Page,
  knownPageIds: ReadonlySet<string>,
  pagesById: ReadonlyMap<string, Page>
): TypedError[] {
  return navigateErrors(page, knownPageIds, pagesById);
}

/** @deprecated 使用 `crossPageReferenceErrors`;保留别名以免打散现有调用。 */
export function navigateErrors(
  page: Page,
  knownPageIds: ReadonlySet<string>,
  pagesById: ReadonlyMap<string, Page>
): TypedError[] {
  const errors: TypedError[] = [];

  walkPageComponents(page, (component, componentPath) => {
      if (component.type === 'text') {
        (component.props.links ?? []).forEach((link, linkIndex) => {
          const path = `${componentPath}/props/links/${linkIndex}`;
          errors.push(
            ...targetErrors(
              page,
              component,
              link.page,
              link.carryFilters,
              undefined,
              undefined,
              path,
              knownPageIds,
              pagesById
            )
          );
        });
        return;
      }

      const props = component.props as { actions?: Array<NavigateAction | { on: 'click' }> };
      (props.actions ?? []).forEach((action, actionIndex) => {
        if (!('navigate' in action)) return;
        const path = `${componentPath}/props/actions/${actionIndex}/navigate`;
        errors.push(
          ...targetErrors(
            page,
            component,
            action.navigate.page,
            action.navigate.carryFilters,
            action.navigate.setFilters,
            action.navigate.setParams,
            path,
            knownPageIds,
            pagesById
          )
        );
      });
  });
  return errors;
}

function targetErrors(
  source: Page,
  component: Page['sections'][number]['components'][number],
  targetId: string,
  carryFilters: string[] | undefined,
  setFilters: Record<string, FieldReference> | undefined,
  setParams: Record<string, FieldReference> | undefined,
  path: string,
  knownPageIds: ReadonlySet<string>,
  pagesById: ReadonlyMap<string, Page>
): TypedError[] {
  if (!knownPageIds.has(targetId)) {
    return [
      {
        type: 'SCHEMA_ERROR',
        path: `${path}/page`,
        message: `指向不存在的页面:${targetId}(pages/ 目录中没有该页面文档)`
      }
    ];
  }
  const target = pagesById.get(targetId);
  if (!target) return [];
  const targetFilters = new Map((target.filters ?? []).map((filter) => [filter.id, filter]));
  const targetParams = new Map((target.params ?? []).map((param) => [param.id, param]));
  const errors: TypedError[] = [];

  (carryFilters ?? []).forEach((filterId, index) => {
    if (!targetFilters.has(filterId)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `${path}/carryFilters/${index}`,
        message: `目标页 ${targetId} 没有同名筛选器 ${filterId}`
      });
    }
  });
  for (const filterId of Object.keys(setFilters ?? {})) {
    const targetFilter = targetFilters.get(filterId);
    if (!targetFilter) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `${path}/setFilters/${escapePointer(filterId)}`,
        message: `目标页 ${targetId} 没有筛选器 ${filterId}`
      });
    } else if (targetFilter.type !== 'dimension') {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: `${path}/setFilters/${escapePointer(filterId)}`,
        message: `目标页筛选器 ${filterId} 不是 dimension 型`
      });
    }
  }
  for (const [paramId, binding] of Object.entries(setParams ?? {})) {
    const targetParam = targetParams.get(paramId);
    const paramPath = `${path}/setParams/${escapePointer(paramId)}`;
    if (!targetParam) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: paramPath,
        message: `目标页 ${targetId} 没有页面参数 ${paramId}`
      });
      continue;
    }
    const field = sourceField(source, component, binding);
    if (field && !paramAcceptsField(targetParam, field)) {
      errors.push({
        type: 'SCHEMA_ERROR',
        path: paramPath,
        message: `页面参数 ${paramId} 类型为 ${targetParam.type}，与字段 ${fieldName(binding)} 的 ${field.type} 不相容`
      });
    }
  }
  return errors;
}

function sourceField(
  page: Page,
  component: Page['sections'][number]['components'][number],
  binding: FieldReference
): FieldDefinition | undefined {
  const slot = typeof binding === 'string' ? 'main' : binding.data;
  const data = component.data as Record<string, string> | undefined;
  const sourceId = data?.[slot];
  if (!sourceId) return undefined;
  const dataSource = page.dataSources[sourceId];
  if (!dataSource) return undefined;
  return resolveDataSourceFields(dataSource)[fieldName(binding)];
}

function paramAcceptsField(param: PageParamDeclaration, field: FieldDefinition): boolean {
  return compatibleParamType(param.type, field.type);
}

export function compatibleParamType(paramType: PageParamType, fieldType: FieldDefinition['type']): boolean {
  if (paramType === 'string') {
    return fieldType === 'string' || fieldType === 'date' || fieldType === 'datetime';
  }
  if (paramType === 'number') return fieldType === 'number' || fieldType === 'money';
  return fieldType === 'boolean';
}

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}
