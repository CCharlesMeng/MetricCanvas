import { describe, expect, it, vi } from 'vitest';
import { listenForSavedDrafts, DRAFT_SAVED_EVENT } from '../../src/lib/dialogue/port';
import { createAuthoringCoordinator, confirmedPageAssetCapabilities, type AuthoringPort } from '../../src/lib/workbench/authoring-coordinator';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { PageAssetsError, type PageRevision } from '../../src/lib/page-assets-client';
const document = { schemaVersion: '6.1', layout: 'report', id: 'p', dataSources: {}, sections: [{ id: 's', title: 's', container: 'panel', components: [{ id: 't', type: 'text', layout: { span: 12 }, props: { title: '原标题', body: 'body' } }] }] };
function revision(id = 'r1'): PageRevision {
  return { pageId: 'p', resourceId: 'resource', revisionId: id, revisionNumber: 1, document: document as PageRevision['document'], baseRevisionId: null, contentHash: '', dataContextVersion: null, createdBy: '', createdAt: '' };
}
function setup(save = vi.fn(async () => revision('r2'))) {
  let identity = { actorId: 'alice', workspaceId: 'work' };
  const port: AuthoringPort = { capabilities: confirmedPageAssetCapabilities, getLatest: vi.fn(async () => revision()), getRevision: vi.fn(async () => revision()), saveRevision: save };
  const coordinator = createAuthoringCoordinator({ port, identity: () => identity, operationId: () => 'op-1' });
  return { port, coordinator, save, identity: () => { identity = { actorId: 'bob', workspaceId: 'work' }; } };
}
describe('authoring coordination public boundary', () => {
  it('opens, edits through one working copy, saves once against exact resource/base and preserves provider limits', async () => {
    const { coordinator, save } = setup(); await coordinator.load('p');
    const draft = coordinator.snapshot().draft!;
    expect(coordinator.replaceDraft(draft)).toBe(true);
    const outcome = await coordinator.save();
    expect(outcome).toMatchObject({ status: 'saved', assurance: 'provider-response', context: { operationId: 'op-1' }, ref: { pageId: 'p', revisionId: 'r2', resourceId: 'resource' } });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]).toMatchObject(['p', { baseRevisionId: 'r1', resourceId: 'resource', idempotencyKey: 'op-1' }]);
    expect(coordinator.capabilities).toMatchObject({ history: false, stableSave: false, exactRead: false });
    await expect(coordinator.readSavedDraft('opaque', new AbortController().signal)).rejects.toThrow('CAPABILITY_UNAVAILABLE');
  });
  it('unknown save result blocks new sends, writes and loads while preserving local content', async () => {
    const { coordinator, save } = setup(vi.fn(async () => { throw Error('offline'); }));
    await coordinator.load('p'); expect(await coordinator.save()).toMatchObject({ status: 'unknown' });
    const draft = coordinator.snapshot().draft!; expect(coordinator.replaceDraft(draft)).toBe(false);
    await coordinator.save(); await coordinator.load('other'); expect(save).toHaveBeenCalledTimes(1);
    expect(coordinator.snapshot().draft?.pageDocument.id).toBe('p');
    expect(coordinator.snapshot().ref?.revisionId).toBe('r1');
  });
  it('pending duplicates and manual edits do not issue another request; identity change leaves an unknown result', async () => {
    let resolve!: (revision: PageRevision) => void;
    const save = vi.fn(() => new Promise<PageRevision>((done) => { resolve = done; }));
    const { coordinator, identity } = setup(save); await coordinator.load('p');
    const pending = coordinator.save(); expect(await coordinator.save()).toMatchObject({ status: 'pending' });
    expect(coordinator.replaceDraft(coordinator.snapshot().draft!)).toBe(false);
    identity(); resolve(revision('r2')); expect(await pending).toMatchObject({ status: 'unknown' });
    expect(coordinator.snapshot().ref?.revisionId).toBe('r1'); expect(save).toHaveBeenCalledTimes(1);
  });
  it('known conflict stays rejected and preserves the working copy without resending', async () => {
    const { coordinator, save } = setup(vi.fn(async () => { throw new PageAssetsError('REVISION_CONFLICT', 'conflict', 409); }));
    await coordinator.load('p'); expect(await coordinator.save()).toMatchObject({ status: 'rejected', code: 'REVISION_CONFLICT' });
    await coordinator.save(); expect(save).toHaveBeenCalledTimes(1); expect(coordinator.snapshot().draft?.pageDocument).toEqual(document);
  });
  it('mismatched save receipt is unknown, preview refuses a different revision', async () => {
    const { coordinator } = setup(vi.fn(async () => ({ ...revision('r2'), pageId: 'other' })));
    await coordinator.load('p'); expect(await coordinator.save()).toMatchObject({ status: 'unknown' });
    await expect(coordinator.preview({ pageId: 'p', resourceId: 'resource', revisionId: 'old' })).rejects.toThrow('RESPONSE_MISMATCH');
  });
  it('a late load cannot replace manual changes and invalid pages keep the current document', async () => {
    const { coordinator, port } = setup(); await coordinator.load('p');
    let resolve!: (revision: PageRevision) => void;
    port.getLatest = vi.fn(() => new Promise<PageRevision>((done) => { resolve = done; }));
    const loading = coordinator.load('p');
    const edited = structuredClone(document); edited.sections[0].components[0].props.title = '手工标题';
    const parsed = createCanvasAuthoringDraft(edited); if (!parsed.ok) throw Error(parsed.message);
    coordinator.replaceDraft(parsed.draft); resolve(revision()); await loading;
    expect(JSON.stringify(coordinator.snapshot().draft)).toContain('手工标题');
    port.getLatest = async () => ({ ...revision(), document: { ...revision().document, sections: [] } });
    await coordinator.load('p'); expect(JSON.stringify(coordinator.snapshot().draft)).toContain('手工标题');
    coordinator.dispose();
  });
});

