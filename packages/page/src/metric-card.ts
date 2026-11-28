import type { Component, MetricCardProps, MetricCardRow, Page } from './page-types';
import type { TypedError } from './errors';
import { walkPageComponents } from './component-walk';
import { fieldBindingLeaves, fieldName, fieldSlot } from './field';

export function metricDefinitionErrors(page: Page): TypedError[] {
  return [...metricCodePlacementErrors(page), ...metricCardRowDefinitionErrors(page)];
}

function metricCodePlacementErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  for (const [sourceId, source] of Object.entries(page.dataSources)) {
    for (const [fieldId, field] of Object.entries(source.fields)) {
      const path = `/dataSources/${sourceId}/fields/${fieldId}`;
      if (field.role === 'dimension' && field.metricCode !== undefined) {
        errors.push({ type: 'SCHEMA_ERROR', path: `${path}/metricCode`, message: 'metricCode 只允许声明在顶层度量结果字段' });
      }
      if (field.type !== 'recordList') continue;
      for (const [itemId, item] of Object.entries(field.items.fields)) {
        if (item.metricCode === undefined) continue;
        errors.push({
          type: 'SCHEMA_ERROR',
          path: `${path}/items/fields/${itemId}/metricCode`,
          message: '嵌套明细字段不能声明 metricCode'
        });
      }
    }
  }
  return errors;
}

function metricCardRowDefinitionErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  walkPageComponents(page, (component, path) => {
    if (component.type !== 'metricCard') return;
    for (const key of ['rows', 'secondaryRows'] as const) {
      component.props[key]?.forEach((row, index) => {
        if (row.showDefinition !== true) return;
        const message = metricRowDefinitionIssue(page, component, row);
        if (message) errors.push({
          type: 'SCHEMA_ERROR', path: `${path}/props/${key}/${index}/showDefinition`, message
        });
      });
    }
  });
  return errors;
}

function metricRowDefinitionIssue(
  page: Page,
  component: Extract<Component, { type: 'metricCard' }>,
  row: MetricCardRow
): string | undefined {
  if (component.props.tipCode !== undefined) return '同一指标卡的 tipCode 与 showDefinition: true 互斥';
  for (const binding of fieldBindingLeaves(row.valueField)) {
    const sourceId = component.data[fieldSlot(binding) as keyof typeof component.data];
    const field = sourceId ? page.dataSources[sourceId]?.fields?.[fieldName(binding)] : undefined;
    if (field?.role !== 'measure' || !field.metricCode) {
      return 'showDefinition: true 要求 valueField 的每个结果字段声明 metricCode';
    }
  }
}

/** A document can declare a text reference that only resolves at render time. */
export function metricCardTipAnchor(props: Pick<MetricCardProps, 'title' | 'rows' | 'secondaryRows'>): 'title' | 'row' | undefined {
  if (hasTipLabel(props.title)) return 'title';
  if (props.rows.length === 1 && !props.secondaryRows?.length && hasTipLabel(props.rows[0]?.label)) return 'row';
}

function hasTipLabel(value: unknown): boolean {
  return value != null && (typeof value !== 'string' || value.trim().length > 0);
}

export function metricCardTipTitleErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  walkPageComponents(page, (component, path) => {
    if (component.type !== 'metricCard' || component.props.tipCode === undefined) return;
    if (!metricCardTipAnchor(component.props)) {
      errors.push({
        type: 'SCHEMA_ERROR', path: `${path}/props/title`,
        message: '指标定义气泡需要非空主标题，或仅有一个带标签的主指标行'
      });
    }
  });
  return errors;
}

/** 主次指标形态的基数约束；既有指标卡分支保持原有行数语义。 */
export function metricCardShapeErrors(props: MetricCardProps, path: string): TypedError[] {
  if (props.variant !== 'primaryDetail' || props.rows.length === 1) return [];
  return [{
    type: 'SCHEMA_ERROR', path: `${path}/props/rows`,
    message: 'primaryDetail 指标卡必须且只能声明一个主指标；次级指标放入 secondaryRows'
  }];
}

export function hasMetricRowAction(component: Component): boolean {
  if (component.type !== 'metricCard') return false;
  const { rows, secondaryRows = [] } = component.props;
  return [...rows, ...secondaryRows].some(row => row.action !== undefined);
}

export function metricCardSelectTabErrors(page: Page, row: MetricCardRow, path: string): TypedError[] {
  if (!row.action) return [];

  const { componentId, tabId } = row.action.selectTab;
  const targetPath = `${path}/action/selectTab`;
  const errors: TypedError[] = [];
  if (row.link === true) {
    errors.push({ type: 'SCHEMA_ERROR', path: `${path}/link`, message: '指标行的 action 与 link: true 不能同时声明' });
  }
  const target = page.sections.flatMap(section => section.components).find(component => component.id === componentId);
  if (target?.type !== 'tabContainer') {
    errors.push({ type: 'SCHEMA_ERROR', path: `${targetPath}/componentId`, message: 'selectTab 必须引用当前页的 Tab 容器' });
  } else if (!target.props.tabs.some(tab => tab.id === tabId)) {
    errors.push({ type: 'SCHEMA_ERROR', path: `${targetPath}/tabId`, message: 'selectTab 引用的页签不属于目标 Tab 容器' });
  }
  return errors;
}
