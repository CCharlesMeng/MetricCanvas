import { createInjectedDqeGateway } from '@metriccanvas/application-runtime';
import { dqeRecord, type JsonObject } from '@metriccanvas/page/internal';
import { candidateEnvelope, candidateHttpRoot } from './full-query-candidate-data';

function trace(phase: 'start' | 'abort', items: readonly JsonObject[]) {
  if (typeof globalThis.dispatchEvent !== 'function') return;
  for (const item of items) {
    const order = dqeRecord(item.order);
    globalThis.dispatchEvent(new CustomEvent('metriccanvas:synthetic-column-query', {
      detail: { phase, kind: Number(order.limit) > 20 ? 'candidate' : 'table', offset: Number(order.offset ?? 0) }
    }));
  }
}

function blockedCandidate(signal: AbortSignal | null | undefined, items: readonly JsonObject[]): Promise<never> {
  return new Promise((_resolve, reject) => {
    const abort = () => { trace('abort', items); reject(Object.assign(new Error('synthetic cancelled'), { name: 'AbortError' })); };
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

function waitForCandidateRelease(signal: AbortSignal | null | undefined, items: readonly JsonObject[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const type = 'metriccanvas:synthetic-column-continue';
    const finish = () => {
      clearTimeout(timer);
      globalThis.removeEventListener(type, finish);
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      globalThis.removeEventListener(type, finish);
      trace('abort', items);
      reject(signal?.reason);
    };
    const timer = setTimeout(finish, 8000);
    globalThis.addEventListener(type, finish, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
  });
}

type CandidateHttpFetch = (items: readonly JsonObject[], url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Exercise the registered application gateway through native DQE envelopes, without a real service. */
export function createFullQueryCandidatesPreview(state = 'ready', httpFetch?: CandidateHttpFetch) {
  const requests: JsonObject[] = [];
  let held = false;
  const fetchImpl: typeof fetch = async (url, init) => {
    init?.signal?.throwIfAborted();
    const body = JSON.parse(String(init?.body)) as { dsl_list: JsonObject[] };
    requests.push(...structuredClone(body.dsl_list));
    trace('start', body.dsl_list);
    if (httpFetch) return httpFetch(body.dsl_list, url, init);
    if (state === 'blocked-candidates' && body.dsl_list.some(item => Number(dqeRecord(item.order).limit) > 20)) await blockedCandidate(init?.signal, body.dsl_list);
    const delayed = ['progressive-candidates', 'late-truncated', 'candidate-retry'].includes(state);
    if (delayed && !held && body.dsl_list.some(item => Number(dqeRecord(item.order).offset) === 200)) {
      held = true;
      await waitForCandidateRelease(init?.signal, body.dsl_list);
      if (state === 'candidate-retry') throw new TypeError('synthetic network failure');
    }
    return Response.json(candidateEnvelope(body.dsl_list, state));
  };
  const dataGateway = createInjectedDqeGateway(fetchImpl, undefined, () => ({
    dqeEndpoint: httpFetch ? `${candidateHttpRoot}/execute` : '/synthetic-dqe', pageMetadataBaseUrl: '/synthetic-pages',
    authToken: 'synthetic', operatorId: 'synthetic', workspaceId: 'synthetic',
    ...(state === 'raised-limit' ? { columnCandidatesMaxRows: 1200 } : {})
  }));
  return { dataGateway, requests };
}

/** Hold only the first second-batch request for this Playground page instance. */
export function createHttpCandidatePreview() {
  const run = Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, '0')).join('');
  let held = false;
  let released = false;
  const transport: CandidateHttpFetch = async (items, url, init) => {
    if (released || held || !items.some(item => Number(dqeRecord(item.order).offset) === 200)) return fetch(url, init);
    held = true;
    const signal = init?.signal;
    const onAbort = () => trace('abort', items);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      return await fetch(`${url}?hold=${run}`, init);
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  };
  return {
    ...createFullQueryCandidatesPreview('ready', transport),
    async release() {
      released = true;
      if (held) await fetch(`${candidateHttpRoot}/release?hold=${run}`, { method: 'POST' });
    }
  };
}
