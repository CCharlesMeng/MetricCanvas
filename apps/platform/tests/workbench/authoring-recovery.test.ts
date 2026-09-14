import { normalizePageDocument } from '@metriccanvas/page';
import { afterEach, expect, it, vi } from 'vitest';
import { createAuthoringSync, type DurableAuthoringState, type DurableSaveCommand, type StableSavePort } from '../../src/lib/workbench/authoring-sync';
import { validateAuthoringRecord } from '../../src/lib/workbench/authoring-recovery';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { createAuthoringCoordinator, confirmedPageAssetCapabilities, type AuthoringPort } from '../../src/lib/workbench/authoring-coordinator';
import { AuthoringStorageConflict, type AuthoringStorage, type StoredRecord } from '../../src/lib/workbench/authoring-storage';
const scope = { actorId: 'alice', workspaceId: 'w', pageId: 'p' };
const base = { pageId: 'p', revisionId: 'r1', resourceId: 'resource' };
function draft(title = 'offline') {
  const result = createCanvasAuthoringDraft({ schemaVersion: '6.1', id: 'p', layout: 'report', dataSources: {}, sections: [{ id: 's', components: [{ id: 't', type: 'text', layout: { span: 12 }, props: { title, body: '' } }] }] });
  if (!result.ok) throw Error(result.message); return result.draft;
}
function fixture(issued = true) {
  const parsed = normalizePageDocument(draft().pageDocument); if (!parsed.ok) throw Error('invalid fixture');
  const document = parsed.document;
  const command: DurableSaveCommand = { context: { actorId: 'alice', workspaceId: 'w', operationId: 'original', origin: { kind: 'manual' } }, base, pageId: 'p', document, description: 'edit', retainDimensionValues: false };
  const value: DurableAuthoringState = { format: 1, scope, base, draft: draft(), queue: [{ operationId: 'original', document, description: 'edit', retainDimensionValues: false, ...(issued ? { command } : {}) }] };
  let stored: StoredRecord<DurableAuthoringState> = { version: 7, value };
  const storage: AuthoringStorage<DurableAuthoringState> = { read: vi.fn(async () => structuredClone(stored)), write: vi.fn(async (_scope, version, next) => { if (version !== stored.version) throw new AuthoringStorageConflict(); stored = { version: version + 1, value: structuredClone(next) }; return stored.version; }) };
  const receipt = { status: 'saved' as const, operationId: 'original', base, ref: { ...base, revisionId: 'r2' }, contentHash: 'verified-by-port', canonicalization: 'test/1', revisionNumber: 2 };
  const port: StableSavePort = { stableSave: true, save: vi.fn(async () => receipt), lookup: vi.fn(async () => receipt), verifySaved: vi.fn(async () => true) };
  return { command, value, storage, port, stored: () => stored, overwrite: () => { stored.version++; } };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); });
