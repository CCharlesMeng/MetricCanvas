import { ERROR_TYPES } from '../../../packages/page/src/errors';
import { versionPolicy } from '../../../packages/page/src/version';

export const EVALUATION_SCHEMA = { type: 'object', properties: { instant: { type: 'string' }, timeZone: { type: 'string' } }, required: ['instant', 'timeZone'], additionalProperties: false };
const evaluation = EVALUATION_SCHEMA;
const documentInput = { document: {}, evaluation };
const object = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false });
const records = { type: 'array', items: { type: 'object' } };
const output = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const outputs = {
  project: output({ declaredVersion: {}, targetVersion: { type: 'string' }, readableVersions: { type: 'array' }, readable: { type: 'boolean' },
    requiredVersion: { type: 'string' }, capabilityErrors: records, validationErrors: records, fieldUses: records,
    components: records, dataCoverage: {}, upgrade: { type: 'object' }, status: { enum: ['current', 'readable', 'upgrade_required', 'needs_review'] }, note: { type: 'string' } }),
  scan: output({ uses: records, diagnostics: records, sources: { type: 'object' }, filters: {}, params: {} }),
  validate: output({ ok: { const: true }, schemaVersion: { type: 'string' }, errors: { type: 'array', maxItems: 0 } }),
  upgrade: output({ ok: { const: true }, changed: { type: 'boolean' }, document: { type: 'object' }, toVersion: { type: 'string' }, changes: records, warnings: { type: 'array', items: { type: 'string' } }, errors: { type: 'array', maxItems: 0 } }),
  parameters: { oneOf: [
    output({ ok: { const: true }, baseline: { type: 'string' }, source: { type: 'object' }, sourceKey: { type: 'string' }, candidates: records, skipped: records, textSlots: records }),
    output({ ok: { const: true }, baseline: { type: 'string' }, sourceKey: { type: 'string' }, document: { type: 'object' }, originalValues: { type: 'object' }, candidates: records, skipped: records, selectedIds: { type: 'array' }, issues: { type: 'array', maxItems: 0 } }),
    output({ ok: { const: true }, document: { type: 'object' }, resolvedPage: { type: 'object' }, effectiveInputs: { type: 'object' }, issues: { type: 'array', maxItems: 0 } })
  ] }
};
const strings = { type: 'array', items: { type: 'string' } };
const parameterProperties = {
  ...documentInput, action: { enum: ['extract', 'prepare', 'resolve'] },
  context: { type: 'object', required: ['baseline'], properties: { baseline: { type: 'string', minLength: 1 } } },
  selectedIds: strings, textReplacements: { type: 'object' }, suppliedValues: { type: 'object' }
};
const contract = (inputSchema: object, outputSchema: object, errorCodes: string[]) => ({ inputSchema, outputSchema, errorCodes: [...errorCodes, 'EVALUATION_CONTEXT_REQUIRED', 'INVALID_EVALUATION_CONTEXT'], sideEffects: 'none' as const });

/** Descriptions consumed by the release facade, never a second implementation. */
export const OPERATIONS = {
  'page.project': contract(object(documentInput, ['document']), outputs.project, ['INVALID_REQUEST', ...ERROR_TYPES]),
  'page.scan': contract(object({ document: { type: 'object' }, componentIds: strings }, ['document']), outputs.scan, ['INVALID_REQUEST', 'INVALID_READING_SCOPE']),
  'page.validate': contract(object({ ...documentInput, fileName: { type: 'string' }, expectedLayout: { enum: ['dashboard', 'report'] } }, ['document']), outputs.validate, ['INVALID_REQUEST', ...ERROR_TYPES]),
  'page.upgrade': contract(object({ ...documentInput, target: { type: 'string' } }, ['document']), outputs.upgrade, ['INVALID_REQUEST', ...ERROR_TYPES]),
  'page.parameters': contract({ ...object(parameterProperties, ['action', 'document']),
    allOf: [{ if: { properties: { action: { enum: ['extract', 'prepare'] } } }, then: { required: ['context'] } }]
  }, outputs.parameters, ['INVALID_REQUEST', 'INVALID_PAGE', 'UNKNOWN_INPUT', 'MISSING_INPUT', 'INVALID_VALUE', 'INVALID_TIME_RULE', 'INVALID_MATERIALIZATION'])
};
export type AuthoringPageOperation = keyof typeof OPERATIONS;

const selfTestPage = { schemaVersion: versionPolicy.current, id: 'product-self-test', layout: 'dashboard', dataSources: {},
  sections: [{ id: 'intro', components: [{ id: 'message', type: 'text', props: { body: 'Product self-test' }, layout: { span: 12 } }] }] };
const temporalSelfTestPage = { ...selfTestPage,
  filters: [{ id: 'business-date', type: 'timePoint', granularity: 'date', required: true, default: '2027-01-01', disableFuture: true }],
  sections: [{ id: 'intro', components: [{ id: 'message', type: 'text', props: { body: { filter: 'business-date', format: 'period' } }, layout: { span: 12 } }] }] };
const evaluationInstant = '2026-12-31T16:30:00Z';

export const SELF_TESTS = [
  { operation: 'page.validate', input: { document: selfTestPage }, expectedStatus: 'ok' },
  { operation: 'page.scan', input: { document: selfTestPage }, expectedStatus: 'ok' },
  { operation: 'page.project', input: { document: selfTestPage }, expectedStatus: 'ok' },
  { operation: 'page.parameters', input: { action: 'extract', document: selfTestPage, context: { baseline: 'self-test' } }, expectedStatus: 'ok' },
  { operation: 'page.upgrade', input: { document: selfTestPage }, expectedStatus: 'ok' },
  { operation: 'page.validate', input: { document: temporalSelfTestPage, evaluation: { instant: evaluationInstant, timeZone: 'Asia/Shanghai' } }, expectedStatus: 'ok' },
  { operation: 'page.validate', input: { document: temporalSelfTestPage, evaluation: { instant: evaluationInstant, timeZone: 'America/Los_Angeles' } }, expectedStatus: 'error' },
  { operation: 'page.validate', input: { document: temporalSelfTestPage }, expectedStatus: 'error' },
  { operation: 'page.validate', input: { document: temporalSelfTestPage, evaluation: { instant: evaluationInstant, timeZone: 'Not/AZone' } }, expectedStatus: 'error' },
  { operation: 'page.validate', input: { document: null }, expectedStatus: 'error' },
  { operation: 'page.parameters', input: { action: 'resolve', document: null }, expectedStatus: 'error' },
  { operation: 'page.upgrade', input: { document: { schemaVersion: '99.0' } }, expectedStatus: 'error' }
];
