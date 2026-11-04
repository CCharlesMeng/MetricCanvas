import { Ajv } from 'ajv';
import { parsePage } from '../../../packages/page/src/validate';
import { fileNameErrors } from '../../../packages/page/src/file-name';
import { upgradePageDocument } from '../../../packages/page/src/upgrade-document';
import { runPageParameterProgram, type ParameterProgramRequest } from '../../../packages/page/src/parameter-program';
import { pageSchema } from '../../../packages/page/src/schema';
import { versionPolicy } from '../../../packages/page/src/version';
import { scanPageData } from './data-scan';
import { scopePageData } from './data-scope';
import { inspectPageSchema } from './inspect';
import { OPERATIONS, type AuthoringPageOperation } from './product-contract';
import { evaluationContextIssue } from './evaluation-context';

type Input = Record<string, any>;
export type AuthoringPageResult = { status: 'ok' | 'partial' | 'error'; data: object; diagnostics: object[] };
const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map(Object.entries(OPERATIONS).map(([operation, description]) => [operation, ajv.compile(description.inputSchema)]));

function result(data: object, diagnostics: object[] = [], status: AuthoringPageResult['status'] = diagnostics.length ? 'error' : 'ok'): AuthoringPageResult {
  return { status, data, diagnostics };
}

function validate(input: Input): AuthoringPageResult {
  const parsed = parsePage(input.document, { evaluation: input.evaluation });
  const errors = parsed.ok && typeof input.fileName === 'string' ? fileNameErrors(input.fileName, parsed.page) : parsed.errors;
  if (parsed.ok && input.expectedLayout && (parsed.page.layout ?? 'report') !== input.expectedLayout) {
    errors.push({ type: 'SCHEMA_ERROR', path: '/layout', message: `布局形态与本次确认不一致：预期 ${input.expectedLayout}，实际 ${parsed.page.layout ?? 'report'}` });
  }
  return result({ ok: errors.length === 0, schemaVersion: versionPolicy.current, errors }, errors);
}

function scan(input: Input): AuthoringPageResult {
  const data = scanPageData(input.document, pageSchema);
  if (!input.componentIds?.length) return result(data, data.diagnostics, data.diagnostics.length ? 'partial' : 'ok');
  try {
    const scoped = scopePageData(input.document, data, input.componentIds);
    return result(scoped, scoped.diagnostics, scoped.diagnostics.length ? 'partial' : 'ok');
  } catch (cause) {
    return result({}, [{ code: 'INVALID_READING_SCOPE', path: '/componentIds', message: String(cause) }]);
  }
}

function project(input: Input): AuthoringPageResult {
  const data = inspectPageSchema(input.document, input.evaluation);
  return result(data, data.validationErrors, data.readable ? 'ok' : 'partial');
}

function upgrade(input: Input): AuthoringPageResult {
  const data = upgradePageDocument(input.document, input.target, input.evaluation);
  return result(data, data.errors);
}

function parameters(input: Input): AuthoringPageResult {
  const data = runPageParameterProgram(input as ParameterProgramRequest);
  return result(data, data.ok ? [] : data.issues);
}

const handlers = { 'page.scan': scan, 'page.project': project, 'page.validate': validate, 'page.upgrade': upgrade, 'page.parameters': parameters };

/** Explicit complete input to deterministic candidate/diagnostics; no external callbacks. */
export function runAuthoringPageOperation(operation: string, input: unknown): AuthoringPageResult {
  const validator = validators.get(operation);
  if (!validator) return result({}, [{ code: 'INVALID_REQUEST', path: '/operation', message: 'Unknown page operation' }]);
  if (input && typeof input === 'object' && 'evaluation' in input) {
    const issue = evaluationContextIssue(operation, input as Input);
    if (issue) return result({}, [issue]);
  }
  if (!validator(input)) return result({}, validator.errors!.map(error => ({ code: 'INVALID_REQUEST', path: error.instancePath, message: error.message ?? 'Invalid operation input' })));
  const contextIssue = evaluationContextIssue(operation, input as Input);
  if (contextIssue) return result({}, [contextIssue]);
  return handlers[operation as AuthoringPageOperation](input as Input);
}
