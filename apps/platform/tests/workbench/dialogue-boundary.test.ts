import { describe, expect, it, vi } from 'vitest';
import { DRAFT_SAVED_EVENT, draftIdOf, listenForSavedDrafts, type SavedDraft } from '../../src/lib/dialogue/port';
import { panguResourceUrl, createPanguResourceLoader } from '../../src/lib/dialogue/runtime';
function draft(id: string): SavedDraft {
  return { draftId: id, ref: { pageId: 'p', revisionId: id, resourceId: 'resource' }, document: {
    schemaVersion: '6.1', layout: 'report', id: 'p', dataSources: {},
    sections: [{ id: 's', title: 's', container: 'panel', components: [{ id: 't', type: 'text', layout: { span: 12 }, props: { body: id } }] }]
  } };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function emit(target: EventTarget, id: unknown) { target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: id } })); }
describe('global draft reference boundary v1', () => {
  it('accepts only a single opaque nonempty ID', () => {
    for (const value of [null, {}, { draftId: '' }, { draftId: ' x' }, { draftId: 'x', document: {} }, { draftId: 1 }]) expect(draftIdOf(value)).toBeNull();
    expect(draftIdOf({ draftId: 'opaque:revision/1' })).toBe('opaque:revision/1');
  });
  it('ignores duplicate and late reads, failures and invalid documents preserve last accepted page', async () => {
    const target = new EventTarget(); let old!: (value: SavedDraft) => void;
    const read = vi.fn(async (id: string) => {
      if (id === 'old') return new Promise<SavedDraft>((resolve) => { old = resolve; });
      if (id === 'fail') throw Error('failed');
      const result = draft(id); if (id === 'invalid') result.document.sections = [];
      return result;
    });
    const onpage = vi.fn(); const onerror = vi.fn();
    const stop = listenForSavedDrafts({ target, read, onpage, onerror });
    emit(target, 'old'); emit(target, 'new'); emit(target, 'new'); await flush();
    old(draft('old')); await flush(); emit(target, 'fail'); await flush(); emit(target, 'invalid'); await flush();
    expect(onpage).toHaveBeenCalledTimes(1); expect(onpage.mock.calls[0][0].draftId).toBe('new');
    expect(read).toHaveBeenCalledTimes(4); expect(onerror).toHaveBeenCalledTimes(2);
    stop(); emit(target, 'removed'); expect(read).toHaveBeenCalledTimes(4);
  });
  it('rejects mismatched references and stale scope, cleans up pending reads on unmount/remount', async () => {
    const target = new EventTarget(); let resolve!: (value: SavedDraft) => void; let scope = 'alice';
    const onpage = vi.fn(), onerror = vi.fn();
    const stop = listenForSavedDrafts({ target, onpage, onerror, captureScope: () => scope,
      read: async () => new Promise<SavedDraft>((done) => { resolve = done; }) });
    emit(target, 'a'); scope = 'bob'; resolve(draft('a')); await flush(); expect(onpage).not.toHaveBeenCalled();
    emit(target, 'b'); stop(); resolve(draft('b')); await flush(); expect(onpage).not.toHaveBeenCalled();
    const stopAgain = listenForSavedDrafts({ target, onpage, onerror, read: async () => draft('wrong') });
    emit(target, 'c'); await flush(); expect(onerror).toHaveBeenCalledWith(expect.stringContaining('RESPONSE_MISMATCH')); stopAgain();
  });
  it('versions deployment resources without touching saved deployment configuration', () => {
    const config = { resourceUrl: '/pangu.js?env=test', version: 'v1' }; const before = { ...config };
    expect(panguResourceUrl(config, 'https://example.test')).toBe('https://example.test/pangu.js?env=test&v=v1');
    expect(config).toEqual(before);
    expect(panguResourceUrl({ ...config, version: 'v2' }, 'https://example.test')).toContain('v=v2');
    expect(() => panguResourceUrl({ resourceUrl: 'javascript:alert(1)', version: '1' }, 'https://example.test')).toThrow();
  });
});


describe('notification retry and SDK document lifetime', () => {
  it('retries a failed ID, suppresses pending/accepted duplicates, isolates identity and old cleanup', async () => {
    const target = new EventTarget(); let identity = 'alice'; let scope = 0;
    let complete!: (value: SavedDraft) => void;
    const read = vi.fn().mockRejectedValueOnce(Error('offline')).mockImplementationOnce(() => new Promise<SavedDraft>((resolve) => { complete = resolve; })).mockResolvedValue(draft('a'));
    const onpage = vi.fn(), onerror = vi.fn();
    const stop = listenForSavedDrafts({ target, read, onpage, onerror, captureScope: () => scope, captureIdentity: () => identity });
    emit(target, 'a'); await flush(); emit(target, 'a'); emit(target, 'a'); expect(read).toHaveBeenCalledTimes(2);
    identity = 'bob'; scope++; emit(target, 'a'); await flush(); complete(draft('a')); await flush();
    emit(target, 'a'); expect(read).toHaveBeenCalledTimes(3); expect(onpage).toHaveBeenCalledTimes(1);
    identity = 'alice'; scope++; emit(target, 'a'); await flush(); expect(onpage).toHaveBeenCalledTimes(2);
    emit(target, 'a'); expect(read).toHaveBeenCalledTimes(4); stop();
  });
  it('retries the same failed resource but rejects v1→v2→v1 in one document', async () => {
    const load = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined);
    const resource = createPanguResourceLoader(load);
    await expect(resource('sdk?v=1')).rejects.toThrow('offline');
    await resource('sdk?v=1'); await resource('sdk?v=1');
    await expect(resource('sdk?v=2')).rejects.toThrow('重新加载页面');
    await resource('sdk?v=1'); expect(load).toHaveBeenCalledTimes(2);
  });
});
