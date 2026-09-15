import { expect, it } from 'vitest';
import vectors from '../metriccanvas-authoring/contracts/authored/source-format.conformance.json';
import { formatValue } from '../packages/engine/widgets/src/shared/value-format';
import { isValueFormatPreset } from '../packages/page/src/field';

for (const entry of vectors.cases.filter(value => value.accepted)) {
  it(`renders accepted normalized source scale: ${entry.name}`, () => {
    if (!isValueFormatPreset(entry.format)) throw Error('Unknown format in shared source vector');
    expect(formatValue(entry.value, entry.format)).toBe(entry.expected);
  });
}
