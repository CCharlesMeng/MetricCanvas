import { createReadStream, readdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { DQE_EXECUTE_PATH, executeFixtureItem } from './dqe-fixture-endpoint.mjs';

const root = resolve(import.meta.dirname, '..');
const pagesRoot = resolve(root, '../../pages');
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    );
    if (pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    if (pathname === DQE_EXECUTE_PATH) {
      await respondDqe(request, response);
      return;
    }
    if (/^\/pages\/[^/.]+$/.test(pathname)) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      createReadStream(resolve(root, 'examples/navigation.html')).pipe(response);
      return;
    }
    const servingPages = pathname.startsWith('/pages/');
    const publicRoot = servingPages ? pagesRoot : root;
    const publicPath = servingPages
      ? pathname.slice('/pages'.length)
      : pathname;
    const file = resolve(publicRoot, `.${publicPath}`);
    if (file !== publicRoot && !file.startsWith(`${publicRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-type': contentTypes.get(extname(file)) ?? 'application/octet-stream'
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4175, '127.0.0.1', () => {
  const origin = 'http://127.0.0.1:4175';
  console.log(`嵌入示例内容服务已启动：${origin}（Ctrl+C 停止）`);
  console.log(`  DQE 端点：${origin}${DQE_EXECUTE_PATH}`);
  for (const id of pageIds()) console.log(`  页面：${origin}/pages/${id}`);
});

/** 启动时列出可直接打开的页面，省得对着一个没有回显的进程猜它起没起。 */
function pageIds() {
  try {
    return readdirSync(pagesRoot)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}

async function respondDqe(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405).end('Method not allowed');
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    json(response, 400, { retCode: 'CBC.9001', retDesc: '请求体不是合法 JSON' });
    return;
  }
  if (!Array.isArray(body?.dsl_list)) {
    json(response, 400, { retCode: 'CBC.9001', retDesc: '请求体必须包含 dsl_list 数组' });
    return;
  }
  json(response, 200, {
    retCode: 'CBC.0000',
    retDesc: null,
    results: body.dsl_list.map(executeFixtureItem)
  });
}

function json(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
