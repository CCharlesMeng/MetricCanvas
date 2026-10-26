import type { FieldBinding, FieldValue, ValueFormatPreset } from './field';

/** A consumer's value origin; field references retain their independent identity contract. */
export interface ComponentValueSource {
  field?: FieldBinding;
  valueField?: FieldBinding;
  value?: FieldValue;
  format?: ValueFormatPreset;
  missingText?: string;
  unit?: string;
  currency?: 'CNY' | 'USD';
}

export function valueSourceBinding(source: ComponentValueSource): FieldBinding | undefined {
  return source.field ?? source.valueField;
}
