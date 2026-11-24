import { expect, it, vi } from 'vitest';
import example from '../../../pages/capabilities/chart/bar-category-order.json';
import { normalizePageDocument, parsePage, versionPolicy } from '../src';
import { parseRuntimePage } from '../src/internal';

it('renders supported capabilities while keeping the declaration and its legacy behaviors', () => {
  const document = { ...structuredClone(example), schemaVersion: '6.123' };
  const original = structuredClone(document);
  const report = vi.fn();
  const strict = parsePage(document);
  expect(strict).toMatchObject({
    ok: false,
    errors: expect.arrayContaining([expect.objectContaining({
      path: '/sections/0/components/0/props/order',
      message: expect.stringContaining('6.132')
    })])
  });
  expect(normalizePageDocument(document)).toMatchObject(strict);
  expect(parseRuntimePage(document, {}, report)).toMatchObject({
    ok: true, page: { schemaVersion: '6.123' }, errors: []
  });
  expect(report).toHaveBeenCalledExactlyOnceWith(strict.errors);
  expect(document).toEqual(original);
});

it('still rejects an unusable result-field reference at its actual path', () => {
  const document = { ...structuredClone(example), schemaVersion: '6.131' };
  const chart = document.sections[0].components[0]!;
  Object.assign(chart.props, { order: { field: 'missing-field', direction: 'desc' } });
  const report = vi.fn();
  expect(parseRuntimePage(document, {}, report)).toMatchObject({
    ok: false,
    errors: [expect.objectContaining({ path: '/sections/0/components/0/props/order/field' })]
  });
  expect(report).not.toHaveBeenCalled();
});

it.each(['5.4', '6.6', `6.${versionPolicy.minor + 1}`, '7.0'])(
  'keeps the existing compatibility restrictions for %s',
  schemaVersion => {
    const document = { ...example, schemaVersion };
    const report = vi.fn();
    expect(parseRuntimePage(document, {}, report)).toEqual(parsePage(document));
    expect(parseRuntimePage(document).ok).toBe(false);
    expect(report).not.toHaveBeenCalled();
  }
);
