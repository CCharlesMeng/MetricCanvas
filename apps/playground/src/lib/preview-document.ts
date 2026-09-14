import { normalizePageDocument, type PageDocument, type TypedError } from '@metriccanvas/page';
import defaultPreviewPage from './default-preview-page.json';

export type PreviewDocumentResult =
  | { status: 'valid'; document: unknown }
  | { status: 'syntax-error'; message: string }
  | { status: 'contract-error'; errors: TypedError[] };

type PageValidator = (document: unknown) => TypedError[];

export function parsePreviewDocument(
  source: string,
  validateDocument: PageValidator
): PreviewDocumentResult {
  let document: unknown;
  try {
    document = JSON.parse(source);
  } catch (cause) {
    return {
      status: 'syntax-error',
      message: cause instanceof Error ? cause.message : String(cause)
    };
  }

  const errors = validateDocument(document);
  if (errors.length > 0) return { status: 'contract-error', errors };
  const normalized = normalizePageDocument(document);
  return normalized.ok
    ? { status: 'valid', document: normalized.document }
    : { status: 'contract-error', errors: normalized.errors };
}

export const DEFAULT_PREVIEW_PAGE = defaultPreviewPage as PageDocument;

export const DEFAULT_PREVIEW_JSON = JSON.stringify(DEFAULT_PREVIEW_PAGE, null, 2);
