import type { DataWarning } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../shared/component-data';

/** Screen, nested tables and workbook exports consume the same source diagnostics. */
export function tableDataWarnings(data: NamedDataSlots): DataWarning[] {
  const warnings = new Map<string, DataWarning>();
  for (const slot of Object.values(data)) {
    const snapshot = slot?.diagnostics?.snapshot ?? slot?.snapshot;
    if (!snapshot || !('warnings' in snapshot)) continue;
    for (const warning of snapshot.warnings ?? []) warnings.set(JSON.stringify(warning), warning);
  }
  return [...warnings.values()];
}
