import { afterEach, expect, it, vi } from 'vitest';
import { createAuthoringCoordinator, confirmedPageAssetCapabilities, type AuthoringPort } from '../../src/lib/workbench/authoring-coordinator';
import { createAuthoringLanguageRecovery, type RecoverySummary, type TrustedLanguageRecoveryPort } from '../../src/lib/workbench/authoring-language-recovery';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import type { DurableAuthoringState, StableSavePort } from '../../src/lib/workbench/authoring-sync';
import type { AuthoringStorage } from '../../src/lib/workbench/authoring-storage';
import type { PageRevision } from '../../src/lib/page-assets-client';

const document: PageRevision['document'] = { schemaVersion: '6.5', layout: 'report', id: 'p', dataSources: {}, sections: [{ id: 'main', components: [{ id: 'text', type: 'text', layout: { span: 12 }, props: { title: 'Saved title', body: 'body' } }] }] };
const ref = { pageId: 'p', resourceId: 'resource', revisionId: 'saved-r2' };
const pending: RecoverySummary = { formatVersion: '1.0', recoveryRef: 'private-recovery', actorId: 'actor', workspaceId: 'workspace', pageId: 'p', operationId: 'private-operation', status: 'unknown', cancelRequested: false, ref: null, previewState: 'not-requested' };
const saved: RecoverySummary = { ...pending, status: 'saved', ref };
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));
function setup(initial: RecoverySummary | null = pending, pageId: string | null = 'p') {
  let identity = { actorId: 'actor', workspaceId: 'workspace' }, currentPage = pageId, serial = 0;
  const authoringPort: AuthoringPort = { capabilities: confirmedPageAssetCapabilities,
    getLatest: vi.fn(async () => ({ ...ref, document, revisionNumber: 2, baseRevisionId: null, contentHash: '', dataContextVersion: null, createdAt: '', createdBy: '' })),
    getRevision: vi.fn(), saveRevision: vi.fn() };
  const coordinator = createAuthoringCoordinator({ port: authoringPort, identity: () => identity });
  const port: TrustedLanguageRecoveryPort = {
    loadPending: vi.fn(async () => structuredClone(initial)),
    recover: vi.fn(async () => structuredClone(saved)),
    cancel: vi.fn(async () => ({ ...pending, cancelRequested: true })),
    retryOriginal: vi.fn(async () => structuredClone(saved)),
    readVerified: vi.fn(async () => ({ draftId: 'draft', ref: structuredClone(ref), document: structuredClone(document) }))
  };
  const resume = vi.fn(async (target: string | null) => { if (target) await coordinator.load(target); });
  const recovery = createAuthoringLanguageRecovery({ coordinator, port, identity: () => identity, currentPageId: () => currentPage, resume, id: () => `attempt-${++serial}` });
  cleanups.push(() => { recovery.dispose(); coordinator.dispose(); });
  return { coordinator, authoringPort, port, resume, recovery, setIdentity: () => { identity = { actorId: 'other', workspaceId: 'workspace' }; }, setPage: (value: string) => { currentPage = value; } };
}
it('locks synchronously before discovery; only trusted null allows ordinary load', async () => {
  const f = setup(null); let complete!: () => void;
  f.port.loadPending = vi.fn(async () => { await new Promise<void>(resolve => complete = resolve); return null; });
  const checking = f.recovery.check('p');
  expect(f.coordinator.snapshot().languageLocked).toBe(true); expect(f.resume).not.toHaveBeenCalled();
  expect(() => f.coordinator.beginPreparation()).toThrow();
  await f.coordinator.load('p'); expect(f.authoringPort.getLatest).not.toHaveBeenCalled();
  complete(); await checking;
  expect(f.resume).toHaveBeenCalledWith('p'); expect(f.coordinator.snapshot().languageLocked).toBe(false);
});
it('no-page startup checks workspace recovery before allowing a new page', async () => {
  const f = setup(null, null); await f.recovery.check(null);
  expect(f.port.loadPending).toHaveBeenCalledWith({ actorId: 'actor', workspaceId: 'workspace', pageId: null }, expect.any(AbortSignal));
  expect(f.resume).toHaveBeenCalledWith(null); expect(f.authoringPort.getLatest).not.toHaveBeenCalled();
});
it('a unique workspace pending result binds its real page without guessing', async () => {
  const f = setup(pending, null); await f.recovery.check(null); await f.recovery.recover(); await f.recovery.openSaved();
  expect(f.coordinator.snapshot().ref).toEqual(ref); expect(f.recovery.snapshot().phase).toBe('opened');
});
it('discovery error keeps lock and permits a second check', async () => {
  const f = setup(); f.port.loadPending = vi.fn(async () => { throw Error('AMBIGUOUS_PENDING'); });
  await f.recovery.check('p'); expect(f.coordinator.snapshot().languageLocked).toBe(true); expect(f.resume).not.toHaveBeenCalled();
  f.port.loadPending = vi.fn(async () => null); await f.recovery.check('p'); expect(f.resume).toHaveBeenCalledTimes(1);
});
it('unknown and unverified save retain the lock; verified open alone adopts exact document', async () => {
  const f = setup(); await f.recovery.check('p');
  f.port.recover = vi.fn<TrustedLanguageRecoveryPort['recover']>(async () => ({ ...saved, status: 'saved-unverified' }));
  await f.recovery.recover(); await f.recovery.openSaved();
  expect(f.port.readVerified).not.toHaveBeenCalled(); expect(f.resume).not.toHaveBeenCalled();
  expect(f.coordinator.snapshot().languageLocked).toBe(true);
  f.port.recover = vi.fn(async () => structuredClone(saved)); await f.recovery.recover();
  expect(f.coordinator.snapshot().draft).toBeNull(); await f.recovery.openSaved();
  expect(f.coordinator.snapshot().draft?.pageDocument).toEqual(document);
  expect(f.coordinator.snapshot().languageLocked).toBe(false);
});
it('pending repeated check cannot replace operation or switch pages', async () => {
  const f = setup(); await f.recovery.check('p'); await f.recovery.check('p'); await f.recovery.check('other');
  expect(f.port.loadPending).toHaveBeenCalledTimes(1); expect(f.coordinator.snapshot().languageLocked).toBe(true);
  expect(f.recovery.snapshot().summary?.operationId).toBe(pending.operationId);
});
it('cancel keeps unresolved state and queries use fresh program attempt IDs', async () => {
  const f = setup(); await f.recovery.check('p'); await f.recovery.cancel();
  expect(f.coordinator.snapshot().languageLocked).toBe(true);
  f.port.recover = vi.fn(async () => ({ ...pending, cancelRequested: true }));
  await f.recovery.recover(); await f.recovery.recover();
  expect(vi.mocked(f.port.recover).mock.calls.map(call => call[1])).toEqual(['attempt-1', 'attempt-2']);
});
for (const status of ['not-applied', 'rejected', 'unchanged'] as const) it(`authoritative ${status} releases and normally loads`, async () => {
  const f = setup(); await f.recovery.check('p'); f.port.recover = vi.fn(async () => ({ ...pending, status }));
  await f.recovery.recover(); expect(f.resume).toHaveBeenCalledTimes(1); expect(f.coordinator.snapshot().languageLocked).toBe(false);
});
for (const key of ['actorId', 'workspaceId', 'pageId', 'operationId', 'recoveryRef', 'formatVersion'] as const) it(`rejects changed ${key} without release`, async () => {
  const f = setup(); await f.recovery.check('p');
  f.port.recover = vi.fn(async () => ({ ...saved, [key]: 'wrong' } as RecoverySummary));
  await f.recovery.recover(); expect(f.recovery.snapshot().phase).toBe('error'); expect(f.coordinator.snapshot().languageLocked).toBe(true);
  expect(f.resume).not.toHaveBeenCalled();
});
it('rejects a changed established exact ref and bad readVerified document', async () => {
  const f = setup(saved); await f.recovery.check('p');
  f.port.recover = vi.fn(async () => ({ ...saved, ref: { ...ref, revisionId: 'wrong' } }));
  await f.recovery.recover(); expect(f.recovery.snapshot().summary?.ref).toEqual(ref);
  f.port.readVerified = vi.fn(async () => ({ draftId: 'bad', ref, document: { ...document, id: 'other' } }));
  await f.recovery.openSaved(); expect(f.coordinator.snapshot().draft).toBeNull(); expect(f.coordinator.snapshot().languageLocked).toBe(true);
});
for (const change of ['identity', 'page', 'dispose'] as const) it(`isolates ${change} while discovery is in flight`, async () => {
  const f = setup(); let complete!: () => void;
  f.port.loadPending = vi.fn(async () => { await new Promise<void>(resolve => complete = resolve); return saved; });
  const checking = f.recovery.check('p');
  if (change === 'identity') f.setIdentity(); else if (change === 'page') f.setPage('other'); else f.recovery.dispose();
  complete(); await checking; expect(f.resume).not.toHaveBeenCalled(); expect(f.coordinator.snapshot().draft).toBeNull();
});
it('late exact read after disposal never adopts the saved page', async () => {
  const f = setup(saved); await f.recovery.check('p'); let complete!: () => void; const read = f.port.readVerified;
  f.port.readVerified = vi.fn<TrustedLanguageRecoveryPort['readVerified']>(async (...args) => { await new Promise<void>(resolve => complete = resolve); return read(...args); });
  const opening = f.recovery.openSaved(); f.recovery.dispose(); complete(); await opening;
  expect(f.coordinator.snapshot().draft).toBeNull();
});

