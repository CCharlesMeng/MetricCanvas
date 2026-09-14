import { expect, it, vi } from 'vitest';
import { normalizePageDocument } from '@metriccanvas/page';
import { createAuthoringCoordinator, confirmedPageAssetCapabilities, type AuthoringPort } from '../../src/lib/workbench/authoring-coordinator';
import { createAuthoringSync, type DurableAuthoringState, type StableSavePort } from '../../src/lib/workbench/authoring-sync';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { validateAuthoringRecord } from '../../src/lib/workbench/authoring-recovery';
import { validateHistoryPage } from '../../src/lib/workbench/authoring-history';
import type { AuthoringStorage } from '../../src/lib/workbench/authoring-storage';
const scope = { actorId: 'alice', workspaceId: 'w', pageId: 'p' };
const ref = { pageId: 'p', revisionId: 'r1', resourceId: 'resource' };
function draft(title: string) {
  const parsed = createCanvasAuthoringDraft({ schemaVersion: '6.1', id: 'p', layout: 'report', dataSources: {}, sections: [{ id: 's', components: [{ id: 't', type: 'text', layout: { span: 12 }, props: { title, body: 'preserved' } }] }] });
  if (!parsed.ok) throw Error(parsed.message); return parsed.draft;
}
function setup() {
  let value: DurableAuthoringState = { format: 1, scope, base: ref, draft: draft('original'), queue: [] }, version = 1, count = 1;
  const storage: AuthoringStorage<DurableAuthoringState> = { read: async () => ({ value: structuredClone(value), version }), write: vi.fn(async (_scope, _version, next) => { value = structuredClone(next); return ++version; }) };
  const port: StableSavePort = { stableSave: true, save: vi.fn<StableSavePort['save']>(async (command) => ({ status: 'saved', operationId: command.context.operationId, base: command.base, ref: { ...ref, revisionId: `r${++count}` }, revisionNumber: count, contentHash: 'hash', canonicalization: 'test', })), lookup: vi.fn<StableSavePort['lookup']>(async (context) => ({ status: 'unknown', operationId: context.operationId })), verifySaved: async () => true };
  return { storage, port, stored: () => ({ value, version }) };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
it('undo is a new compensating operation, preserves the unsent original and survives reopening', async () => {
  const f = setup();
  const first = createAuthoringSync({ initial: f.stored().value, restoredVersion: 1, storage: f.storage, port: f.port, identity: () => scope, online: false });
  await first.enqueue(draft('changed'), 'change', false); first.dispose();
  const restored = validateAuthoringRecord(f.stored(), scope);
  const sync = createAuthoringSync({ initial: restored.value, restoredVersion: restored.version, storage: f.storage, port: f.port, identity: () => scope, online: false });
  const originalOperation = f.stored().value.queue[0].operationId;
  expect(sync.snapshot().canUndo).toBe(true); expect(JSON.stringify(await sync.undo(false))).toContain('original');
  expect(f.stored().value.queue).toHaveLength(2); expect(f.stored().value.queue[0].operationId).toBe(originalOperation);
  expect(f.stored().value.queue[1].operationId).not.toBe(originalOperation); expect(sync.snapshot().canUndo).toBe(false);
  sync.setOnline(true); await settle(); expect(f.port.save).toHaveBeenCalledTimes(2);
  const calls = vi.mocked(f.port.save).mock.calls; expect(calls[1][0].base?.revisionId).toBe('r2'); expect(calls[1][0].retainDimensionValues).toBe(false); sync.dispose();
});
it('undo queries an unknown issued operation and never deletes or overwrites a conflict', async () => {
  const f = setup(); f.port.save = vi.fn<StableSavePort['save']>(async (command) => ({ status: 'unknown', operationId: command.context.operationId }));
  const sync = createAuthoringSync({ initial: f.stored().value, restoredVersion: 1, storage: f.storage, port: f.port, identity: () => scope, retryDelays: [] });
  await sync.enqueue(draft('changed'), 'change', true); await settle(); const before = structuredClone(f.stored().value.queue[0].command);
  await expect(sync.undo()).rejects.toThrow(/先核实/); expect(f.port.lookup).toHaveBeenCalledTimes(1); expect(f.stored().value.queue).toHaveLength(1);
  f.port.lookup = async (context) => ({ status: 'rejected', operationId: context.operationId, code: 'REVISION_CONFLICT', message: 'conflict', retryable: false });
  await expect(sync.undo()).rejects.toThrow(); expect(f.stored().value.queue[0].command).toEqual(before); expect(f.port.save).toHaveBeenCalledTimes(1); sync.dispose();
});
it('restoring an exact old revision saves a new operation against current base and keeps source content', async () => {
  const f = setup(); let actorId = 'alice';
  const old = normalizePageDocument(draft('historical').pageDocument); if (!old.ok) throw Error('fixture');
  const oldRef = { ...ref, revisionId: 'old' };
  const history: AuthoringPort = { capabilities: { ...confirmedPageAssetCapabilities, exactRead: true, history: true }, getLatest: vi.fn(), getRevision: vi.fn(async () => ({ ...oldRef, document: old.document, revisionNumber: 1, baseRevisionId: null, contentHash: 'fixture', dataContextVersion: null, createdBy: '', createdAt: '' })), saveRevision: vi.fn(), listRevisions: vi.fn(async () => ({ snapshot: ref, revisions: [{ ref: oldRef }], nextCursor: null })) };
  const coordinator = createAuthoringCoordinator({ port: history, identity: () => ({ actorId, workspaceId: 'w' }) });
  coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  await coordinator.restoreRevision(oldRef); await settle(); expect(f.port.save).toHaveBeenCalledTimes(1);
  expect(vi.mocked(f.port.save).mock.calls[0][0]).toMatchObject({ base: ref, document: old.document, description: '恢复历史修订 old' });
  expect(coordinator.requireSynchronizedRef().revisionId).toBe('r2'); expect(old.document).toEqual(vi.mocked(f.port.save).mock.calls[0][0].document);
  await coordinator.restoreRevision(oldRef); await settle(); expect(f.port.save).toHaveBeenCalledTimes(2); // explicit restore is an action even for equal content
  actorId = 'bob'; await expect(coordinator.listHistory()).rejects.toThrow(); await expect(coordinator.restoreRevision(oldRef)).rejects.toThrow(); coordinator.dispose();
});
it('history rejects unavailable capabilities, wrong resources, changed snapshots and duplicate entries', async () => {
  const f = setup(); const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  await expect(coordinator.listHistory()).rejects.toThrow(/尚未开放页面历史/); await expect(coordinator.restoreRevision(ref)).rejects.toThrow(/尚未开放历史精确读取/); expect(port.getRevision).not.toHaveBeenCalled(); coordinator.dispose();
  expect(() => validateHistoryPage({ snapshot: ref, revisions: [{ ref }, { ref }], nextCursor: null }, 'p')).toThrow();
  expect(() => validateHistoryPage({ snapshot: ref, revisions: [], nextCursor: 'next' }, 'p', { ...ref, revisionId: 'different' })).toThrow();
  expect(() => validateHistoryPage({ snapshot: ref, revisions: [{ ref: { ...ref, resourceId: 'wrong' } }], nextCursor: null }, 'p')).toThrow();
});
it('late historical reads cannot overwrite a new manual operation or a switched identity', async () => {
  const f = setup(); let resolve!: (value: Awaited<ReturnType<AuthoringPort['getRevision']>>) => void;
  const port: AuthoringPort = { capabilities: { ...confirmedPageAssetCapabilities, exactRead: true }, getLatest: vi.fn(), getRevision: vi.fn<AuthoringPort['getRevision']>(() => new Promise((done) => { resolve = done; })), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  const restoring = coordinator.restoreRevision(ref); await settle(); coordinator.replaceDraft(draft('new manual'));
  const parsed = normalizePageDocument(draft('old read').pageDocument); if (!parsed.ok) throw Error('fixture');
  resolve({ ...ref, document: parsed.document, revisionNumber: 1, baseRevisionId: null, contentHash: 'fixture', dataContextVersion: null, createdBy: '', createdAt: '' }); await expect(restoring).rejects.toThrow(/已变化/); expect(JSON.stringify(coordinator.snapshot().draft)).toContain('new manual'); coordinator.dispose();
});
it('restore waits for unknown save resolution and rejects a mismatched exact revision without overwriting', async () => {
  const f = setup();
  const parsed = normalizePageDocument(draft('history').pageDocument); if (!parsed.ok) throw Error('fixture');
  const port: AuthoringPort = { capabilities: { ...confirmedPageAssetCapabilities, exactRead: true }, getLatest: vi.fn(), getRevision: vi.fn(async () => ({ ...ref, revisionId: 'wrong', document: parsed.document, revisionNumber: 1, baseRevisionId: null, contentHash: '', dataContextVersion: null, createdBy: '', createdAt: '' })), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  await expect(coordinator.restoreRevision(ref)).rejects.toThrow(/预览引用不匹配/); expect(JSON.stringify(coordinator.snapshot().draft)).toContain('original');
  f.port.save = vi.fn<StableSavePort['save']>(async (command) => ({ status: 'unknown', operationId: command.context.operationId }));
  coordinator.replaceDraft(draft('unconfirmed')); await settle(); vi.mocked(port.getRevision).mockClear();
  await expect(coordinator.restoreRevision(ref)).rejects.toThrow(/尚未完成同步/); expect(f.port.lookup).toHaveBeenCalledTimes(1); expect(port.getRevision).not.toHaveBeenCalled(); coordinator.dispose();
});
it('identity changes during a paginated history read discard the returned page', async () => {
  const f = setup(); let actorId = 'alice'; let resolve!: (value: Awaited<ReturnType<NonNullable<AuthoringPort['listRevisions']>>>) => void;
  const port: AuthoringPort = { capabilities: { ...confirmedPageAssetCapabilities, history: true }, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn(), listRevisions: vi.fn<NonNullable<AuthoringPort['listRevisions']>>(() => new Promise((done) => { resolve = done; })) };
  const coordinator = createAuthoringCoordinator({ port, identity: () => ({ actorId, workspaceId: 'w' }) }); coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  const reading = coordinator.listHistory(); actorId = 'bob'; resolve({ snapshot: ref, revisions: [{ ref }], nextCursor: null });
  await expect(reading).rejects.toThrow(/范围已变化/); coordinator.dispose();
});
