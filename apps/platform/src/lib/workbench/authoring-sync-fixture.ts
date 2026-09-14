/** Development-only external-boundary stand-in; routes are supplied by the browser test harness. */
import type { StableSavePort } from './authoring-sync';
export type SyncFixtureMode = 'delay' | 'lost-ack' | 'conflict' | 'offline';
async function request(path: string, body: unknown) {
  const response = await fetch(`/__fixtures/authoring/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('受控同步替身暂不可用。');
  return response.json();
}
export function createStableSaveFixture(mode: () => SyncFixtureMode): StableSavePort {
  return {
    stableSave: true,
    save: (command) => request('save', { command, mode: mode() }),
    lookup: (context) => request('lookup', { context }),
    async verifySaved(command, saved) {
      const bytes = new TextEncoder().encode(JSON.stringify(command.document));
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((value) => value.toString(16).padStart(2, '0')).join('');
      return saved.canonicalization === 'fixture-json/1' && saved.contentHash === hash;
    }
  };
}

import { pageAuthoringPort } from '../page-assets';
import type { AuthoringPort } from './authoring-coordinator';
/** Explicit dev-only lifecycle history port; no production endpoint is inferred. */
export function createAuthoringHistoryFixture(): AuthoringPort {
  return {
    ...pageAuthoringPort,
    capabilities: { ...pageAuthoringPort.capabilities, history: true, exactRead: true },
    getRevision: (pageId, revisionId) => request('read-revision', { pageId, revisionId }),
    listRevisions: (pageId, cursor, limit) => request('list-revisions', { pageId, cursor, limit })
  };
}
