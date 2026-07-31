import type { Page, TypedError } from '@metriccanvas/page';
import customerActivityRiskBriefing from '../../../../pages/customer-activity-risk-briefing.json';

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
  return errors.length > 0
    ? { status: 'contract-error', errors }
    : { status: 'valid', document };
}

export const DEFAULT_PREVIEW_PAGE = customerActivityRiskBriefing as unknown as Page;

export const DEFAULT_PREVIEW_JSON = JSON.stringify(DEFAULT_PREVIEW_PAGE, null, 2);
