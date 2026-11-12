import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { tableSearchValue, type ConditionContext } from '@metriccanvas/page/internal';
import { tableColumnPresentation } from '@metriccanvas/data-execution/runtime';
import { reconcileColumnView } from '../src/table/reconcile-view';

it('keeps the visible supplementary search and removes it when its column is hidden', () => {
  const raw = JSON.parse(readFileSync('pages/business/dashboard/ioc/approval/rep-business-result.json', 'utf8'));
  raw.filters.push({ id: 'show-project', type: 'boolean', label: '显示项目', default: true });
  const columns = raw.sections[3].components[0].props.tabs[3].components[0].props.columns;
  columns[0].visibleWhen = { filter: 'show-project', part: 'value', op: 'eq', value: true };
  const parsed = parsePage(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const table = parsed.page.sections[3].components[0];
  if (table.type !== 'tabContainer') throw new Error('Expected tabs');
  const tab = table.props.tabs[3];
  if (!('components' in tab) || tab.components[0].type !== 'table') throw new Error('Expected table tab');
  const definition = tab.components[0];
  const context: ConditionContext = { declarations: parsed.page.filters ?? [], filters: new Map([['show-project', { type: 'boolean', value: true }]]) };
  const visible = tableColumnPresentation(parsed.page, definition, context);
  const view = { pageIndex: 0, pageSize: 10, sort: [], predicates: [], search: tableSearchValue(definition.props.toolbar?.search, '合成项目', 'project-name') };
  expect(reconcileColumnView(view, visible, [], false).search).toEqual(view.search);
  const hidden = tableColumnPresentation(parsed.page, definition, { ...context, filters: new Map([['show-project', { type: 'boolean', value: false }]]) });
  expect(reconcileColumnView(view, hidden, [], false).search).toBeUndefined();
});
