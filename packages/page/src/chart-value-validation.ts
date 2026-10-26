import type { Component } from './page';
import type { ComponentValueSource } from './component-value';
import type { TypedError } from './errors';
import { walkDocumentComponents } from './component-walk';

interface Position { source: ComponentValueSource; path: string }
function positions(component: Component): Position[] {
  switch (component.type) {
    case 'barChart': case 'lineChart':
      return component.props.series.map((source, index) => ({source, path: `/series/${index}`}));
    case 'pieChart': case 'gauge': return [{source: component.props, path: ''}];
    case 'mapChart': return [
      {source: component.props, path: ''},
      ...(component.props.tooltipFields ?? []).map((source, i) => ({source, path: `/tooltipFields/${i}`})),
      ...(component.props.pinnedSummary?.fields ?? []).map((source, i) => ({source, path: `/pinnedSummary/fields/${i}`}))
    ];
    default: return [];
  }
}

export function chartConstantErrors(component: Component, path: string): TypedError[] {
  return positions(component).flatMap(position => {
    const {source} = position;
    if (!Object.hasOwn(source, 'value')) return [];
    const expected = constantFormatCurrency(source.format);
    if (!expected || source.currency === expected) return [];
    return [{type: 'SCHEMA_ERROR' as const, path: `${path}/props${position.path}/currency`,
      message: `常量金额格式要求显式 currency: ${expected}`}];
  });
}

function constantFormatCurrency(format: ComponentValueSource['format']): 'CNY' | 'USD' | undefined {
  if (format === 'cny-adaptive') return 'CNY';
  if (format === 'usd-adaptive') return 'USD';
  return undefined;
}

/** Before legacy JSON copying can turn NaN/Infinity into null or erase undefined. */
export function chartConstantInputErrors(document: unknown): TypedError[] {
  const errors: TypedError[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (!['barChart', 'lineChart', 'pieChart', 'mapChart', 'gauge'].includes(String(component.type))) return;
    const props = record(component.props);
    if (!props) return;
    for (const position of inputPositions(props)) {
      if (!Object.hasOwn(position.source, 'value')) continue;
      const descriptor = Object.getOwnPropertyDescriptor(position.source, 'value');
      if (descriptor && 'value' in descriptor && jsonScalar(descriptor.value)) continue;
      errors.push({type: 'SCHEMA_ERROR', path: `${path}/props${position.path}/value`, message: '常量只接受 JSON 标量及有限数字'});
    }
  });
  return errors;
}

function inputPositions(props: Record<string, unknown>): {source: Record<string, unknown>; path: string}[] {
  const result = [{source: props, path: ''}];
  const groups = [['series', props.series], ['tooltipFields', props.tooltipFields], ['pinnedSummary/fields', record(props.pinnedSummary)?.fields]] as const;
  for (const [key, entries] of groups) {
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry, index) => {
      const source = record(entry);
      if (source) result.push({source, path: `/${key}/${index}`});
    });
  }
  return result;
}

function jsonScalar(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  return typeof value === 'number' && Number.isFinite(value);
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
