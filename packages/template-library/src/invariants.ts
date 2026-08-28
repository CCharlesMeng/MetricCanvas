import type {
  SaveTemplateRevisionCommand,
  TemplateContext,
  TemplateError,
  TemplateErrorCode,
  TemplateRevision,
  TemplateRevisionResult
} from './types';

export function validateCommand(
  command: SaveTemplateRevisionCommand
): TemplateRevisionResult | null {
  if (!command.templateId.trim() || !command.title.trim()) {
    return failure('INVALID_TEMPLATE', 'templateId 和标题不能为空');
  }
  if (normalizeStrings(command.viewerSubjectIds).length === 0) {
    return failure('INVALID_TEMPLATE', '页面模板至少需要一个可使用主体');
  }
  return null;
}

export function normalizeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function isAdmin(context: TemplateContext): boolean {
  return context.roles?.includes('admin') === true;
}

export function conflict(
  message: string,
  currentLatestRevision: TemplateRevision | null
): TemplateRevisionResult {
  return {
    ok: false,
    error: {
      code: 'TEMPLATE_REVISION_CONFLICT',
      message,
      currentLatestRevision: clone(currentLatestRevision)
    }
  };
}

export function forbidden(
  message: string
): { ok: false; error: TemplateError } {
  return failure('TEMPLATE_FORBIDDEN', message);
}

export function failure(
  code: TemplateErrorCode,
  message: string
): { ok: false; error: TemplateError } {
  return { ok: false, error: { code, message } };
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
