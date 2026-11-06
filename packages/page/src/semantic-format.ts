import type { ResolvedFieldDefinition, ValueFormatPreset } from './field';

const semanticFormats = new Set<ValueFormatPreset>([
  'cny-adaptive-trimmed', 'cny-adaptive-trimmed-no-yuan', 'usd-adaptive-km',
  'percent-raw', 'cny-adaptive', 'usd-adaptive', 'count-adaptive', 'resource-adaptive', 'bytes-adaptive', 'minutes-adaptive',
  'messages-adaptive', 'billing-hours', 'percent-adaptive', 'percent-adaptive-signed'
]);

const unitFormats: Readonly<Record<string, ValueFormatPreset>> = {
  '%': 'percent-adaptive', '％': 'percent-adaptive',
  '人': 'count-adaptive', '户': 'count-adaptive', '个': 'count-adaptive',
  '核': 'resource-adaptive', '卡': 'resource-adaptive', '台': 'resource-adaptive',
  '分钟': 'minutes-adaptive', '条': 'messages-adaptive'
};

/** Only declared currency and units select a policy; labels and field ids carry no semantics. */
export function semanticValueFormat(definition: ResolvedFieldDefinition | undefined): ValueFormatPreset | undefined {
  if (!definition || definition.role !== 'measure') return undefined;
  if (definition.defaultFormat && semanticFormats.has(definition.defaultFormat)) return definition.defaultFormat;
  if (definition.type === 'money') return definition.currency === 'USD' ? 'usd-adaptive' : 'cny-adaptive';
  if (definition.type !== 'number') return undefined;
  if (definition.defaultFormat?.startsWith('percent-')) return definition.defaultFormat.endsWith('-signed') ? 'percent-adaptive-signed' : 'percent-adaptive';
  const unit = definition.unit?.trim() ?? '';
  if (isByteUnit(unit)) return 'bytes-adaptive';
  if (unitFormats[unit] === 'percent-adaptive' && definition.defaultFormat?.endsWith('-signed')) return 'percent-adaptive-signed';
  return unitFormats[unit];
}

/** Byte and bit rates retain their dimension; there is no implicit bit/byte conversion. */
export function isByteUnit(unit: string): boolean {
  return /^(?:Bytes|bytes|B|[KMGTPEZY]B|bits|bit|[KMGTPEZY]?b)(?:\/s|ps)?$/.test(unit);
}
