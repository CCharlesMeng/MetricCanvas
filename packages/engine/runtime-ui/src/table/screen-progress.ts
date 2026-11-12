import { fieldBindingLeaves, fieldName, tableColumnLeaves, tablePinnedSlots, type Component, type TableComponent } from '@metriccanvas/page/internal';
import type { ScreenProgress } from '@metriccanvas/data-execution/runtime';
import type { NamedDataSlots } from '../../../widgets/src/shared/component-data';
import type { TableViewState } from '../../../widgets/src/components/table/view-state';

/** Defer local row membership/order when any condition still depends on pending values. */
export function usableTableProgress(component: TableComponent, progress: ScreenProgress | undefined, view: TableViewState | undefined): ScreenProgress | undefined {
  if (!progress) return;
  const pending = new Set(progress.pendingFields);
  if (pending.size && component.props.rowVisibleWhen) return;
  if (view?.sort.some(rule => pending.has(rule.field))) return;
  if (Object.keys(view?.headerFilters ?? {}).some(field => pending.has(field))) return;
  if (view?.search?.fields.some(field => pending.has(field))) return;
  if (pending.size && view?.searchQuery && !view.search) return;
  return progress;
}

/** Ordinary multi-slot tables already have independent receipts; main owns their row order. */
export function progressiveSlotData(component: Component, data: NamedDataSlots, view: TableViewState | undefined): NamedDataSlots | undefined {
  if (component.type !== 'table' || !data.main) return;
  if (data.main.progress) return data;
  if (data.main.sourceStatus !== 'ready' && data.main.sourceStatus !== 'empty') return;
  const pinned = new Set(tablePinnedSlots(component.props));
  const waiting = Object.entries(data).filter(([slot, value]) => slot !== 'main' && !pinned.has(slot) && (value?.sourceStatus === 'loading' || value?.sourceStatus === 'error'));
  if (!waiting.length || component.props.rowVisibleWhen) return;
  if (view?.searchQuery) return;
  const waitingSlots = new Set(waiting.map(([slot]) => slot));
  const operated = [...(view?.sort.map(rule => rule.field) ?? []), ...Object.keys(view?.headerFilters ?? {})];
  if (operated.some(field => unresolvedSlotField(component, field, waitingSlots))) return;
  return { ...data, main: { ...data.main, progress: {pendingFields:[]}, sourceStatus: waiting.some(([, value]) => value?.sourceStatus === 'loading') ? 'loading' : 'error' } };
}

function unresolvedSlotField(component: TableComponent, field: string, waiting: ReadonlySet<string>): boolean {
  const bindings = tableColumnLeaves(component.props.columns).flatMap(column => fieldBindingLeaves(column.field)).filter(binding => fieldName(binding) === field);
  return !bindings.length || bindings.some(binding => waiting.has(typeof binding === 'string' ? 'main' : binding.data));
}
