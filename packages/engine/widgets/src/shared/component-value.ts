import { valueSourceBinding, staticFieldBinding, type ComponentValueSource, type Row, type FieldValue, type ValueFormatPreset } from '@metriccanvas/page/internal';
import { resolveField, fieldValue, type NamedDataSlots } from './component-data';

export interface ResolvedComponentValue {
  label: string;
  format?: ValueFormatPreset;
  missingText?: string;
  unit?: string;
  currency?: 'CNY' | 'USD';
  read: (row?: Row) => FieldValue | undefined;
}

/** Resolve presentation once; read values without changing snapshots or inventing field identities. */
export function resolveComponentValue(
  source: ComponentValueSource,
  data: NamedDataSlots,
  emptyBehavior?: 'default' | 'showConstants'
): ResolvedComponentValue {
  const binding = valueSourceBinding(source);
  if (binding === undefined) return {
    label: '常量', format: source.format, missingText: source.missingText,
    unit: source.unit, currency: source.currency,
    read: () => constantsAvailable(data, emptyBehavior) ? source.value : undefined
  };
  const resolved = resolveField(binding, data);
  const definition = resolved.definition;
  const leaf = staticFieldBinding(binding);
  const matched = typeof leaf !== 'string' && leaf.match !== undefined;
  return {
    label: definition?.label ?? resolved.field,
    format: resolved.format, missingText: resolved.missingText,
    unit: definition && 'unit' in definition ? definition.unit : undefined,
    currency: definition?.type === 'money' ? definition.currency : undefined,
    read: row => row && !matched ? row[resolved.field] : fieldValue(binding, data)
  };
}

function constantsAvailable(data: NamedDataSlots, behavior?: 'default' | 'showConstants'): boolean {
  const main = data.main;
  if (!main) return true;
  if (main.sourceStatus === 'error' || main.sourceStatus === 'loading') return false;
  return main.snapshot.rows.length > 0 || behavior === 'showConstants';
}
