import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createAuthoringSync, type DurableAuthoringState, type DurableSaveCommand, type StrongSaved, type StableSavePort } from '../../src/lib/workbench/authoring-sync';
import type { AuthoringStorage } from '../../src/lib/workbench/authoring-storage';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
function draft(title: string) {
  const result = createCanvasAuthoringDraft({ schemaVersion: '6.1', layout: 'report', id: 'sync-page', dataSources: {}, sections: [{ id: 's', title: 's', container: 'panel', components: [{ id: 't', type: 'text', layout: { span: 12 }, props: { title, body: 'body' } }] }] });
  if (!result.ok) throw Error(result.message); return result.draft;
}
const hash = (command: DurableSaveCommand) => createHash('sha256').update(JSON.stringify(command.document)).digest('hex');
function saved(command: DurableSaveCommand, index: number): StrongSaved {
  return { status: 'saved', operationId: command.context.operationId, base: command.base, ref: { pageId: command.pageId, resourceId: 'resource', revisionId: `r${index}` }, contentHash: hash(command), canonicalization: 'fixture-json/1', revisionNumber: index };
}
function setup() {
  const writes: DurableAuthoringState[] = []; let failStorage = false; let identity = 'alice';
  const storage: AuthoringStorage<DurableAuthoringState> = {
    async read() { return null; }, async write(_scope, version, value) { if (failStorage) throw Error('quota'); writes.push(structuredClone(value)); return version + 1; }
  };
  let count = 1, operation = 0;
  const port: StableSavePort = {
    stableSave: true, save: vi.fn(async (command) => saved(command, ++count)),
    lookup: vi.fn<StableSavePort['lookup']>(async (context) => ({ status: 'unknown', operationId: context.operationId })),
    async verifySaved(command, receipt) { return receipt.contentHash === hash(command); }
  };
  const sync = createAuthoringSync({ initial: { format: 1, scope: { actorId: 'alice', workspaceId: 'w', pageId: 'sync-page' }, base: { pageId: 'sync-page', revisionId: 'r1', resourceId: 'resource' }, draft: draft('initial'), queue: [] }, storage, port,
    identity: () => ({ actorId: identity, workspaceId: 'w' }), operationId: () => `op-${++operation}` });
  return { sync, port, writes, failStorage: (value: boolean) => { failStorage = value; }, changeIdentity: () => { identity = 'bob'; } };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
describe('durable serial authoring operations', () => {
  it('protects each operation before serial save, uses confirmed bases and ignores no-change', async () => {
    const { sync, port, writes } = setup(); let finish!: (receipt: StrongSaved) => void; const commands: DurableSaveCommand[] = [];
    port.save = vi.fn<StableSavePort['save']>((command) => {
      commands.push(command);
      expect(writes.some((state) => state.queue.some((item) => item.command?.context.operationId === command.context.operationId))).toBe(true);
      return commands.length === 1 ? new Promise<StrongSaved>((resolve) => { finish = resolve; }) : Promise.resolve(saved(command, 3));
    });
    await sync.enqueue(draft('one'), 'one', true); await settle();
    await sync.enqueue(draft('two'), 'two', false); await sync.enqueue(draft('two'), 'no-change', false);
    expect(commands).toHaveLength(1); finish(saved(commands[0], 2)); await settle();
    expect(commands).toHaveLength(2); expect(commands[1].base?.revisionId).toBe('r2');
    expect(commands[1].retainDimensionValues).toBe(false);
    expect(sync.snapshot()).toMatchObject({ pending: 0, phase: 'idle', protection: 'protected', base: { revisionId: 'r3' } });
    expect(JSON.stringify(writes.at(-1)?.draft)).toContain('two'); sync.dispose();
  });
  it('storage failure never sends unprotected work; explicit retry protects then sends', async () => {
    const { sync, port, failStorage } = setup(); failStorage(true);
    await sync.enqueue(draft('one'), 'one', true); await settle();
    expect(port.save).not.toHaveBeenCalled(); expect(sync.snapshot()).toMatchObject({ protection: 'failed', pending: 1 });
    failStorage(false); await sync.retry(); await settle(); expect(port.save).toHaveBeenCalledTimes(1); expect(sync.snapshot().pending).toBe(0); sync.dispose();
  });
  it('lost acknowledgement queries original operation rather than creating another revision', async () => {
    const { sync, port } = setup(); let result!: StrongSaved;
    port.save = vi.fn<StableSavePort['save']>(async (command) => { result = saved(command, 2); throw Error('lost ack'); });
    port.lookup = vi.fn(async () => result);
    await sync.enqueue(draft('one'), 'one', true); await settle();
    expect(sync.snapshot()).toMatchObject({ phase: 'unknown', protection: 'protected', pending: 1 });
    await sync.retry(); await settle(); expect(port.save).toHaveBeenCalledTimes(1); expect(sync.snapshot().pending).toBe(0); sync.dispose();
  });
  it('unknown and expired dedup windows never resend; authoritative not-applied retries identical command', async () => {
    const { sync, port } = setup(); const commands: DurableSaveCommand[] = [];
    port.save = vi.fn<StableSavePort['save']>(async (command) => { commands.push(command); if (commands.length === 1) throw Error('offline'); return saved(command, 2); });
    await sync.enqueue(draft('one'), 'one', true); await settle(); await sync.retry();
    expect(commands).toHaveLength(1);
    port.lookup = async (context) => ({ status: 'not-applied', operationId: context.operationId, retrySafe: false }); await sync.retry(); expect(commands).toHaveLength(1);
    port.lookup = async (context) => ({ status: 'not-applied', operationId: context.operationId, retrySafe: true }); await sync.retry(); await settle();
    expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]); sync.dispose();
  });
  it('conflict or bad integrity preserves queue and never advances base', async () => {
    for (const kind of ['conflict', 'hash'] as const) {
      const { sync, port } = setup();
      port.save = vi.fn<StableSavePort['save']>(async (command) => kind === 'conflict' ? { status: 'rejected', operationId: command.context.operationId, code: 'REVISION_CONFLICT', message: 'conflict', retryable: false } : { ...saved(command, 2), contentHash: 'wrong' });
      await sync.enqueue(draft('one'), 'one', true); await settle(); await sync.retry();
      expect(port.save).toHaveBeenCalledTimes(1); expect(sync.snapshot().pending).toBe(1); expect(sync.snapshot().base?.revisionId).toBe('r1'); sync.dispose();
    }
  });
  it('unavailable service and changed identity do not send', async () => {
    const { sync, port, changeIdentity } = setup(); port.stableSave = false;
    await sync.enqueue(draft('one'), 'one', true); expect(sync.snapshot()).toMatchObject({ phase: 'unavailable', protection: 'protected' }); expect(port.save).not.toHaveBeenCalled();
    port.stableSave = true; changeIdentity(); await sync.retry(); expect(port.save).not.toHaveBeenCalled(); sync.dispose();
  });
});

