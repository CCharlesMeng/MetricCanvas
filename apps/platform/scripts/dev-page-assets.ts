import {createServer, type IncomingMessage} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate, type PageDocument} from '@metriccanvas/page';
import {pageFilesById} from '../../../tools/scripts/page-files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const collection = '/rest/cdi/cdinl2databuilderservice/v1/user-page-metadata';
const seeds = ['demo', 'sales-detail', 'tokens-report', 'flow-analysis-report', 'report-date-filter-example'];
interface RecordValue {
  page_metadata_id: string;
  page_id: string;
  revision_id: string;
  revision_number: number;
  is_draft: boolean;
  description: string;
  created_at: string;
  updated_at: string;
  page_metadata_definition: PageDocument;
}
interface Store {format: 1; records: RecordValue[]}
const file = resolve(root, '.scratch/platform-page-assets/store.json');
let store: Store;
try {
  store = JSON.parse(await readFile(file, 'utf8'));
  if (store.format !== 1 || !Array.isArray(store.records)) throw Error('Unsupported local page asset store');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  const now = new Date().toISOString();
  const records: RecordValue[] = [];
  const pages = pageFilesById(resolve(root, 'pages'));
  for (const [index, name] of seeds.entries()) {
    const pageFile = pages.get(name);
    if (!pageFile) throw Error(`Missing seed page: ${name}`);
    const document: PageDocument = JSON.parse(await readFile(pageFile, 'utf8'));
    if (validate(document).length) throw Error(`Invalid seed page: ${name}`);
    records.push({page_metadata_id: 'local-' + name, page_id: String(document.id),
      revision_id: randomUUID(), revision_number: 1, is_draft: index !== 2 && index !== 3,
      description: document.meta?.description ?? name, created_at: now, updated_at: now,
      page_metadata_definition: document});
  }
  store = {format: 1, records};
  await persist(store);
}
async function persist(value: Store) {
  await mkdir(dirname(file), {recursive: true});
  const temporary = file + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, file);
}
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 8 * 1024 * 1024) throw Error('Request too large');
    chunks.push(chunk);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid JSON body');
  return value as Record<string, unknown>;
}
function summary(record: RecordValue) {
  const {page_metadata_definition: _, ...value} = record;
  const metrics=new Set<string>(),dimensions=new Set<string>();
  for(const source of Object.values(record.page_metadata_definition.dataSources)){
    for(const [id,field] of Object.entries(source.fields??{})){
      const name=typeof field.label==='string'?field.label:id;
      if(field.role==='measure')metrics.add(name);
      else if(field.role==='dimension')dimensions.add(name);
    }
  }
  return {...value,supported_fields:JSON.stringify({metrics:[...metrics],dimensions:[...dimensions]})};
}
let writes: Promise<void> = Promise.resolve();
const server = createServer((request, response) => {
  const origin = request.headers.origin;
  if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost):(5174|4174)$/.test(origin)) {
    response.writeHead(403); response.end(); return;
  }
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, X-Operator-Id, cftk');
  if (request.headers['access-control-request-private-network'] === 'true') response.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (request.method === 'OPTIONS') {response.writeHead(204); response.end(); return;}
  const send = (status: number, value: unknown) => {
    response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
    response.end(JSON.stringify(value));
  };
  const fail = (status: number, code: string, message: string) => send(status, {retCode: code, code, message});
  const handle = async () => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:8080');
    if (url.pathname === '/__health') return send(200, {status: 'ok', service: 'local-page-assets', pages: store.records.length});
    if (request.headers['x-auth-token'] !== 'local-dev' || request.headers['x-operator-id'] !== 'developer-1') return fail(401, 'UNAUTHENTICATED', '仅接受默认本地开发身份。');
    if (url.pathname === collection && request.method === 'GET') {
      const filter = url.searchParams.get('isDraft');
      const records = store.records.filter(record => filter === null || record.is_draft === (filter === 'true'));
      const page = Math.max(1, Number(url.searchParams.get('pageNo')) || 1);
      const size = Math.max(1, Math.min(1000, Number(url.searchParams.get('pageSize')) || 20));
      return send(200, {retCode: 'CBC.0000', total: records.length,
        page_metadata_list: records.slice((page - 1) * size, page * size).map(record => url.searchParams.get('needDefinition') === 'true' ? record : summary(record))});
    }
    const parts = url.pathname.startsWith(collection + '/') ? url.pathname.slice(collection.length + 1).split('/') : [];
    const index = store.records.findIndex(record => record.page_metadata_id === decodeURIComponent(parts[0] ?? ''));
    const record = store.records[index];
    if (parts.length && !record) return fail(404, 'PAGE_NOT_FOUND', '本地页面不存在。');
    if (record && parts.length === 2 && parts[1] === 'history' && request.method === 'GET') return send(200, {retCode: 'CBC.0000', history_list: []});
    if (record && parts.length === 1 && request.method === 'GET') return send(200, {retCode: 'CBC.0000', ...record});
    if (record && parts.length === 1 && request.method === 'DELETE') {
      const next = structuredClone(store); next.records.splice(index, 1); await persist(next); store = next;
      response.writeHead(204); response.end(); return;
    }
    const creating = url.pathname === collection && request.method === 'POST';
    if (creating || record && parts.length === 1 && request.method === 'PUT') {
      const input = await body(request);
      const document = input.page_metadata_definition as PageDocument;
      if (!document || validate(document).length || typeof input.is_draft !== 'boolean') return fail(400, 'INVALID_INPUT', '页面文档或状态无效。');
      if (document.id !== (creating ? input.page_id : record.page_id)) return fail(400, 'INVALID_INPUT', '页面标识不匹配。');
      if (creating && store.records.some(value => value.page_id === input.page_id)) return fail(409, 'REVISION_CONFLICT', '本地页面已存在。');
      if (!creating && input.base_revision_id !== record.revision_id) return fail(409, 'REVISION_CONFLICT', '页面已更新，请重新打开。');
      const now = new Date().toISOString();
      const saved: RecordValue = {page_metadata_id: creating ? 'local-' + randomUUID() : record.page_metadata_id,
        page_id: String(document.id), revision_id: randomUUID(), revision_number: creating ? 1 : record.revision_number + 1,
        is_draft: input.is_draft, description: document.meta?.description ?? '', created_at: creating ? now : record.created_at,
        updated_at: now, page_metadata_definition: document};
      const next = structuredClone(store);
      if (creating) next.records.push(saved); else next.records[index] = saved;
      await persist(next); store = next; return send(200, {retCode: 'CBC.0000', ...saved});
    }
    return fail(404, 'UNSUPPORTED', '本地预置服务只支持目录、当前页面和明确保存/删除；未实现历史恢复。');
  };
  // Serialize mutations with reads so a stale base cannot race a successful write.
  writes = writes.then(handle).catch(error => {fail(500, 'LOCAL_STORE_ERROR', error instanceof Error ? error.message : String(error));});
});
server.listen(8080, '127.0.0.1', () => {
  console.log(`本机页面资产已就绪：${store.records.length} 个页面，http://127.0.0.1:8080${collection}`);
  console.log(`修改保存在 ${file}；pages 原文件不改写。仅开发数据，不是 Java 服务验收。`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close());
