import { expect, it, vi } from 'vitest';
import { APPLY_PAGE_EVENT, listenForApplyPage, pageIdOf } from '../../src/lib/workbench/apply-page';
import { createApplyPageFixture } from '../../src/lib/workbench/apply-page-fixture';
import { createAuthoringCoordinator } from '../../src/lib/workbench/authoring-coordinator';
import { unavailableStableSave, type DurableAuthoringState } from '../../src/lib/workbench/authoring-sync';
import type { StoredRecord } from '../../src/lib/workbench/authoring-storage';

it('validates event payloads and removes the listener on disposal', async () => {
  for (const detail of [null, [], {}, { pageId: '' }, { pageId: ' x' }, { pageId: 'x\n' }, { pageId: 'x'.repeat(513) }, { pageId: 'p', extra: true }]) expect(pageIdOf(detail)).toBeNull();
  expect(pageIdOf({ pageId: 'p' })).toBe('p');
  const target = new EventTarget(), onapply = vi.fn(async () => {}), onerror = vi.fn();
  let identity = 'a';
  const stop = listenForApplyPage({ target, onapply, onpreview: vi.fn(), onerror, captureIdentity: () => identity });
  const send = () => target.dispatchEvent(new CustomEvent(APPLY_PAGE_EVENT, { detail: { pageId: 'p' } }));
  send(); await Promise.resolve(); send(); await Promise.resolve();
  expect(onapply).toHaveBeenCalledTimes(2);
  identity = 'b'; send(); await Promise.resolve(); expect(onapply).toHaveBeenCalledTimes(2);
  identity = 'a'; stop(); send(); await Promise.resolve(); expect(onapply).toHaveBeenCalledTimes(2);
});

it('refreshes past a protected local snapshot and preserves the refreshed content in storage', async () => {
  const { port } = createApplyPageFixture(new EventTarget());
  const revision = await port.getLatest('mock-page-001');
  const getLatest = vi.fn(async () => structuredClone(revision)); port.getLatest = getLatest;
  const coordinator = createAuthoringCoordinator({ port, identity: () => ({ actorId: 'a', workspaceId: 'w' }) });
  let stored: StoredRecord<DurableAuthoringState> | null = null;
  coordinator.enableAutoSync({ port: unavailableStableSave, storage: {
    async read() { return structuredClone(stored); },
    async write(scope, expected, value) {
      expect(expected).toBe(stored?.version ?? 0);
      stored = { version: expected + 1, value: structuredClone(value) }; return stored.version;
    }
  } });
  await coordinator.load('mock-page-001');
  await vi.waitFor(() => expect(coordinator.snapshot().sync?.protection).toBe('protected'));
  revision.revisionId = 'mock-r2';
  await coordinator.load('mock-page-001', { refreshCurrent: true });
  expect(getLatest).toHaveBeenCalledTimes(2);
  expect(coordinator.snapshot().ref?.revisionId).toBe('mock-r2');
  await coordinator.load('mock-page-001');
  expect(getLatest).toHaveBeenCalledTimes(2);
  expect(coordinator.snapshot().ref?.revisionId).toBe('mock-r2');
  coordinator.dispose();
});

it('preserves the page on foreign notifications, failed reads and unsaved edits', async () => {
  const { port } = createApplyPageFixture(new EventTarget());
  const revision = await port.getLatest('mock-page-001');
  port.getLatest = vi.fn(async () => revision);
  const coordinator = createAuthoringCoordinator({ port, identity: () => ({ actorId: 'a', workspaceId: 'w' }) });
  await coordinator.load('mock-page-001', { refreshCurrent: true });
  await coordinator.load('foreign', { refreshCurrent: true });
  expect(port.getLatest).toHaveBeenCalledTimes(1);
  port.getLatest = vi.fn(async () => { throw Error('network failure'); });
  await coordinator.load('mock-page-001', { refreshCurrent: true });
  expect(coordinator.snapshot().error).toContain('network failure');
  expect(coordinator.snapshot().ref?.revisionId).toBe('mock-r0');
  coordinator.replaceDraft(coordinator.snapshot().draft!, 'edit', true);
  await coordinator.load('mock-page-001', { refreshCurrent: true });
  expect(port.getLatest).toHaveBeenCalledTimes(1);
  expect(coordinator.snapshot().dirty).toBe(true);
  coordinator.dispose();
});

it('applies previewJson without reading or saving and gives it precedence over pageId', async () => {
  const target = new EventTarget();
  const { port } = createApplyPageFixture(target);
  const { document } = await port.getLatest('mock-page-001');
  port.getLatest = vi.fn(); port.saveRevision = vi.fn();
  const coordinator = createAuthoringCoordinator({ port, identity: () => ({ actorId: 'a', workspaceId: 'w' }) });
  const onapply = vi.fn(async () => {}), onerror = vi.fn();
  const stop = listenForApplyPage({ target, onapply, onpreview: value => { coordinator.applyPreview(value); }, onerror, captureIdentity: () => 'a' });
  for (const previewJson of [document, JSON.stringify(document)]) {
    target.dispatchEvent(new CustomEvent(APPLY_PAGE_EVENT, { detail: { pageId: 'ignored', previewJson } }));
    await Promise.resolve();
    expect(coordinator.snapshot().draft?.pageDocument).toEqual(document);
  }
  expect(onapply).not.toHaveBeenCalled();
  expect(port.getLatest).not.toHaveBeenCalled();
  expect(port.saveRevision).not.toHaveBeenCalled();
  expect(coordinator.snapshot().ref).toBeNull();
  for (const previewJson of [null, undefined, '{invalid', {}]) {
    target.dispatchEvent(new CustomEvent(APPLY_PAGE_EVENT, { detail: { pageId: 'fallback', previewJson } }));
  }
  await vi.waitFor(() => expect(onerror).toHaveBeenCalledTimes(4));
  expect(onapply).not.toHaveBeenCalled();
  expect(coordinator.snapshot().draft?.pageDocument).toEqual(document);
  stop(); coordinator.dispose();
});
