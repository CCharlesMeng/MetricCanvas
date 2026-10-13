import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validate } from '../src';
import { formatSuitsParamType } from '../src/page-param';
import { requiredMinorVersion } from '../src/version';
import report from '../../../pages/business-sdt-report.json';

const document = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/inline-report.json', 'utf8'));

it.each(['number-signed', 'number-1-signed'] as const)('%s requires 6.17 at bindings, defaults and text references', format => {
  for (const location of ['binding', 'default', 'param', 'filter', 'detail']) {
    const raw = document();
    raw.schemaVersion = '6.17';
    if (location === 'binding') raw.sections[0].components[1].props.rows[0].valueField.format = format;
    if (location === 'default') raw.dataSources.overview.fields.gmv.defaultFormat = format;
    if (location === 'param') {
      raw.params = [{ id: 'target', type: 'number', required: true, default: 3 }];
      raw.meta = { title: { param: 'target', format } };
    }
    if (location === 'filter') {
      raw.filters = [{ id: 'range', type: 'numberRange', default: { from: 0, to: 3 } }];
      raw.meta = { title: { filter: 'range', format } };
    }
    if (location === 'detail') {
      raw.detailViews = [{ id: 'detail', mode: 'snapshot', components: [{
        id: 'detail-table', type: 'table', layout: { span: 12 }, data: { main: 'overview' },
        props: { columns: [{ field: { data: 'main', field: 'gmv', format } }] }
      }] }];
    }
    expect(validate(raw), location).toEqual([]);
    expect(requiredMinorVersion(raw)).toBe(17);
    raw.schemaVersion = '6.16';
    expect(validate(raw), location).toContainEqual(expect.objectContaining({ message: expect.stringContaining('由 6.17 引入') }));
  }
  expect(formatSuitsParamType(format, 'number')).toBe(true);
  expect(formatSuitsParamType(format, 'string')).toBe(false);
});

it('does not inspect raw data or query bodies for presentation formats', () => {
  const raw = document();
  raw.dataSources.overview.source.rows[0].format = 'number-1-signed';
  expect(requiredMinorVersion(raw)).toBe(1);
});

it('configures exactly the eight comparison bindings without changing their source defaults', () => {
  expect(validate(report)).toEqual([]);
  const formats: string[] = [];
  for (const section of report.sections) for (const component of section.components) {
    const props: any = component.props;
    if (component.type === 'metricCard') for (const row of props.rows) for (const change of row.changes ?? []) {
      formats.push(change.field.format);
      expect(change.colorRule.mode).toBe('sign');
    }
    if (component.type === 'table') for (const column of props.columns) {
      if (column.field?.field === 'avg-decision-time-change') formats.push(column.field.format);
    }
  }
  expect(formats.filter(format => format === 'number-1-signed')).toHaveLength(5);
  expect(formats.filter(format => format === 'number-signed')).toHaveLength(3);
  for (const source of Object.values(report.dataSources)) for (const field of Object.values(source.fields)) {
    if ('defaultFormat' in field) expect(field.defaultFormat).not.toMatch(/signed$/);
  }
});
