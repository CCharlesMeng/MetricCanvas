import type {FieldValue,TableColumn} from '@metriccanvas/page/internal';

/** Labels never replace raw values used by filtering, sorting or actions. */
export function tableEnumLabel(value:FieldValue|undefined,values:TableColumn['enumValues']):string|undefined{
  return values?.find(option=>option.value===value)?.label;
}
