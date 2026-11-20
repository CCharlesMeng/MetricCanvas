import type { IncomingMessage, ServerResponse } from 'node:http';
import type { JsonObject } from '@metriccanvas/page/internal';
import type { Plugin } from 'vite';
import { candidateEnvelope, candidateHttpRoot } from './full-query-candidate-data';

async function readItems(request: IncomingMessage): Promise<JsonObject[]> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new Error('Synthetic DQE request too large');
    chunks.push(buffer);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { dsl_list?: JsonObject[] };
  if (!Array.isArray(body.dsl_list)) throw new Error('Expected dsl_list');
  return body.dsl_list;
}

type Waiting = Map<string, () => void>;

function waitForRelease(waiting: Waiting, token: string, response: ServerResponse): Promise<void> {
  if (waiting.has(token) || waiting.size >= 32) throw new Error('Synthetic DQE wait limit');
  return new Promise(resolve => {
    function finish() {
      clearTimeout(timer);
      response.off('close', finish);
      waiting.delete(token);
      resolve();
    }
    const timer = setTimeout(finish, 120_000);
    response.once('close', finish);
    waiting.set(token, finish);
  });
}

async function execute(request: IncomingMessage, response: ServerResponse, waiting: Waiting, token: string | null) {
  try {
    const release = token ? waitForRelease(waiting, token, response) : undefined;
    const items = await readItems(request);
    await release;
    if (response.destroyed) return;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(candidateEnvelope(items)));
  } catch {
    if (!response.destroyed) {
      response.statusCode = 400;
      response.end();
    }
  }
}

/** Same-origin HTTP fixture for the interactive Playground acceptance path. */
export function candidateHttpPreview(): Plugin {
  const waiting: Waiting = new Map();
  return {
    name: 'metriccanvas:column-candidates-http',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(candidateHttpRoot, (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (request.method !== 'POST') return next();
        const token = url.searchParams.get('hold');
        if (url.pathname === '/release') {
          if (token) waiting.get(token)?.();
          response.statusCode = 204;
          response.end();
        } else if (url.pathname === '/execute') {
          void execute(request, response, waiting, token);
        } else {
          next();
        }
      });
    }
  };
}
