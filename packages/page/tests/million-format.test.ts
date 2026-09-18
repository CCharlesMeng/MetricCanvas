import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validate } from '../src';
import { formatSuitsParamType } from '../src/page-param';
import { requiredMinorVersion } from '../src/version';

const document = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/inline-report.json', 'utf8'));

it.each(['compact-million-0', 'compact-million-1', 'compact-million-2'] as const)('%s 在字段绑定和默认格式中要求6.5', (format) => {
  for (const location of ['binding', 'default', 'param']) {
    const raw = document();
    raw.schemaVersion = '6.5';
    if (location === 'binding') raw.sections[0].components[1].props.rows[0].valueField.format = format;
    if (location === 'default') raw.dataSources.overview.fields.gmv.defaultFormat = format;
    if (location === 'param') {
      raw.params = [{ id: 'target', type: 'number', required: true, default: 1234567 }];
      raw.sections[0].components[0].props.title = { param: 'target', format };
    }
    expect(validate(raw)).toEqual([]);
    expect(requiredMinorVersion(raw)).toBe(5);
    raw.schemaVersion = '6.4';
    expect(validate(raw).length).toBeGreaterThan(0);
  }
  expect(formatSuitsParamType(format, 'number')).toBe(true);
  expect(formatSuitsParamType(format, 'string')).toBe(false);
  expect(formatSuitsParamType(format, 'dimension')).toBe(false);
});

it('原始数据中的format同名键不提高能力下限', () => {
  const raw = document();
  raw.dataSources.overview.source.rows[0].format = 'compact-million-2';
  expect(requiredMinorVersion(raw)).toBe(1);
});
