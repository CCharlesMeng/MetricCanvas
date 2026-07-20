import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DialectError, parseApiQuery } from './dialect';
import { executeQuery } from './execute';
import { tables } from './tables';

/**
 * 数据服务仿真 (Data Service Sim):按《中间层分析.md》所记协议在本地供数。
 * 端点(§3.3.3):POST /rest/cbc/cbcbidynamicapiservice/v1/graphql、
 * GET /rest/cbc/cbcbidataservice/v1/services/list。
 * 现实怪癖照搬:retCode 信封、响应无总条数、鉴权头缺失返回 419/ANALYTICS_NOT_LOGIN。
 * CORS 头是仿真自身的开发便利(浏览器直连),不属被仿真协议。
 */
const PORT = Number(process.env.SIM_PORT ?? 18226);

export function createSimServer() {
  return createServer((req, res) => {
    void handle(req, res).catch((cause) => {
      envelope(res, 500, { retCode: 'CBC.9999', retDesc: `仿真内部错误:${String(cause)}` });
    });
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 预检直接放行(浏览器带自定义头时会先发 OPTIONS)
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://sim');

  // 鉴权(§1.3):无 Bearer,靠业务头。【假设,#3 核对】仿真要求 x-operator-id 与 tenantId 齐备,
  // 缺失即未登录信号:HTTP 419 + retCode ANALYTICS_NOT_LOGIN(报告对状态码/返回码的表述有歧义,两个都给)
  if (!req.headers['x-operator-id'] || !req.headers['tenantid']) {
    envelope(res, 419, { retCode: 'ANALYTICS_NOT_LOGIN', retDesc: '未登录:缺少 x-operator-id/tenantId 请求头' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/rest/cbc/cbcbidataservice/v1/services/list') {
    envelope(res, 200, {
      retCode: 'CBC.0000',
      retDesc: '成功',
      data: {
        detailData: tables.map(({ serviceCode, serviceName, description }) => ({
          serviceCode,
          serviceName,
          serviceType: 1,
          ...(description ? { description } : {})
        }))
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/rest/cbc/cbcbidynamicapiservice/v1/graphql') {
    const body = await readBody(req);
    let apiQuery: unknown;
    let isTest: unknown;
    try {
      ({ apiQuery, isTest } = JSON.parse(body) as { apiQuery?: unknown; isTest?: unknown });
    } catch {
      envelope(res, 200, { retCode: 'CBC.9001', retDesc: '请求体不是合法 JSON' });
      return;
    }
    if (typeof apiQuery !== 'string') {
      envelope(res, 200, { retCode: 'CBC.9001', retDesc: '缺少 apiQuery 字段(查询体须包装为 {"apiQuery","isTest"})' });
      return;
    }
    // 【假设,#3 核对】isTest 生产语义未知(PRD 待确认 1):仿真只要求字段存在,不改变行为
    if (typeof isTest !== 'boolean') {
      envelope(res, 200, { retCode: 'CBC.9001', retDesc: '缺少 isTest 字段(布尔)' });
      return;
    }
    try {
      const data = executeQuery(parseApiQuery(apiQuery));
      envelope(res, 200, { retCode: 'CBC.0000', retDesc: '成功', data });
    } catch (cause) {
      if (cause instanceof DialectError) {
        // 【假设,#3 核对】方言/where 解析失败的真实错误码未记录,仿真用 CBC.9002 统一表示
        envelope(res, 200, { retCode: 'CBC.9002', retDesc: `查询解析失败:${cause.message}` });
      } else {
        throw cause;
      }
    }
    return;
  }

  envelope(res, 404, { retCode: 'CBC.9404', retDesc: `未知端点:${req.method} ${url.pathname}` });
}

function envelope(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  cors(res);
  res.writeHead(status, { 'content-type': 'application/json;charset=utf-8' });
  res.end(JSON.stringify(body));
}

function cors(res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type,x-operator-id,tenantid,appid,cftk,x-language,x-requested-with');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// 直接运行时启动(vitest import 时不启动)
if (process.argv[1]?.endsWith('server.ts')) {
  createSimServer().listen(PORT, () => {
    console.log(`数据服务仿真已启动:http://localhost:${PORT}(${tables.length} 张种子表;Ctrl+C 停止)`);
  });
}
