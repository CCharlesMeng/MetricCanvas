import { describe, expect, it } from 'vitest';
import document from '../fixtures/contract-valid/record-join-page.json';
import queryDocument from '../fixtures/contract-valid/record-join-query-page.json';
import { parsePage } from '../src/validate';

function configured(timeoutMs: number, schemaVersion = '6.117', queryPage = false) {
  const value = structuredClone(queryPage ? queryDocument : document);
  value.schemaVersion = schemaVersion;
  value.dataSources['rejection-overview'].source.records.timeoutMs = timeoutMs;
  return value;
}

describe.each([false, true])('record timeout version boundary, query page=%s', queryPage => {
  it.each([120001, 180000])('accepts %s ms only in 6.117 or later', timeoutMs => {
    const value = configured(timeoutMs, '6.117', queryPage), before = structuredClone(value);
    expect(parsePage(value).errors).toEqual([]);
    expect(value).toEqual(before);
    expect(parsePage(configured(timeoutMs, '6.116', queryPage)).errors).toContainEqual(expect.objectContaining({
      path: '/dataSources/rejection-overview/source/records/timeoutMs', message: expect.stringContaining('6.117')
    }));
  });
  it.each([60000, 120000])('preserves the previous %s ms declaration on 6.116', timeoutMs => {
    expect(parsePage(configured(timeoutMs, '6.116', queryPage)).ok).toBe(true);
  });
  it.each([0, -1, 1.5, 180001])('rejects invalid timeout %s', timeoutMs => {
    expect(parsePage(configured(timeoutMs, '6.117', queryPage)).ok).toBe(false);
  });
});
