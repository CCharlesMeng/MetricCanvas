import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { tableSearchValue, type ConditionContext } from '@metriccanvas/page/internal';
import { tableColumnPresentation } from '@metriccanvas/data-execution/runtime';
import { reconcileColumnView } from '../src/table/reconcile-view';

it('keeps the visible supplementary search and removes it when its column is hidden', () => {
  const raw = JSON.parse(readFileSync('pages/business/dashboard/ioc/approval/rep-office-execution-efficiency.json', 'utf8'));
  raw.filters.push({ id: 'show-owner', type: 'boolean', label: '显示责任人', default: true });
  const columns = raw.sections[1].components[0].props.tabs[0].component.props.columns;
  columns[3].visibleWhen = { filter: 'show-owner', part: 'value', op: 'eq', value: true };
  const parsed = parsePage(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const table = parsed.page.sections[1].components[0];
  if (table.type !== 'tabContainer') throw new Error('Expected tabs');
  const tab = table.props.tabs[0];
  if (!('component' in tab) || tab.component.type !== 'table') throw new Error('Expected table tab');
  const definition = tab.component;
  const context: ConditionContext = { declarations: parsed.page.filters ?? [], filters: new Map([['show-owner', { type: 'boolean', value: true }]]) };
  const visible = tableColumnPresentation(parsed.page, definition, context);
  const view = { pageIndex: 0, pageSize: 10, sort: [], predicates: [], search: tableSearchValue(definition.props.toolbar?.search, '合成责任人', 'owner-name') };
  expect(reconcileColumnView(view, visible, [], false).search).toEqual(view.search);
  const hidden = tableColumnPresentation(parsed.page, definition, { ...context, filters: new Map([['show-owner', { type: 'boolean', value: false }]]) });
  expect(reconcileColumnView(view, hidden, [], false).search).toBeUndefined();
});
