import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { projectFieldSelections } from '../src/field-selection';
import { requiredMinorVersion, capabilityFloorErrors } from '../src/version';
import { formatSuitsParamType } from '../src/page-param';

const fixture = () => JSON.parse(readFileSync('pages/capabilities/data/operation-money-formats.json', 'utf8'));

it('validates the complete observable scenario and both static currency selections', () => {
  const input = fixture(), result = parsePage(input);
  expect(result.errors).toEqual([]);
  if (!result.ok) throw Error('scenario must validate');
  for (const currency of ['RMB', 'USD']) {
    const projected = projectFieldSelections(result.page, new Map([['currency', {type: 'dimension', values: [currency]}]]));
    const card = projected.sections[0].components[1];
    if (card.type !== 'metricCard') throw Error('expected card');
    expect(card.props.rows[0].unit).toBe('');
    expect(card.props.rows[0].valueField).toMatchObject({field: currency === 'USD' ? 'usd' : 'cny'});
    expect(projected.dataSources).toBe(result.page.dataSources);
  }
});

it.each(['cny-adaptive-trimmed', 'cny-adaptive-trimmed-no-yuan', 'usd-adaptive-km'] as const)(
  '%s is a numeric format gated at 6.88, including field defaults and text references', format => {
    expect(formatSuitsParamType(format, 'number')).toBe(true);
    expect(formatSuitsParamType(format, 'string')).toBe(false);
    const defaults = {schemaVersion: '6.87', dataSources: {main: {fields: {amount: {defaultFormat: format}}}}};
    expect(requiredMinorVersion(defaults)).toBe(88);
    expect(capabilityFloorErrors(defaults)).toEqual(expect.arrayContaining([expect.objectContaining({type: 'SCHEMA_ERROR'})]));
    expect(requiredMinorVersion({sections: [{components: [{id: 't', type: 'text', props: {body: {param: 'amount', format}}}]}]})).toBe(88);
  }
);

it.each([
  ['cny-a', 'USD'], ['cny-b', 'USD'], ['usd', 'CNY']
])('rejects the wrong currency on default format %s', (field, currency) => {
  const input = fixture();
  input.dataSources.cases.fields[field].currency = currency;
  expect(parsePage(input).errors).toEqual(expect.arrayContaining([
    expect.objectContaining({path: `/dataSources/cases/fields/${field}`, message: '金额格式必须匹配静态货币'})
  ]));
});

it('rejects a wrong currency in a nondefault selection case', () => {
  const input = fixture();
  input.sections[0].components[1].props.rows[0].valueField.byFilter.cases.USD.format = 'cny-adaptive-trimmed';
  expect(parsePage(input).ok).toBe(false);
});

it('rejects wrong currency on direct bindings and chart constants', () => {
  const input = fixture();
  input.sections[0].components[4].props.columns[1].field.format = 'usd-adaptive-km';
  expect(parsePage(input).ok).toBe(false);
  const constant = fixture();
  constant.sections[0].components[2].props.series = [{value: 2, format: 'usd-adaptive-km', currency: 'CNY'}];
  expect(parsePage(constant).errors).toEqual(expect.arrayContaining([
    expect.objectContaining({message: '常量金额格式要求显式 currency: USD'})
  ]));
  constant.sections[0].components[2].props.series[0].currency = 'USD';
  expect(parsePage(constant).ok).toBe(true);
});

it('does not infer a capability from opaque query business values', () => {
  expect(requiredMinorVersion({dataSources: {main: {source: {type: 'query', query: {body: {format: 'usd-adaptive-km'}}}}}})).toBe(0);
});
