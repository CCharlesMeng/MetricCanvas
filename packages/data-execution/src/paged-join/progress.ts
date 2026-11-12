import { copyFieldFallback, type Row } from '@metriccanvas/page/internal';
import { ordinalRows } from './rows';
import type { PagedJoinPlan } from './plan';
import { progressComputation, progressSnapshot, type ScreenProgressSink } from '../screen-progress';

type Key = string | number;
export interface SelectedRows { rows: Row[]; keys: Key[]; total: number | undefined; pageIndex: number }

/** Own member progress within one read generation; no execution snapshot is published here. */
export function createJoinProgress(plan: PagedJoinPlan, selected: SelectedRows, notify?: ScreenProgressSink) {
  const members = new Map<string, Map<Key, Row>>();
  const resolved = new Map<string, Set<Key>>();
  const failures: unknown[] = [];
  function project(input: Row, key: Key, pending: Set<string>): Row {
    const row: Row = {}, available = new Set<string>();
    for (const [field, projection] of Object.entries(plan.source.source.projection)) {
      const ready = resolved.get(projection.member)?.has(key);
      const source = plan.source.source.records && projection.member === plan.selection ? input : members.get(projection.member)?.get(key);
      row[field] = ready ? source ? source[projection.field] ?? null : projection.onMissing === 'zero' ? 0 : null : null;
      if (ready) { available.add(field); copyFieldFallback(source, projection.field, row, field); }
    }
    row[plan.source.source.rowKey] ??= key;
    available.add(plan.source.source.rowKey);
    const output = progressComputation([row], plan.source.compute ?? [], available)[0];
    for (const field of Object.keys(plan.source.fields)) if (!available.has(field) && field !== plan.source.source.ordinalField) pending.add(field);
    return output;
  }
  function publish() {
    if (!notify) return;
    const pending = new Set<string>();
    const rows = selected.rows.map((input, index) => project(input, selected.keys[index], pending));
    const correction = selected.pageIndex === plan.view.pageIndex ? undefined : { ...plan.view, pageIndex: selected.pageIndex };
    notify(progressSnapshot(ordinalRows(plan, rows, selected.pageIndex * plan.view.pageSize), selected.total, pending, correction));
  }
  return {
    members,
    accept(id: string, rows: Map<Key, Row>, keys: readonly Key[]) {
      members.set(id, new Map(rows));
      const known = resolved.get(id) ?? new Set<Key>();
      for (const key of keys) known.add(key);
      resolved.set(id, known); publish();
    },
    fail(id: string, cause: unknown) {
      if (!notify) throw cause;
      failures.push(cause); members.delete(id); resolved.delete(id); publish();
    },
    finish() { if (failures.length) throw failures[0]; }
  };
}