it('does not read or send an existing manual queue until explicit open and preserves its conflict', async () => {
  const f = setup(saved); f.recovery.dispose();
  const local = structuredClone(document); local.sections[0].components[0].props.title = 'Unsynchronized manual title';
  const parsed = createCanvasAuthoringDraft({ ...local }); if (!parsed.ok) throw Error(parsed.message);
  const oldRef = { ...ref, revisionId: 'older-manual-base' };
  const scope = { actorId: 'actor', workspaceId: 'workspace', pageId: 'p' };
  const command = { context: { actorId: scope.actorId, workspaceId: scope.workspaceId, operationId: 'manual-original', origin: { kind: 'manual' as const } },
    base: oldRef, pageId: 'p', document: local, description: 'manual change', retainDimensionValues: false };
  const value: DurableAuthoringState = { format: 1, scope, base: oldRef, draft: parsed.draft,
    queue: [{ operationId: 'manual-original', document: local, description: command.description, retainDimensionValues: false, command }] };
  const storage: AuthoringStorage<DurableAuthoringState> = { read: vi.fn(async () => ({ version: 1, value: structuredClone(value) })), write: vi.fn(async (_scope, version) => version + 1) };
  const syncPort: StableSavePort = { stableSave: true, save: vi.fn(), verifySaved: vi.fn(async () => false),
    lookup: vi.fn(async () => ({ status: 'rejected' as const, operationId: 'manual-original', code: 'REVISION_CONFLICT', message: 'conflict', retryable: false })) };
  const recovery = createAuthoringLanguageRecovery({ coordinator: f.coordinator, port: f.port, identity: () => scope, resume: f.resume,
    protectSaved: () => f.coordinator.enableAutoSync({ storage, port: syncPort }) });
  cleanups.push(() => recovery.dispose());
  await recovery.check('p');
  expect(storage.read).not.toHaveBeenCalled(); expect(syncPort.lookup).not.toHaveBeenCalled(); expect(syncPort.save).not.toHaveBeenCalled();
  await recovery.openSaved();
  expect(recovery.snapshot().phase).toBe('error'); expect(f.coordinator.snapshot().languageLocked).toBe(true);
  expect(f.coordinator.snapshot().draft?.pageDocument).toEqual(local); expect(f.coordinator.snapshot().ref).toEqual(oldRef);
  expect(syncPort.lookup).toHaveBeenCalledWith(command.context); expect(syncPort.save).not.toHaveBeenCalled();
});
