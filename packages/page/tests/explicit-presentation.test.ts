import { describe, expect, it } from 'vitest';
import sample from '../fixtures/contract-valid/explicit-presentation-page.json';
import { validate } from '../src/internal';

describe('explicit local presentation', () => {
  it('accepts red/green mappings, fixed colors and all three chart branches', () => {
    expect(validate(sample)).toEqual([]);
  });
  it('rejects new declarations on older readable schemas', () => {
    for (const schemaVersion of ['6.11', '6.14', '6.15']) {
      expect(validate({ ...sample, schemaVersion })).toContainEqual(expect.objectContaining({ type: 'SCHEMA_ERROR' }));
    }
  });
  it.each([
    [0, { columns: [{ field: 'delta', visual: 'signed', colorRule: { mode: 'fixed', color: 'red' } }] }],
    [0, { columns: [{ field: 'name', colorRule: { mode: 'fixed', color: 'red' } }] }],
    [0, { columns: [{ field: 'delta', dangerValues: ['1'], colorRule: { mode: 'fixed', color: 'red' } }] }],
    [1, { rows: [{ label: '值', valueField: 'delta', changes: [{ label: '变化', field: 'delta', tone: 'auto', colorRule: { mode: 'fixed', color: 'green' } }] }] }],
    [2, { showSegmentLabels: true }],
    [2, { showStackTotalLabels: true }],
    [3, { showPointLabels: true }]
  ])('rejects conflicting or nonnumeric declarations in component %s', (index, props) => {
    const document = structuredClone(sample);
    const component = document.sections[0]!.components[index]!;
    Object.assign(component.props, props);
    expect(validate(document)).toContainEqual(expect.objectContaining({ type: 'SCHEMA_ERROR' }));
  });
  it('preserves old declarations when the new rule is absent', () => {
    const document = structuredClone(sample);
    const column = document.sections[0]!.components[0]!.props.columns![1]!;
    Reflect.deleteProperty(column, 'colorRule');
    Object.assign(column, { visual: 'signed' });
    expect(validate(document)).toEqual([]);
  });
});
