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
type QueueOperation = Record<string, unknown>;
const invalidRecord = (): never => { throw new Error('本地创作记录版本、身份或内容校验失败，原记录已保留，请勿覆盖。'); };

/** Reject rather than migrate ambiguous/corrupt records. Frozen commands are never normalized. */
export function validateAuthoringRecord(input: unknown, scope: StorageScope): StoredRecord<DurableAuthoringState> {
  if (![scope.actorId, scope.workspaceId, scope.pageId].every(text)) return invalidRecord();
  if (!record(input) || !keys(input, ['version', 'value']) || !Number.isSafeInteger(input.version) || Number(input.version) < 1) return invalidRecord();
  const value = input.value;
  if (!validState(value, scope)) return invalidRecord();
  if (!validConfirmed(value.confirmed, scope)) return invalidRecord();
  const draft = restoredDraft(value.draft, scope.pageId);
  if (!draft) return invalidRecord();
  if (value.undoDraft !== undefined && !restoredDraft(value.undoDraft, scope.pageId)) return invalidRecord();
  validateQueue(value, scope);
  if (value.queue.length && !value.localDirty && stable((value.queue.at(-1) as QueueOperation).document) !== stable(draft.pageDocument)) return invalidRecord();
  return structuredClone(input) as unknown as StoredRecord<DurableAuthoringState>;
}

function validateQueue(value: Record<string, unknown> & { queue: unknown[] }, scope: StorageScope): void {
  const ids = new Set<string>();
  for (const [index, operation] of value.queue.entries()) {
    if (!validOperation(operation, ids, scope.pageId)) return invalidRecord();
    if (operation.intent !== undefined && !['saveDraft', 'publish'].includes(String(operation.intent))) return invalidRecord();
    ids.add(operation.operationId);
    if (operation.command !== undefined && !validCommand(operation.command, operation, value.base, scope, index)) return invalidRecord();
    if (operation.outcome !== undefined && !validOutcome(operation.outcome, operation)) return invalidRecord();
  }
}

function validState(value: unknown, scope: StorageScope): value is Record<string, unknown> & { queue: unknown[] } {
  if (!record(value) || !keys(value, ['format', 'scope', 'base', 'draft', 'queue', 'undoDraft', 'confirmed', 'localDirty']) || ![1, 2, 3].includes(Number(value.format)) || stable(value.scope) !== stable(scope) || !ref(value.base, scope.pageId) || !Array.isArray(value.queue)) return false;
  if (value.format === 3 && typeof value.localDirty !== 'boolean') return false;
  return value.format === 3 || value.localDirty === undefined;
}

function validDocument(value: unknown, pageId: string): boolean {
  return record(value) && value.id === pageId && !validate(value).length;
}

function validConfirmed(value: unknown, scope: StorageScope): boolean {
  if (value === undefined) return true;
  return record(value) && value.pageId === scope.pageId && text(value.resourceId) &&
    (scope.resourceId === undefined || value.resourceId === scope.resourceId) && text(value.revisionId) &&
    Number.isSafeInteger(value.revisionNumber) && Number(value.revisionNumber) >= 1 && validDocument(value.document, scope.pageId);
}

function restoredDraft(value: unknown, pageId: string) {
  if (!record(value) || !keys(value, ['canvasDocument', 'pageDocument', 'authoringSections'])) return undefined;
  const result = restoreCanvasAuthoringDraft(value);
  return result.ok && result.draft.pageDocument.id === pageId ? result.draft : undefined;
}

function validOperation(value: unknown, ids: ReadonlySet<string>, pageId: string): value is QueueOperation & { operationId: string } {
  return record(value) && keys(value, ['operationId', 'document', 'description', 'retainDimensionValues', 'command', 'outcome', 'intent']) && text(value.operationId) && !ids.has(value.operationId) && typeof value.description === 'string' && typeof value.retainDimensionValues === 'boolean' && validDocument(value.document, pageId);
}

function validCommand(command: unknown, operation: QueueOperation, base: unknown, scope: StorageScope, index: number): boolean {
  if (index !== 0 || !record(command) || !keys(command, ['context', 'base', 'pageId', 'document', 'description', 'retainDimensionValues', 'intent']) || command.pageId !== scope.pageId || stable(command.base) !== stable(base) || stable(command.document) !== stable(operation.document) || command.description !== operation.description || command.retainDimensionValues !== operation.retainDimensionValues || command.intent !== operation.intent) return false;
  return stable(command.context) === stable({ operationId: operation.operationId, actorId: scope.actorId, workspaceId: scope.workspaceId, origin: { kind: 'manual' } });
}

function validOutcome(outcome: unknown, operation: QueueOperation): boolean {
  if (!operation.command || !record(outcome) || outcome.operationId !== operation.operationId) return false;
  if (outcome.status === 'rejected') return keys(outcome, ['status', 'operationId', 'code', 'message', 'retryable']) && text(outcome.code) && typeof outcome.message === 'string' && typeof outcome.retryable === 'boolean';
  return ['pending', 'unknown'].includes(String(outcome.status)) && keys(outcome, ['status', 'operationId', 'message']) && (outcome.message === undefined || typeof outcome.message === 'string');
}
