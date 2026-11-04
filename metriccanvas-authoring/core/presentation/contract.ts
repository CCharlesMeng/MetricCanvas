import { EVALUATION_SCHEMA } from '../page/product-contract';
import { ERROR_TYPES } from '../../../packages/page/src/errors';
export const PRESENTATION_OPERATIONS = {
  'page.presentation': {
    inputSchema: { type: 'object', properties: { document: {}, baseline: {}, presentationIntent: { type: 'object', properties: { rawValuePaths: { type: 'array', items: { type: 'string' }, uniqueItems: true } }, additionalProperties: false }, action: { enum: ['inspect'] }, evaluation: EVALUATION_SCHEMA }, required: ['document'], additionalProperties: false },
    outputSchema: { type: 'object', properties: { scope: { const: 'data-only' }, findings: { type: 'array', items: { type: 'object' } } }, required: ['scope', 'findings'], additionalProperties: false },
    errorCodes: ['PRESENTATION_INPUT_INVALID', 'PRESENTATION_DOUBLE_SCALE', 'PRESENTATION_TOKENS_SCALE_CONFLICT', 'PRESENTATION_SCALE_UNVERIFIED', 'PRESENTATION_PERCENT_UNIT_CONFLICT', 'EVALUATION_CONTEXT_REQUIRED', 'INVALID_EVALUATION_CONTEXT', ...ERROR_TYPES],
    sideEffects: 'none' as const
  }
};
export interface PresentationSelfTest { operation: 'page.presentation'; input: { document: unknown }; expectedStatus: 'ok' | 'partial' | 'error'; expectedDiagnostic?: string }
export const PRESENTATION_SELF_TESTS: PresentationSelfTest[] = [
  { operation: 'page.presentation', input: { document: { schemaVersion: '6.82', id: 'presentation-self-test', layout: 'dashboard', dataSources: {}, sections: [{ id: 'main', components: [{ id: 'note', type: 'text', props: { body: '合成自检' }, layout: { span: 12 } }] }] } }, expectedStatus: 'ok' },
  { operation: 'page.presentation', input: { document: null }, expectedStatus: 'error' }
];

function presentationSample(unit: string) {
  return { schemaVersion: '6.82', id: 'presentation-format-self-test', layout: 'dashboard',
    dataSources: { values: { fields: { amount: { type: 'number', role: 'measure', unit, defaultFormat: 'compact-million-1' } },
      source: { type: 'inline', rows: [{ amount: 1000000 }] } } },
    sections: [{ id: 'main', components: [{ id: 'table', type: 'table', layout: { span: 12 }, data: { main: 'values' },
      props: { columns: [{ field: 'amount', title: '合成数值' }] } }] }] };
}
PRESENTATION_SELF_TESTS.push({ operation: 'page.presentation', input: { document: presentationSample('Tokens') }, expectedStatus: 'ok' });
PRESENTATION_SELF_TESTS.push({ operation: 'page.presentation', input: { document: presentationSample('元') }, expectedStatus: 'partial', expectedDiagnostic: 'PRESENTATION_TOKENS_SCALE_CONFLICT' });
