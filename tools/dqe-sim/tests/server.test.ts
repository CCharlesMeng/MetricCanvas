import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDqeSimServer,
  DQE_EXECUTE_PATH
} from '../src/server';

const servers: ReturnType<typeof createDqeSimServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).filter((server) => server.listening).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe('DQE Sim HTTP 契约', () => {
  it('提供健康检查、CORS 预检和目标执行接口', async () => {
    const baseUrl = await listen();
    const health = await fetch(`${baseUrl}/__health`);
    expect(await health.json()).toEqual({ status: 'ok', service: 'dqe-sim' });

    const preflight = await fetch(`${baseUrl}${DQE_EXECUTE_PATH}`, {
      method: 'OPTIONS'
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');

    const response = await execute(baseUrl, dqeItem());
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(/^dqe-sim-/);
    expect(await response.json()).toMatchObject({
      retCode: 'CBC.0000',
      retDesc: null,
      results: [
        {
          code: 'SUCCESS',
          data: [
            { 客户级别: '卓越NA', NA客户数: 15 },
            { 客户级别: '战略NA', NA客户数: 12 },
            { 客户级别: '核心NA', NA客户数: 9 }
          ],
          dqe: { orders: [], limit: -1, offset: -1, sql: null }
        }
      ]
    });
  });

  it('按请求顺序返回子集，并隔离批量请求中的不支持项', async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}${DQE_EXECUTE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dsl_list: [
          dqeItem(['核心NA', '卓越NA']),
          dqeItem(['未知级别'])
        ]
      })
    });
    expect(await response.json()).toMatchObject({
      retCode: 'CBC.0000',
      results: [
        {
          code: 'SUCCESS',
          data: [
            { 客户级别: '核心NA', NA客户数: 9 },
            { 客户级别: '卓越NA', NA客户数: 15 }
          ]
        },
        {
          code: 'DQE_SIM_UNSUPPORTED_QUERY',
          data: [],
          retDesc: '不支持的客户级别:未知级别'
        }
      ]
    });
  });

  it('严格匹配 Top100 概况 DSL，并按页面需要返回三个客户级别', async () => {
    const baseUrl = await listen();
    const response = await execute(baseUrl, top100DqeItem());

    expect(await response.json()).toMatchObject({
      retCode: 'CBC.0000',
      results: [
        {
          code: 'SUCCESS',
          data: [
            { 客户级别: '卓越NA', 数量: 12 },
            { 客户级别: '战略NA', 数量: 36 },
            { 客户级别: '核心NA', 数量: 39 }
          ],
          dqe: {
            columns: [
              { caption: '客户级别', type: 'dimension' },
              { caption: '数量', type: 'metric' }
            ]
          }
        }
      ]
    });
  });

  it('在同一个 dsl_list 中保持 NA 与 Top100 查询项和结果项对位', async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}${DQE_EXECUTE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dsl_list: [dqeItem(), top100DqeItem()] })
    });

    expect(await response.json()).toMatchObject({
      retCode: 'CBC.0000',
      results: [
        {
          code: 'SUCCESS',
          data: [
            { 客户级别: '卓越NA', NA客户数: 15 },
            { 客户级别: '战略NA', NA客户数: 12 },
            { 客户级别: '核心NA', NA客户数: 9 }
          ]
        },
        {
          code: 'SUCCESS',
          data: [
            { 客户级别: '卓越NA', 数量: 12 },
            { 客户级别: '战略NA', 数量: 36 },
            { 客户级别: '核心NA', 数量: 39 }
          ]
        }
      ]
    });
  });

  it('拒绝非法 JSON、缺少 dsl_list 和未知路径', async () => {
    const baseUrl = await listen();
    const invalidJson = await fetch(`${baseUrl}${DQE_EXECUTE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{'
    });
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toMatchObject({ retCode: 'CBC.9001' });

    const missingList = await fetch(`${baseUrl}${DQE_EXECUTE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    expect(missingList.status).toBe(400);
    expect(await missingList.json()).toMatchObject({ retCode: 'CBC.9001' });

    const missing = await fetch(`${baseUrl}/missing`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ retCode: 'CBC.9404' });
  });
});

async function listen(): Promise<string> {
  const server = createDqeSimServer({ logger: false });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function execute(baseUrl: string, item: unknown): Promise<Response> {
  return fetch(`${baseUrl}${DQE_EXECUTE_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dsl_list: [item] })
  });
}

function dqeItem(levels = ['卓越NA', '战略NA', '核心NA']) {
  return {
    output_metrics: ['NA客户数'],
    output_dims: ['客户级别'],
    filter: {
      time: {
        period: 'month',
        is_aggregate: true,
        start: '2026-07',
        end: '2026-07'
      },
      dims: [
        { dim_name: '地区部', dim_value_list: ['中国地区部'] },
        { dim_name: '客户级别', dim_value_list: levels }
      ],
      metrics: []
    },
    order: {}
  };
}

function top100DqeItem(levels = ['卓越NA', '战略NA', '核心NA']) {
  return {
    output_metrics: [{ formula: 'COUNT(*)', alias: '数量' }],
    output_dims: ['客户级别'],
    filter: {
      time: {
        period: 'month',
        is_aggregate: true,
        start: '2026-07',
        end: '2026-07'
      },
      dims: [
        { dim_name: '地区部', dim_value_list: ['中国地区部'] },
        { dim_name: '客户级别', dim_value_list: levels },
        { dim_name: '是否TOP100项目客户', dim_value_list: ['是'] },
        { dim_name: '是否NA', dim_value_list: ['是'] }
      ],
      metrics: []
    },
    order: {}
  };
}
