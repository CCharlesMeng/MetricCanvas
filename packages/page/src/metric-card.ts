import type { Component, MetricCardProps, MetricCardRow, Page } from './page';
import type { TypedError } from './errors';

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
