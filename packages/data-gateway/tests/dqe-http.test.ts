import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { EffectiveQuery, JsonObject } from '@metriccanvas/page';
import {
  createDqeSimServer,
  DQE_EXECUTE_PATH
} from '@metriccanvas/dqe-sim';
import {
  createDqeGateway,
  createInMemoryDqeDiagnostics
} from '../src/dqe';

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

describe('DQE 数据网关真实 HTTP 集成', () => {
  it('通过 DQE Sim 请求并归一化页面字段', async () => {
    const server = createDqeSimServer({ logger: false });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`,
      diagnostics
    });

    await expect(gateway.fetchData(query())).resolves.toEqual([
      { 'customer-level': '卓越NA', 'na-customer-count': 15 },
      { 'customer-level': '战略NA', 'na-customer-count': 12 },
      { 'customer-level': '核心NA', 'na-customer-count': 9 }
    ]);
    expect(diagnostics.records().map((record) => record.phase)).toEqual([
      'base',
      'effective',
      'batch',
      'response',
      'normalized'
    ]);
    expect(
      diagnostics.records().find((record) => record.phase === 'response')?.detail
    ).toMatchObject({
      requestId: expect.stringMatching(/^dqe-sim-/),
      result: { code: 'SUCCESS' }
    });
  });

  it('通过 DQE Sim 归一化公式指标 alias，并保持页面字段稳定', async () => {
    const server = createDqeSimServer({ logger: false });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const gateway = createDqeGateway({
      endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`
    });

    await expect(gateway.fetchData(top100Query())).resolves.toEqual([
      { 'customer-level': '卓越NA', 'top100-customer-count': 12 },
      { 'customer-level': '战略NA', 'top100-customer-count': 36 },
      { 'customer-level': '核心NA', 'top100-customer-count': 39 }
    ]);
  });

  it('把同一轮 NA 与 Top100 逻辑查询合并为一个真实 HTTP 请求', async () => {
    const requests: string[] = [];
    const server = createDqeSimServer({
      logger(message) {
        requests.push(message);
      }
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const gateway = createDqeGateway({
      endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`
    });

    const [naRows, top100Rows] = await Promise.all([
      gateway.fetchData(query()),
      gateway.fetchData(top100Query())
    ]);

    expect(naRows).toHaveLength(3);
    expect(top100Rows).toHaveLength(3);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('"dsl_list": [');
    expect(requests[0]).toContain('"NA客户数"');
    expect(requests[0]).toContain('"alias": "数量"');
  });
});

function query(): EffectiveQuery {
  const item: JsonObject = {
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
        {
          dim_name: '客户级别',
          dim_value_list: ['卓越NA', '战略NA', '核心NA']
        }
      ],
      metrics: []
    },
    order: {}
  };
  return {
    metrics: ['na-customer-count'],
    dimensions: ['customer-level'],
    conditions: [],
    dqe: {
      body: { dsl_list: [item] },
      fieldMappings: {
        'customer-level': {
          queryField: '客户级别',
          type: 'string',
          role: 'dimension'
        },
        'na-customer-count': {
          queryField: 'NA客户数',
          type: 'number',
          role: 'metric'
        }
      },
      filterValues: []
    }
  };
}

function top100Query(): EffectiveQuery {
  const item: JsonObject = {
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
        {
          dim_name: '客户级别',
          dim_value_list: ['卓越NA', '战略NA', '核心NA']
        },
        { dim_name: '是否TOP100项目客户', dim_value_list: ['是'] },
        { dim_name: '是否NA', dim_value_list: ['是'] }
      ],
      metrics: []
    },
    order: {}
  };
  return {
    metrics: ['top100-customer-count'],
    dimensions: ['customer-level'],
    conditions: [],
    dqe: {
      body: { dsl_list: [item] },
      fieldMappings: {
        'customer-level': {
          queryField: '客户级别',
          type: 'string',
          role: 'dimension'
        },
        'top100-customer-count': {
          queryField: '数量',
          type: 'number',
          role: 'metric'
        }
      },
      filterValues: []
    }
  };
}
