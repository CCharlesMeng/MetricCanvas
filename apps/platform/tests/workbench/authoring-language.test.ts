import { afterEach, expect, it, vi } from 'vitest';
import { createAuthoringLanguage, type LanguagePort, type LanguageResult, type LanguageContext } from '../../src/lib/workbench/authoring-language';
import { createAuthoringCoordinator, confirmedPageAssetCapabilities, type AuthoringPort } from '../../src/lib/workbench/authoring-coordinator';
import { DRAFT_SAVED_EVENT, type SavedDraft } from '../../src/lib/dialogue/port';
import type { PageRevision } from '../../src/lib/page-assets-client';
const document: PageRevision['document'] = { schemaVersion: '6.2', layout: 'report', id: 'p', dataSources: {}, sections: [{ id: 'main', components: [{ id: 'text', type: 'text', layout: { span: 12 }, props: { title: 'Original', body: 'Private body' } }] }] };
const base = { pageId: 'p', revisionId: 'opaque-old', resourceId: 'resource' };
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((f) => f()));
async function setup(empty = false) {
  let identity = { actorId: 'alice', workspaceId: 'work' }, serial = 0;
  const revision: PageRevision = { ...base, document, revisionNumber: 1, baseRevisionId: null, contentHash: '', createdAt: '', createdBy: '', dataContextVersion: null };
  const authoringPort: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: async () => revision, getRevision: async () => revision, saveRevision: async (_pageId, command) => ({ ...revision, document: command.document as PageRevision['document'] }) };
  const coordinator = createAuthoringCoordinator({ port: authoringPort, identity: () => identity });
  if (!empty) await coordinator.load('p');
  const target = new EventTarget();
  const deliveries = new Map<string, { binding: LanguageContext; draft: SavedDraft }>();
  let context!: LanguageContext;
  let resolve!: (value: LanguageResult) => void;
  const port: LanguagePort = {
    run: vi.fn(async (value) => { context = value; return new Promise<LanguageResult>((done) => { resolve = done; }); }),
    lookup: vi.fn(async () => ({ status: 'not-applied' as const, operations: [] })),
    read: vi.fn(async (id) => { const result = deliveries.get(id); if (!result) throw Error('FORBIDDEN'); return structuredClone(result); })
  };
  const language = createAuthoringLanguage({ coordinator, port, target, identity: () => identity, id: () => `id-${++serial}` });
  cleanups.push(() => { language.dispose(); coordinator.dispose(); });
  const deliver = (id = 'notification', binding = context) => {
    const updated = structuredClone(document); updated.sections[0].components[0].props.title = 'Changed';
    deliveries.set(id, { binding: structuredClone(binding), draft: { draftId: id, ref: { ...base, revisionId: 'opaque-new' }, document: updated } });
    return { status: 'saved' as const, draftId: id, operations: [{ id: 'title', status: 'applied' }] };
  };
  return { coordinator, language, port, target, deliveries, context: () => context, deliver,
    resolve: (value: LanguageResult) => resolve(value), identity: () => { identity = { actorId: 'bob', workspaceId: 'work' }; } };
}
it('waits for synchronization, locks all manual writes, then accepts only exact saved content', async () => {
  const f = await setup(); const draft = f.coordinator.snapshot().draft!;
  const edit = structuredClone(draft); edit.pageDocument.meta = { description: 'edit' };
  f.coordinator.replaceDraft(edit);
  const running = f.language.start('change title'); await flush();
  expect(f.port.run).not.toHaveBeenCalled(); expect(f.language.snapshot().phase).toBe('synchronizing');
  await f.coordinator.save(); await flush();
  expect(f.port.run).toHaveBeenCalledTimes(1); expect(f.coordinator.snapshot().languageLocked).toBe(true);
  expect(f.coordinator.replaceDraft(draft)).toBe(false); expect(await f.coordinator.save()).toBeNull();
  await f.coordinator.load('different'); expect(f.coordinator.snapshot().ref).toEqual(base);
  expect(() => f.coordinator.requireSynchronizedRef()).toThrow();
  f.resolve(f.deliver()); await running; await flush();
  expect(f.language.snapshot().phase).toBe('saved'); expect(f.coordinator.snapshot().languageLocked).toBe(false);
  expect(f.coordinator.snapshot().draft!.pageDocument).toMatchObject({ sections: [{ components: [{ props: { title: 'Changed' } }] }] });
});
it('creates no asset or local page until a legal first saved reference is verified', async () => {
  const f = await setup(true); const run = f.language.start('create'); await flush();
  expect(f.context().base).toBeNull(); expect(f.coordinator.snapshot().draft).toBeNull();
  f.resolve(f.deliver()); await run; await flush(); expect(f.coordinator.snapshot().ref?.revisionId).toBe('opaque-new');
});
for (const status of ['text', 'waiting', 'failed'] as const) it(`${status} preserves the old page and releases editing`, async () => {
  const f = await setup(); const before = f.coordinator.snapshot().draft; const run = f.language.start(status); await flush();
  f.resolve({ status, operations: [] }); await run;
  expect(f.coordinator.snapshot().draft).toEqual(before); expect(f.coordinator.snapshot().languageLocked).toBe(false);
});
it('unknown queries the exact original operation without another run or manufactured success', async () => {
  const f = await setup(); const run = f.language.start('lost ack'); await flush(); const original = structuredClone(f.context());
  f.resolve({ status: 'unknown', operations: [] }); await run;
  expect(f.coordinator.snapshot().ref).toEqual(base); expect(f.coordinator.snapshot().languageLocked).toBe(true);
  f.port.lookup = vi.fn(async () => f.deliver()); await f.language.lookup(); await flush();
  expect(f.port.lookup).toHaveBeenCalledWith(original, expect.any(AbortSignal)); expect(f.port.run).toHaveBeenCalledTimes(1);
  expect(f.language.snapshot().phase).toBe('saved');
});
it('cancelled saved operation is recovered for explicit viewing without replacing the old page', async () => {
  const f = await setup(); const run = f.language.start('slow'); await flush();
  const saved = f.deliver(); f.language.cancel(); f.resolve(saved); await run; await flush();
  expect(f.coordinator.snapshot().ref).toEqual(base);
  f.port.lookup = vi.fn(async () => saved); await f.language.lookup();
  expect(f.language.snapshot()).toMatchObject({ phase: 'recovered', recovery: { revisionId: 'opaque-new' } });
  expect(f.coordinator.snapshot().ref).toEqual(base); expect(f.coordinator.snapshot().languageLocked).toBe(true);
});
it('rejects old first notification after cancel → authoritative not-applied → new round, without parsing opaque IDs', async () => {
  const f = await setup(); const oldRun = f.language.start('old'); await flush();
  const old = f.deliver('zzzz'); f.language.cancel(); f.resolve({ status: 'unknown', operations: [] }); await oldRun;
  await f.language.lookup();
  const newRun = f.language.start('new'); await flush();
  f.target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: old.draftId } })); await flush();
  expect(f.coordinator.snapshot().ref).toEqual(base); expect(f.language.snapshot().message).toContain('RESPONSE_MISMATCH');
  f.resolve(f.deliver('aaaa')); await newRun; await flush(); expect(f.language.snapshot().phase).toBe('saved');
});
it('isolates changed identity before and after an in-flight exact read', async () => {
  const f = await setup(); const run = f.language.start('edit'); await flush(); const saved = f.deliver();
  let complete!: () => void; const originalRead = f.port.read;
  f.port.read = vi.fn(async (id, signal) => { await new Promise<void>((resolve) => complete = resolve); return originalRead(id, signal); });
  f.resolve(saved); await run; await flush(); f.identity(); complete(); await flush();
  expect(f.coordinator.snapshot().ref).toEqual(base); expect(f.language.snapshot()).toMatchObject({ recovery: null, operations: [], phase: 'unknown' });
  await f.language.lookup(); expect(f.port.lookup).not.toHaveBeenCalled();
});
for (const mismatch of ['runId', 'operationId', 'actorId', 'workspaceId', 'base', 'invalid-page', 'resource'] as const) it(`rejects trusted-read ${mismatch} mismatch`, async () => {
  const f = await setup(); const run = f.language.start('edit'); await flush(); const result = f.deliver();
  const delivery = f.deliveries.get(result.draftId)!;
  if (mismatch === 'base') delivery.binding.base = null;
  else if (mismatch === 'invalid-page') delivery.draft.document.schemaVersion = '99.0';
  else if (mismatch === 'resource') delivery.draft.ref.resourceId = 'wrong';
  else delivery.binding[mismatch] = 'wrong';
  f.resolve(result); await run; await flush(); expect(f.coordinator.snapshot().ref).toEqual(base);
  expect(f.language.snapshot().phase).toBe('unknown');
});
it('read failure keeps a partial-success summary truthful and retries only the read through original lookup', async () => {
  const f = await setup(); const run = f.language.start('partial'); await flush();
  f.resolve({ status: 'saved', draftId: 'later', operations: [{ id: 'a', status: 'applied' }, { id: 'b', status: 'failed' }] }); await run; await flush();
  expect(f.language.snapshot().operations.map(o => o.status)).toEqual(['applied', 'failed']); expect(f.coordinator.snapshot().ref).toEqual(base);
  f.port.lookup = vi.fn(async () => f.deliver('later')); await f.language.lookup(); await flush(); expect(f.language.snapshot().phase).toBe('saved');
});
it('pending/accepted duplicate notifications and disposed late reads never apply twice', async () => {
  const f = await setup(); const run = f.language.start('edit'); await flush(); const saved = f.deliver();
  f.resolve(saved); await run;
  f.target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: saved.draftId } }));
  await flush(); expect(f.port.read).toHaveBeenCalledTimes(1);
  f.target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: saved.draftId } })); await flush(); expect(f.port.read).toHaveBeenCalledTimes(1);
});
it('an accepted program notification wins over a later run failure and permits a new round', async () => {
  const f = await setup(); let reject!: (error: Error) => void; let binding!: LanguageContext;
  f.port.run = vi.fn(async (context) => { binding = context; return new Promise<LanguageResult>((_resolve, fail) => reject = fail); });
  const run = f.language.start('async'); await flush();
  const saved = f.deliver('early', binding);
  f.target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: saved.draftId } })); await flush();
  expect(f.language.snapshot().phase).toBe('saved'); reject(Error('late transport failure')); await run;
  expect(f.language.snapshot().phase).toBe('saved');
  f.port.run = vi.fn(async () => ({ status: 'text' as const, operations: [] }));
  await f.language.start('next'); expect(f.port.run).toHaveBeenCalledTimes(1);
});
it('unmount aborts an unsettled exact read and keeps the old page', async () => {
  const f = await setup(); const run = f.language.start('edit'); await flush(); const saved = f.deliver();
  let complete!: () => void; const read = f.port.read;
  f.port.read = async (id, signal) => { await new Promise<void>(resolve => complete = resolve); return read(id, signal); };
  f.resolve(saved); await run; await flush(); f.language.dispose(); complete(); await flush();
  expect(f.coordinator.snapshot().ref).toEqual(base);
});
it('waits for durable browser protection before acquiring a language lease', async () => {
  const f = await setup(); let protect!: () => void;
  f.coordinator.enableAutoSync({ storage: { read: async () => null, write: async () => { await new Promise<void>(resolve => protect = resolve); return 1; } },
    port: { stableSave: false, save: async () => { throw Error('not used'); }, lookup: async () => { throw Error('not used'); }, verifySaved: async () => false } });
  await flush(); const run = f.language.start('edit'); await flush(); expect(f.port.run).not.toHaveBeenCalled();
  protect(); await flush(); expect(f.port.run).toHaveBeenCalledTimes(1);
  f.resolve({ status: 'text', operations: [] }); await run;
});
it('storage failure leaves language pending and cancellation never invokes Relay', async () => {
  const f = await setup(); f.coordinator.enableAutoSync({ storage: { read: async () => { throw Error('denied'); }, write: async () => 1 },
    port: { stableSave: false, save: async () => { throw Error('not used'); }, lookup: async () => { throw Error('not used'); }, verifySaved: async () => false } });
  await flush(); const run = f.language.start('edit'); await flush(); f.language.cancel(); await run;
  expect(f.port.run).not.toHaveBeenCalled(); expect(f.coordinator.snapshot().ref).toEqual(base);
});
