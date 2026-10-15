import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { prepareExecution, type ExecutionRequest } from '../src/execution';

it('执行回执也必须遵守页面时间点下限，不能绕过输入控件', () => {
  const document = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/time-point-min-page.json', import.meta.url), 'utf8'));
  const request: ExecutionRequest = { target: { kind: 'draft', ref: { pageId: document.id, revisionId: 'r1', resourceId: 'metadata' } }, operationId: 'month-min-check', explicitInputs: {} };
  const response = {
    status: 'success', target: request.target, operationId: request.operationId,
    executionId: 'execution', conditionKey: 'conditions', document, appliedInputs: {}, dataSources: {},
    filterValues: {
      'report-month': { type: 'timePoint', granularity: 'month', value: '2020-05' },
      'report-date': { type: 'timePoint', granularity: 'date', value: '2020-06-15' }
    }
  };
  expect(() => prepareExecution(request, response)).toThrow(expect.objectContaining({ code: 'RESPONSE_MISMATCH' }));
  response.filterValues['report-month'].value = '2020-06';
  expect(prepareExecution(request, response).filters.get('report-month')).toMatchObject({ value: '2020-06' });
  response.filterValues['report-date'].value = '2020-06-14';
  expect(() => prepareExecution(request, response)).toThrow(expect.objectContaining({ code: 'RESPONSE_MISMATCH' }));
});
