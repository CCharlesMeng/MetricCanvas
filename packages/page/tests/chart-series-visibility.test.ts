import { describe, expect, it } from 'vitest';
import sample from '../../../pages/capabilities/chart/chart-series-visibility.json';
import { validate } from '../src/internal';

describe('chart series presentation contract', () => {
  it('accepts the complete inline page and recognizes filters consumed only by series', () => {
    expect(validate(sample)).toEqual([]);
  });
  it.each(['6.87', '6.86', '6.85', '5.4'])('rejects series conditions on %s at the declaration path', schemaVersion => {
    expect(validate({ ...sample, schemaVersion })).toContainEqual(expect.objectContaining({
      type: 'SCHEMA_ERROR', path: '/sections/1/components/0/props/series/2/visibleWhen'
    }));
  });
  it.each([
    { filter: 'missing', part: 'value', op: 'eq', value: true },
    { row: 'sales', op: 'gt', value: 1 },
    { filter: 'show-rate', part: 'value', op: 'eq', value: 'true' },
    { filter: 'scope', part: 'values', op: 'gt', value: 1 }
  ])('rejects invalid condition references and types', visibleWhen => {
    const document = structuredClone(sample);
    const props = document.sections[1]!.components[0]!.props;
    if (!('series' in props)) throw Error('expected chart');
    Object.assign(props.series![2]!, { visibleWhen });
    expect(validate(document)).toContainEqual(expect.objectContaining({
      type: 'SCHEMA_ERROR', path: '/sections/1/components/0/props/series/2/visibleWhen'
    }));
  });
  it('keeps historical series without conditions readable', () => {
    const document = structuredClone(sample);
    document.schemaVersion = '6.85';
    for (const component of document.sections[1]!.components) {
      if (!('series' in component.props)) throw Error('expected chart');
      for (const series of component.props.series!) Reflect.deleteProperty(series, 'visibleWhen');
    }
    document.filters = [];
    document.sections.shift();
    expect(validate(document)).toEqual([]);
  });
});
