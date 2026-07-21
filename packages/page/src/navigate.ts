import type { FieldBinding } from './field';
import type { NavigateAction, Page } from './page';
import type { TypedError } from './errors';

/** 需要全量页面清单的跨文档链接与 navigate action 校验，由 validate CLI 组合调用。 */
export function navigateErrors(
  page: Page,
  knownPageIds: ReadonlySet<string>,
  pagesById: ReadonlyMap<string, Page>
): TypedError[] {
  const errors: TypedError[] = [];

  page.sections.forEach((section, sectionIndex) => {
    section.components.forEach((component, componentIndex) => {
      const componentPath = `/sections/${sectionIndex}/components/${componentIndex}`;
      if (component.type === 'text') {
        (component.props.links ?? []).forEach((link, linkIndex) => {
          const path = `${componentPath}/props/links/${linkIndex}`;
          errors.push(
            ...targetErrors(
              link.page,
              link.carryFilters,
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
            action.navigate.page,
            action.navigate.carryFilters,
            action.navigate.setFilters,
            path,
            knownPageIds,
            pagesById
          )
        );
      });
    });
  });
  return errors;
}

function targetErrors(
  targetId: string,
  carryFilters: string[] | undefined,
  setFilters: Record<string, FieldBinding> | undefined,
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
  return errors;
}

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}
