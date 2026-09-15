import { afterEach, expect, it, vi } from 'vitest';
import { createAuthoringLanguage, authoringDocumentHash, type LanguagePort, type LanguageResult, type LanguageContext } from '../../src/lib/workbench/authoring-language';
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
  const authoringPort: AuthoringPort = { capabilities: { ...confirmedPageAssetCapabilities, latestRead: true }, getLatest: async () => revision, getRevision: async () => revision, saveRevision: async (_pageId, command) => ({ ...revision, document: command.document as PageRevision['document'] }) };
  const coordinator = createAuthoringCoordinator({ port: authoringPort, identity: () => identity });
  if (!empty) await coordinator.load('p');
  const target = new EventTarget();
  const deliveries = new Map<string, { binding: LanguageContext; draft: SavedDraft }>();
  let context!: LanguageContext;
  let resolve!: (value: LanguageResult) => void;
  const port: LanguagePort = {
    prepare: vi.fn<NonNullable<LanguagePort['prepare']>>(async request => ({ version: '1.0', contextRef: request.turnId, actorId: request.actorId, workspaceId: request.workspaceId,
      requestId: request.requestId, runId: request.runId, turnId: request.turnId, pageId: request.pageId ?? 'p', capabilityVersion: '1.0', status: 'active',
      mode: request.mode, access: request.access, baseRef: request.latest ? { pageId: request.latest.pageId, revisionId: request.latest.revisionId, resourceId: request.latest.resourceId! } : null,
      documentSha256: request.latest ? await authoringDocumentHash(request.latest.document) : null, selectedComponentId: request.selectedComponentId })),
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
  return { coordinator, language, port, authoringPort, target, deliveries, context: () => context, deliver,
    resolve: (value: LanguageResult) => resolve(value), identity: () => { identity = { actorId: 'bob', workspaceId: 'work' }; } };
}
it('waits for synchronization, locks all manual writes, then accepts only exact saved content', async () => {
  const f = await setup(); const draft = f.coordinator.snapshot().draft!;
  const edit = structuredClone(draft); edit.pageDocument.meta = { description: 'edit' };
  f.coordinator.replaceDraft(edit);
  let completeSave!: () => void; const save = f.authoringPort.saveRevision;
  f.authoringPort.saveRevision = async (...args) => { await new Promise<void>(resolve => completeSave = resolve); return save(...args); };
  const running = f.language.start('change title'); await flush();
  expect(f.port.run).not.toHaveBeenCalled(); expect(f.coordinator.snapshot().languageLocked).toBe(true);
  completeSave(); await flush();
  expect(f.port.run).toHaveBeenCalledTimes(1); expect(f.coordinator.snapshot().languageLocked).toBe(true);
  expect(f.coordinator.replaceDraft(draft)).toBe(false); expect(await f.coordinator.save()).toBeNull();
  await f.coordinator.load('different'); expect(f.coordinator.snapshot().ref).toEqual(base);
  expect(() => f.coordinator.requireSynchronizedRef()).toThrow();
  f.resolve(f.deliver()); await running; await flush();
  expect(f.language.snapshot().phase).toBe('saved'); expect(f.coordinator.snapshot().languageLocked).toBe(false);
  expect(f.coordinator.snapshot().draft!.pageDocument).toMatchObject({ sections: [{ components: [{ props: { title: 'Changed' } }] }] });
});
it('creates no asset or local page until a legal first saved reference is verified', async () => {
  const f = await setup(true); const run = f.language.start('create', { mode: 'new' }); await flush();
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
for (const field of ['pageId', 'revisionId', 'resourceId'] as const) it(`cancelled first creation rejects a saved recovery missing ${field}`, async () => {
  const f = await setup(true); const run = f.language.start('create', { mode: 'new' }); await flush();
  const saved = f.deliver(); const entry = f.deliveries.get(saved.draftId)!;
  Reflect.deleteProperty(entry.draft.ref, field);
  f.language.cancel(); f.resolve(saved); await run;
  f.port.lookup = vi.fn(async () => saved); await f.language.lookup();
  expect(f.language.snapshot()).toMatchObject({ phase: 'unknown', recovery: null });
  expect(f.language.snapshot().message).toContain('RESPONSE_MISMATCH');
  expect(f.coordinator.snapshot().draft).toBeNull(); expect(f.coordinator.snapshot().ref).toBeNull();
});
for (const missing of ['prepare', 'latestRead'] as const) it(`fails closed without ${missing}, preserving the local document`, async () => {
  const f = await setup(); const before = f.coordinator.snapshot().draft;
  if (missing === 'prepare') f.port.prepare = undefined;
  else f.authoringPort.capabilities.latestRead = false;
  await f.language.start('edit');
  expect(f.language.snapshot()).toMatchObject({ phase: 'failed', message: expect.stringContaining('CAPABILITY_UNAVAILABLE') });
  expect(f.port.run).not.toHaveBeenCalled(); expect(f.coordinator.snapshot().draft).toEqual(before);
  expect(f.coordinator.snapshot().languageLocked).toBe(false);
});
it('requires explicit new intent when no current page exists', async () => {
  const f = await setup(true); await f.language.start('make something');
  expect(f.port.prepare).not.toHaveBeenCalled(); expect(f.port.run).not.toHaveBeenCalled();
});
it('re-reads latest for clarification and read-only turns and updates the unlocked local baseline', async () => {
  const f = await setup(); let number = 1;
  const initial = await f.authoringPort.getLatest('p');
  f.authoringPort.getLatest = vi.fn(async () => ({ ...initial, revisionId: `revision-${++number}`, document: { ...document, meta: { description: `latest-${number}` } } }));
  f.port.run = vi.fn<LanguagePort['run']>(async () => ({ status: 'waiting', operations: [] }));
  await f.language.start('clarify'); const first = vi.mocked(f.port.prepare!).mock.calls[0][0];
  await f.language.start('configuration question', { access: 'read' });
  const second = vi.mocked(f.port.prepare!).mock.calls[1][0];
  expect(first.turnId).not.toBe(second.turnId); expect(second.access).toBe('read');
  expect(f.authoringPort.getLatest).toHaveBeenCalledTimes(2);
  expect(f.coordinator.snapshot().ref?.revisionId).toBe('revision-3');
  expect(f.coordinator.snapshot().draft?.pageDocument.meta).toEqual({ description: 'latest-3' });
  expect(f.coordinator.snapshot().languageLocked).toBe(false);
  expect(vi.mocked(f.port.run).mock.calls[1][0]).not.toHaveProperty('document');
  expect(second.documentJson).toContain('latest-3');
});
it('latest failure never uses cache or invokes prepare/run', async () => {
  const f = await setup(); const before = f.coordinator.snapshot().draft;
  f.authoringPort.getLatest = async () => { throw Error('latest failed'); };
  await f.language.start('edit'); expect(f.port.prepare).not.toHaveBeenCalled();
  expect(f.port.run).not.toHaveBeenCalled(); expect(f.coordinator.snapshot().draft).toEqual(before);
});
for (const field of ['actorId','workspaceId','requestId','runId','turnId','pageId','documentSha256','capabilityVersion','selectedComponentId'] as const) it(`rejects prepare ${field} mismatch before content execution`, async () => {
  const f = await setup(); const prepare = f.port.prepare!;
  f.port.prepare = async (...args) => ({ ...await prepare(...args), [field]: 'wrong' });
  await f.language.start('edit'); expect(f.port.run).not.toHaveBeenCalled();
  expect(f.language.snapshot().message).toContain('RESPONSE_MISMATCH');
});
it('cancellation releases preparation lock and late prepare never runs content', async () => {
  const f = await setup(); let complete!: () => void; const prepare = f.port.prepare!;
  f.port.prepare = async (...args) => { await new Promise<void>(resolve => complete = resolve); return prepare(...args); };
  const run = f.language.start('edit'); await flush();
  expect(f.coordinator.replaceDraft(f.coordinator.snapshot().draft!)).toBe(false);
  f.language.cancel(); complete(); await run;
  expect(f.port.run).not.toHaveBeenCalled(); expect(f.coordinator.snapshot().languageLocked).toBe(false);
});
it('flush admits preexisting input under the lock and synchronizes it before reading latest', async () => {
  const f = await setup(); const draft = f.coordinator.snapshot().draft!; draft.pageDocument.meta = { description: 'pending input' };
  const order: string[] = []; const revision = await f.authoringPort.getLatest('p');
  f.authoringPort.saveRevision = async (_id, command) => { order.push('save'); return { ...revision, document: command.document as PageRevision['document'] }; };
  f.authoringPort.getLatest = async () => { order.push('latest'); return { ...revision, document: { ...document, meta: { description: 'pending input' } } }; };
  f.port.run = vi.fn<LanguagePort['run']>(async () => ({ status: 'text', operations: [] }));
  const language = createAuthoringLanguage({ coordinator: f.coordinator, port: f.port, target: f.target,
    identity: () => ({ actorId: 'alice', workspaceId: 'work' }), flushPendingInput: () => {
      expect(f.coordinator.snapshot().languageLocked).toBe(true); order.push('flush'); expect(f.coordinator.replaceDraft(draft)).toBe(true);
    } });
  await language.start('edit'); language.dispose();
  expect(order).toEqual(['flush', 'save', 'latest']);
  expect(f.coordinator.snapshot().draft?.pageDocument.meta).toEqual({ description: 'pending input' });
});
it('read-only saved response never announces or reads an unauthorized save', async () => {
  const f = await setup(); const run = f.language.start('explain configuration', { access: 'read' }); await flush();
  f.resolve(f.deliver()); await run;
  expect(f.language.snapshot()).toMatchObject({ phase: 'unknown', message: expect.not.stringContaining('已保存') });
  expect(f.port.read).not.toHaveBeenCalled(); expect(f.coordinator.snapshot().ref).toEqual(base);
});
for (const selection of [{ pageId: 'other', componentId: 'text' }, { pageId: 'p', componentId: 'deleted' }, { pageId: 'p', componentId: 'text' }]) it(`binds only a live top-level selection ${JSON.stringify(selection)}`, async () => {
  const f = await setup(); f.port.run = vi.fn<LanguagePort['run']>(async () => ({ status: 'text', operations: [] }));
  const language = createAuthoringLanguage({ coordinator: f.coordinator, port: f.port, target: f.target, identity: () => ({ actorId: 'alice', workspaceId: 'work' }), selection: () => selection });
  await language.start('this component'); language.dispose();
  const binding = vi.mocked(f.port.run).mock.calls[0][0].binding;
  expect(binding.selectedComponentId).toBe(selection.pageId === 'p' && selection.componentId === 'text' ? 'text' : null);
});
it('unknown synchronization preserves the draft and recovery lock without requesting content', async () => {
  const f = await setup(); const draft = f.coordinator.snapshot().draft!; draft.pageDocument.meta = { description: 'local' };
  f.coordinator.replaceDraft(draft); f.authoringPort.saveRevision = async () => { throw Error('lost save response'); };
  await f.language.start('edit');
  expect(f.port.prepare).not.toHaveBeenCalled(); expect(f.port.run).not.toHaveBeenCalled();
  expect(f.coordinator.snapshot()).toMatchObject({ draft, languageLocked: true, save: { status: 'unknown' } });
  expect(f.coordinator.replaceDraft(draft)).toBe(false);
});
it('first creation rejects a returned page different from the allocated identity', async () => {
  const f = await setup(true); const prepare = f.port.prepare!;
  f.port.prepare = async (...args) => ({ ...await prepare(...args), pageId: 'allocated-other' });
  const run = f.language.start('create', { mode: 'new' }); await flush(); f.resolve(f.deliver()); await run; await flush();
  expect(f.coordinator.snapshot().draft).toBeNull(); expect(f.language.snapshot().phase).toBe('unknown');
});
it('a failed preparation-to-language transition can release its temporary lock', async () => {
  const f = await setup(); const preparation = f.coordinator.beginPreparation();
  const draft = f.coordinator.snapshot().draft!; draft.pageDocument.meta = { description: 'unsynchronized' };
  preparation.flush(() => f.coordinator.replaceDraft(draft));
  expect(() => preparation.acquire()).toThrow(); preparation.release();
  expect(f.coordinator.snapshot().languageLocked).toBe(false);
  expect(f.coordinator.replaceDraft(draft)).toBe(true);
});
it('latest refuses a resource replacement for the current page', async () => {
  const f = await setup(); const revision = await f.authoringPort.getLatest('p');
  f.authoringPort.getLatest = async () => ({ ...revision, resourceId: 'another-resource' });
  await f.language.start('edit'); expect(f.port.prepare).not.toHaveBeenCalled();
  expect(f.language.snapshot().message).toContain('RESPONSE_MISMATCH');
  expect(f.coordinator.snapshot().ref).toEqual(base);
});
for (const interruption of ['identity', 'cancel'] as const) it(`does not send a complete document after ${interruption} during hashing`, async () => {
  const f = await setup(); const digest = crypto.subtle.digest.bind(crypto.subtle);
  let complete!: () => void;
  const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
    await new Promise<void>(resolve => complete = resolve); return digest(...args);
  });
  try {
    const run = f.language.start('edit'); await flush();
    if (interruption === 'identity') f.identity(); else f.language.cancel();
    complete(); await run;
    expect(f.port.prepare).not.toHaveBeenCalled(); expect(f.port.run).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