it('malformed transport results become unknown without a retry loop', async () => {
  const { sync, port } = setup();
  port.save = vi.fn(async () => JSON.parse('null'));
  await sync.enqueue(draft('one'), 'one', true); await settle();
  expect(sync.snapshot()).toMatchObject({ phase: 'unknown', pending: 1 });
  expect(port.save).toHaveBeenCalledTimes(1); sync.dispose();
});

it('does not advance or discard an issued command when identity changes during verification', async () => {
  const { sync, port, writes, changeIdentity } = setup();
  let resolve!: (value: boolean) => void;
  port.verifySaved = vi.fn(() => new Promise<boolean>((done) => { resolve = done; }));
  await sync.enqueue(draft('one'), 'one', true); await settle();
  const before = structuredClone(writes.at(-1)); changeIdentity(); resolve(true); await settle();
  expect(sync.snapshot()).toMatchObject({ phase: 'identity-changed', pending: 1, base: { revisionId: 'r1' } });
  expect(writes.at(-1)).toEqual(before); expect(writes.at(-1)?.queue[0].command?.context.operationId).toBe('op-1'); sync.dispose();
});

it('never writes a new identity edit into the previous identity scope', async () => {
  const { sync, port, writes, changeIdentity } = setup(); port.stableSave = false;
  await sync.enqueue(draft('old-user'), 'old', true); const before = structuredClone(writes);
  changeIdentity(); await sync.enqueue(draft('new-user'), 'new', true); await sync.retry();
  expect(writes).toEqual(before); expect(port.save).not.toHaveBeenCalled();
  expect(sync.snapshot().phase).toBe('identity-changed'); sync.dispose();
});
