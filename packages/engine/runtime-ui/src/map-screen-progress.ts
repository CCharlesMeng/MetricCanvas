import type { ScreenProgress } from '@metriccanvas/data-execution/runtime';
import { fieldBindingLeaves, fieldName, type FieldBinding, type MapChartProps } from '@metriccanvas/page/internal';

/** Only show current rows once their location and hierarchy are known. */
export function usableMapProgress(props: MapChartProps, progress: ScreenProgress | undefined): ScreenProgress | undefined {
  if (!props.valueField || !progress?.snapshot.rows.length) return;
  const pending = new Set(progress.pendingFields);
  const locationFields = [props.nameField, props.codeField, props.parentField, props.levelField];
  for (const action of props.actions ?? []) {
    if ('writeFilter' in action && 'field' in action) locationFields.push(action.field);
  }
  return locationFields.some(binding => pendingLocation(binding, pending)) ? undefined : progress;
}

function pendingLocation(binding: FieldBinding | undefined, pending: ReadonlySet<string>): boolean {
  return binding !== undefined && fieldBindingLeaves(binding).some(leaf => pending.has(fieldName(leaf)));
}
