import { validate } from '@metriccanvas/page';
import { restoreCanvasAuthoringDraft } from './document-edit';
import type { DurableAuthoringState } from './authoring-sync';
import type { StorageScope, StoredRecord } from './authoring-storage';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
function keys(value: Record<string, unknown>, allowed: string[]) { return Object.keys(value).every((key) => allowed.includes(key)); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (record(value)) return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(',')}}`;
  return JSON.stringify(value);
}
function ref(value: unknown, pageId: string): boolean {
  return value === null || (record(value) && keys(value, ['pageId', 'revisionId', 'resourceId']) && value.pageId === pageId && text(value.revisionId) && text(value.resourceId));
}
/** Reject rather than migrate ambiguous/corrupt records. Frozen commands are never normalized. */
export function validateAuthoringRecord(input: unknown, scope: StorageScope): StoredRecord<DurableAuthoringState> {
  const fail = (): never => { throw new Error('本地创作记录版本、身份或内容校验失败，原记录已保留，请勿覆盖。'); };
  if (![scope.actorId, scope.workspaceId, scope.pageId].every(text)) return fail();
  if (!record(input) || !keys(input, ['version', 'value']) || !Number.isSafeInteger(input.version) || Number(input.version) < 1) return fail();
  const value = input.value;
  if (!record(value) || !keys(value, ['format', 'scope', 'base', 'draft', 'queue', 'undoDraft']) || value.format !== 1 || stable(value.scope) !== stable(scope) || !ref(value.base, scope.pageId) || !Array.isArray(value.queue)) return fail();
  if (!record(value.draft) || !keys(value.draft, ['canvasDocument', 'pageDocument', 'authoringSections'])) return fail();
  const draft = restoreCanvasAuthoringDraft(value.draft);
  if (!draft.ok || draft.draft.pageDocument.id !== scope.pageId) return fail();
  if (value.undoDraft !== undefined) {
    if (!record(value.undoDraft) || !keys(value.undoDraft, ['canvasDocument', 'pageDocument', 'authoringSections'])) return fail();
    const previous = restoreCanvasAuthoringDraft(value.undoDraft);
    if (!previous.ok || previous.draft.pageDocument.id !== scope.pageId) return fail();
  }
  const ids = new Set<string>();
  for (const [index, operation] of value.queue.entries()) {
    if (!record(operation) || !keys(operation, ['operationId', 'document', 'description', 'retainDimensionValues', 'command', 'outcome']) || !text(operation.operationId) || ids.has(operation.operationId) || typeof operation.description !== 'string' || typeof operation.retainDimensionValues !== 'boolean' || !record(operation.document) || operation.document.id !== scope.pageId || validate(operation.document).length) return fail();
    ids.add(operation.operationId);
    if (operation.command !== undefined) {
      const command = operation.command;
      if (index !== 0 || !record(command) || !keys(command, ['context', 'base', 'pageId', 'document', 'description', 'retainDimensionValues']) || command.pageId !== scope.pageId || stable(command.base) !== stable(value.base) || stable(command.document) !== stable(operation.document) || command.description !== operation.description || command.retainDimensionValues !== operation.retainDimensionValues) return fail();
      if (stable(command.context) !== stable({ operationId: operation.operationId, actorId: scope.actorId, workspaceId: scope.workspaceId, origin: { kind: 'manual' } })) return fail();
    }
    if (operation.outcome !== undefined) {
      const outcome = operation.outcome;
      if (!operation.command || !record(outcome) || outcome.operationId !== operation.operationId) return fail();
      if (outcome.status === 'rejected') {
        if (!keys(outcome, ['status', 'operationId', 'code', 'message', 'retryable']) || !text(outcome.code) || typeof outcome.message !== 'string' || typeof outcome.retryable !== 'boolean') return fail();
      } else if (!['pending', 'unknown'].includes(String(outcome.status)) || !keys(outcome, ['status', 'operationId', 'message']) || (outcome.message !== undefined && typeof outcome.message !== 'string')) return fail();
    }
  }
  if (value.queue.length && stable(value.queue.at(-1).document) !== stable(draft.draft.pageDocument)) return fail();
  return structuredClone(input) as unknown as StoredRecord<DurableAuthoringState>;
}
