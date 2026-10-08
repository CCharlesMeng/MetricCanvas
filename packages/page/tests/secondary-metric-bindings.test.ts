import { expect, test } from 'vitest';
import { validate } from '../src/index';
import inlineReport from '../fixtures/contract-valid/inline-report.json';

test('secondary metric rows validate field existence and measure role like primary rows', () => {
  for (const valueField of ['missing', 'region']) {
    const document = structuredClone(inlineReport);
    Object.assign(document.dataSources.overview.fields, { region: { type: 'string', role: 'dimension' } });
    Object.assign(document.dataSources.overview.source.rows[0]!, { region: '北京' });
    const metric = document.sections[0]!.components[1]!;
    Object.assign(metric.props, { secondaryRows: [{ label: '次指标', valueField }], secondaryTitle: '次面板' });
    expect(validate(document)).toContainEqual(expect.objectContaining({ path: '/sections/0/components/1/props/secondaryRows/0/valueField' }));
  }
});

test('secondary changes validate their measure binding', () => {
  const document = structuredClone(inlineReport);
  Object.assign(document.sections[0]!.components[1]!.props, {
    secondaryRows: [{ label: '次指标', valueField: 'gmv', changes: [{ label: '变化', field: 'missing' }] }]
  });
  expect(validate(document)).toContainEqual(expect.objectContaining({ path: '/sections/0/components/1/props/secondaryRows/0/changes/0/field' }));
});