function start(f: ReturnType<typeof fixture>, extra: Partial<Parameters<typeof createAuthoringSync>[0]> = {}) {
  const sync = createAuthoringSync({ initial: validateAuthoringRecord(f.stored(), scope).value, restoredVersion: 7, storage: f.storage, port: f.port, identity: () => scope, retryDelays: [], ...extra });
  cleanups.push(() => sync.dispose()); sync.start(); return sync;
}
it('reopening an issued command without outcome queries the original key and never repeats save', async () => {
  const f = fixture(); const sync = start(f); await settle();
  expect(f.port.lookup).toHaveBeenCalledWith(f.command.context); expect(f.port.save).not.toHaveBeenCalled();
  expect(sync.snapshot()).toMatchObject({ pending: 0, protection: 'protected', base: { revisionId: 'r2' } }); expect(f.stored().version).toBe(8);
});
it('offline recovery keeps editing; reconnect sends unissued work with original operation and frozen choice', async () => {
  const f = fixture(false); const sync = start(f, { online: false });
  await sync.enqueue(draft('later'), 'later', true); expect(f.port.save).not.toHaveBeenCalled(); expect(sync.snapshot().pending).toBe(2);
  f.port.save = vi.fn<StableSavePort['save']>(async (command) => ({ status: 'rejected', operationId: command.context.operationId, code: 'REVISION_CONFLICT', message: 'conflict', retryable: false }));
  sync.setOnline(true); await settle();
  expect(f.port.save).toHaveBeenCalledTimes(1); expect(vi.mocked(f.port.save).mock.calls[0][0]).toMatchObject({ context: { operationId: 'original' }, retainDimensionValues: false, base });
  expect(sync.snapshot()).toMatchObject({ pending: 2, phase: 'rejected' });
});
it('recovery resends an issued command only after authoritative not-applied and preserves all fields', async () => {
  const f = fixture(); f.port.lookup = vi.fn<StableSavePort['lookup']>(async () => ({ status: 'not-applied', operationId: 'original', retrySafe: true }));
  start(f); await settle(); expect(f.port.save).toHaveBeenCalledExactlyOnceWith(f.command);
});
it('rejects damaged, future, cross-identity and injected operational fields without writing', () => {
  const f = fixture();
  const changes: ((record: any) => void)[] = [
    (r) => r.value.format = 2, (r) => r.value.scope.actorId = 'bob', (r) => r.value.draft.pageDocument.schemaVersion = '6.3',
    (r) => r.value.queue[0].command.context.token = 'credential', (r) => r.value.queue[0].command.base = { ...base, revisionId: 'other' },
    (r) => r.value.queue[0].operationId = 'different', (r) => r.value.draft.authoringSections = []
  ];
  for (const change of changes) { const raw = structuredClone(f.stored()); change(raw); expect(() => validateAuthoringRecord(raw, scope)).toThrow(/原记录已保留/); }
  expect(f.storage.write).not.toHaveBeenCalled();
});
it('restores empty authoring sections without changing the formal page or frozen version', () => {
  const f = fixture(); const raw = structuredClone(f.stored());
  (raw.value.draft.canvasDocument.sections as unknown[]).push({ id: 'empty', components: [] });
  raw.value.draft.authoringSections.push({ id: 'empty', componentIds: [] });
  const restored = validateAuthoringRecord(raw, scope);
  expect(restored.value.draft.authoringSections).toHaveLength(2); expect(restored.value.draft.pageDocument.sections).toHaveLength(1);
  expect(restored.value.queue[0].command?.document.schemaVersion).toBe('6.1');
});
it.each(['AUTH_REQUIRED', 'VALIDATION_FAILED', 'REVISION_CONFLICT'])('restored %s stays paused and keeps content', async (code) => {
  const f = fixture(); f.value.queue[0].outcome = { status: 'rejected', operationId: 'original', code, message: code, retryable: true };
  const sync = start(f); await sync.retry(); sync.setOnline(false); sync.setOnline(true); await settle();
  expect(f.port.lookup).not.toHaveBeenCalled(); expect(f.port.save).not.toHaveBeenCalled(); expect(sync.snapshot().pending).toBe(1);
});
it('unknown lookup retries with bounded backoff and stops at the configured budget', async () => {
  vi.useFakeTimers(); const f = fixture(); f.port.lookup = vi.fn<StableSavePort['lookup']>(async () => ({ status: 'unknown', operationId: 'original' }));
  const sync = start(f, { retryDelays: [10, 20, 40] });
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.port.lookup).toHaveBeenCalledTimes(4); expect(f.port.save).not.toHaveBeenCalled(); expect(sync.snapshot().pending).toBe(1);
  await vi.advanceTimersByTimeAsync(1000); expect(f.port.lookup).toHaveBeenCalledTimes(4);
});
it('a conflicting storage version cannot overwrite another window or send work', async () => {
  const f = fixture(false); const sync = start(f, { online: false }); f.overwrite(); const before = structuredClone(f.stored());
  await sync.enqueue(draft('new memory'), 'new', true); sync.setOnline(true); await settle();
  expect(sync.snapshot().protection).toBe('failed'); expect(f.stored()).toEqual(before); expect(f.port.save).not.toHaveBeenCalled();
});
it('coordinator restores local work before any remote read and scopes each user separately', async () => {
  const f = fixture(false); f.port.stableSave = false; let actorId = 'alice';
  f.storage.read = vi.fn(async (requested) => requested.actorId === 'alice' ? structuredClone(f.stored()) : null);
  const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(async () => { throw Error('offline'); }), getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => ({ actorId, workspaceId: 'w' }) }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  expect(port.getLatest).not.toHaveBeenCalled(); expect(JSON.stringify(coordinator.snapshot().draft)).toContain('offline');
  expect(() => coordinator.requireSynchronizedRef()).toThrow(/尚未完成同步/);
  await expect(coordinator.readSavedDraft('another', new AbortController().signal)).rejects.toThrow(/保存结果未确定/);
  actorId = 'bob'; expect(coordinator.replaceDraft(draft('bob content'))).toBe(false);
  const second = createAuthoringCoordinator({ port, identity: () => ({ actorId, workspaceId: 'w' }) }); cleanups.push(() => second.dispose());
  second.enableAutoSync({ storage: f.storage, port: f.port }); await second.load('p');
  expect(second.snapshot().draft).toBeNull(); expect(f.storage.read).toHaveBeenLastCalledWith({ actorId: 'bob', workspaceId: 'w', pageId: 'p' });
});
it('a delayed local read cannot restore old user content after identity changes', async () => {
  const f = fixture(); let resolve!: (value: StoredRecord<DurableAuthoringState>) => void, actorId = 'alice';
  f.storage.read = () => new Promise((done) => { resolve = done; });
  const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => ({ actorId, workspaceId: 'w' }) }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port }); const loading = coordinator.load('p'); actorId = 'bob'; resolve(f.stored()); await loading;
  expect(coordinator.snapshot().draft).toBeNull(); expect(port.getLatest).not.toHaveBeenCalled(); expect(f.port.lookup).not.toHaveBeenCalled();
});
it('failed local read preserves visible edits without claiming protection or overwriting unknown records', async () => {
  const f = fixture(); f.storage.read = vi.fn(async () => { throw Error('denied'); });
  const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port });
  expect(coordinator.acceptSavedDraft({ draftId: 'draft', ref: base, document: f.command.document })).toBe(true); await settle();
  expect(coordinator.replaceDraft(draft('memory only'))).toBe(true);
  expect(coordinator.snapshot().sync?.protection).toBe('failed'); expect(() => coordinator.requireSynchronizedRef()).toThrow();
  expect(f.storage.write).not.toHaveBeenCalled(); expect(f.port.save).not.toHaveBeenCalled();
});
it('a fully protected recovered revision opens the shared synchronized-content gate', async () => {
  const f = fixture(); f.value.queue = [];
  const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  expect(coordinator.requireSynchronizedRef()).toEqual(base); expect(f.port.save).not.toHaveBeenCalled();
});
it('a new accepted exact draft replaces an already synchronized local record using its CAS version', async () => {
  const f = fixture(); f.value.queue = [];
  const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port });
  const newer = normalizePageDocument(draft('new exact draft').pageDocument); if (!newer.ok) throw Error('fixture');
  coordinator.acceptSavedDraft({ draftId: 'new', ref: { ...base, revisionId: 'r3' }, document: newer.document }); await settle();
  expect(coordinator.requireSynchronizedRef().revisionId).toBe('r3'); expect(JSON.stringify(f.stored().value.draft)).toContain('new exact draft'); expect(f.stored().version).toBe(8);
});
it('unmount cancels scheduled retries and ignores an in-flight recovered result without deleting the command', async () => {
  vi.useFakeTimers(); const f = fixture();
  f.port.lookup = vi.fn<StableSavePort['lookup']>(async () => ({ status: 'unknown', operationId: 'original' }));
  const sync = start(f, { retryDelays: [10, 20] }); await vi.advanceTimersByTimeAsync(0); sync.dispose();
  await vi.advanceTimersByTimeAsync(100); expect(f.port.lookup).toHaveBeenCalledTimes(1);
  const second = fixture(); let resolve!: (value: Awaited<ReturnType<StableSavePort['lookup']>>) => void;
  second.port.lookup = vi.fn<StableSavePort['lookup']>(() => new Promise((done) => { resolve = done; }));
  const other = start(second); await vi.advanceTimersByTimeAsync(0); other.dispose();
  resolve(await second.port.save(second.command)); await vi.advanceTimersByTimeAsync(0);
  expect(second.storage.write).not.toHaveBeenCalled(); expect(second.stored().value.queue[0].command).toEqual(second.command);
});
it('opening a fresh remote revision protects its initial copy before opening the synchronized gate', async () => {
  const f = fixture(); f.storage.read = vi.fn(async () => null);
  f.storage.write = vi.fn(async (_scope, version) => version + 1);
  const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port }); coordinator.acceptSavedDraft({ draftId: 'new', ref: base, document: f.command.document }); await settle();
  expect(coordinator.requireSynchronizedRef()).toEqual(base); expect(f.storage.write).toHaveBeenCalledTimes(1); expect(f.port.save).not.toHaveBeenCalled();
});
it('language reads and receipts wait for initial protection while an empty canvas can receive creation', async () => {
  const f = fixture(); f.storage.read = vi.fn(async () => null);
  let protect!: (version: number) => void;
  f.storage.write = vi.fn(() => new Promise<number>((resolve) => { protect = resolve; }));
  const savedDraft = { draftId: 'new', ref: base, document: f.command.document };
  const port: AuthoringPort = { capabilities: { ...confirmedPageAssetCapabilities, exactDraftRead: true }, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn(), readSavedDraft: vi.fn(async () => savedDraft) };
  const coordinator = createAuthoringCoordinator({ port, identity: () => scope }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port });
  await expect(coordinator.readSavedDraft('new', new AbortController().signal)).resolves.toEqual(savedDraft);
  expect(coordinator.acceptSavedDraft(savedDraft)).toBe(true); await settle(); vi.mocked(port.readSavedDraft!).mockClear();
  expect(coordinator.snapshot()).toMatchObject({ loading: false, sync: { pending: 0, protection: 'pending' } });
  await expect(coordinator.readSavedDraft('new', new AbortController().signal)).rejects.toThrow();
  expect(port.readSavedDraft).not.toHaveBeenCalled(); expect(coordinator.acceptSavedDraft(savedDraft)).toBe(false);
  expect(() => coordinator.requireSynchronizedRef()).toThrow();
  protect(1); await settle();
  await expect(coordinator.readSavedDraft('new', new AbortController().signal)).resolves.toEqual(savedDraft);
  expect(coordinator.requireSynchronizedRef()).toEqual(base);
  coordinator.dispose(); expect(() => coordinator.requireSynchronizedRef()).toThrow();
  await expect(coordinator.readSavedDraft('new', new AbortController().signal)).rejects.toThrow();
  expect(coordinator.acceptSavedDraft(savedDraft)).toBe(false);
});
it('a changed owner with an empty protected queue cannot read or accept language results', async () => {
  const f = fixture(); f.value.queue = []; let actorId = 'alice';
  const savedDraft = { draftId: 'new', ref: base, document: f.command.document };
  const port: AuthoringPort = { capabilities: { ...confirmedPageAssetCapabilities, exactDraftRead: true }, getLatest: vi.fn(), getRevision: vi.fn(), saveRevision: vi.fn(), readSavedDraft: vi.fn(async () => savedDraft) };
  const coordinator = createAuthoringCoordinator({ port, identity: () => ({ actorId, workspaceId: 'w' }) }); cleanups.push(() => coordinator.dispose());
  coordinator.enableAutoSync({ storage: f.storage, port: f.port }); await coordinator.load('p');
  actorId = 'bob';
  await expect(coordinator.readSavedDraft('new', new AbortController().signal)).rejects.toThrow();
  expect(port.readSavedDraft).not.toHaveBeenCalled(); expect(coordinator.acceptSavedDraft(savedDraft)).toBe(false);
  expect(() => coordinator.requireSynchronizedRef()).toThrow(); expect(f.storage.write).not.toHaveBeenCalled();
});