it('does not send a previous identity’s working copy under a new identity', async () => {
  const { coordinator, identity, save } = setup(); await coordinator.load('p'); identity();
  expect(await coordinator.save()).toMatchObject({ status: 'rejected', code: 'IDENTITY_CHANGED' });
  expect(save).not.toHaveBeenCalled();
});

it('preserves unsaved work and rejects a notification for a different page', async () => {
  const { coordinator } = setup(); await coordinator.load('p');
  expect(coordinator.acceptSavedDraft({ draftId: 'x', ref: { pageId: 'other', revisionId: 'r3', resourceId: 'm' }, document: { ...revision().document, id: 'other' } })).toBe(false);
  const edited = structuredClone(document); edited.sections[0].components[0].props.title = '未保存';
  const parsed = createCanvasAuthoringDraft(edited); if (!parsed.ok) throw Error(parsed.message);
  coordinator.replaceDraft(parsed.draft);
  await expect(coordinator.readSavedDraft('r3', new AbortController().signal)).rejects.toThrow('未保存修改');
  expect(coordinator.snapshot().dirty).toBe(true); expect(JSON.stringify(coordinator.snapshot().draft)).toContain('未保存');
});

it('refuses valid documents whose page ID differs from the requested asset', async () => {
  const { coordinator, port } = setup(); await coordinator.load('p');
  port.getLatest = async () => ({ ...revision(), document: { ...revision().document, id: 'foreign' } });
  await coordinator.load('p'); expect(coordinator.snapshot().draft?.pageDocument.id).toBe('p');
  expect(coordinator.snapshot().error).toContain('RESPONSE_MISMATCH');
  port.getRevision = (pageId) => port.getLatest(pageId);
  await expect(coordinator.preview({ pageId: 'p', revisionId: 'r1', resourceId: 'resource' })).rejects.toThrow('RESPONSE_MISMATCH');
});


it('does not advance the base when a PUT receipt changes the opened resource', async () => {
  const { coordinator } = setup(vi.fn(async () => ({ ...revision('r2'), resourceId: 'different-resource' })));
  await coordinator.load('p'); expect(await coordinator.save()).toMatchObject({ status: 'unknown' });
  expect(coordinator.snapshot().ref).toEqual({ pageId: 'p', revisionId: 'r1', resourceId: 'resource' });
});

it('retries an ID after workbench rejection, then deduplicates successful delivery', async () => {
  const { coordinator, port } = setup(); await coordinator.load('p');
  const target = new EventTarget();
  const read = vi.fn(async () => ({ draftId: 'draft-other', ref: { pageId: 'other', revisionId: 'r2', resourceId: 'other-resource' }, document: { ...revision().document, id: 'other' } }));
  const stop = listenForSavedDrafts({ target, read, onpage: coordinator.acceptSavedDraft, onerror: vi.fn() });
  const notify = () => target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: 'draft-other' } }));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  notify(); await settle(); expect(coordinator.snapshot().ref?.pageId).toBe('p');
  port.getLatest = async () => ({ ...revision(), pageId: 'other', resourceId: 'other-resource', document: { ...revision().document, id: 'other' } });
  await coordinator.load('other'); notify(); await settle();
  expect(coordinator.snapshot().ref?.revisionId).toBe('r2');
  notify(); await settle(); expect(read).toHaveBeenCalledTimes(2); stop();
});
