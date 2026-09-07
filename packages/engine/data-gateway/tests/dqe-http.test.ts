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

    await expect(
      gateway.fetchData(query(), {
        pageId: 'na-customers',
        dataSourceIds: ['na-count-by-level']
      })
    ).resolves.toEqual({
      rows: [
        { 'customer-level': '卓越NA', 'na-customer-count': 15 },
        { 'customer-level': '战略NA', 'na-customer-count': 12 },
        { 'customer-level': '核心NA', 'na-customer-count': 9 }
      ],
      totalCount: 3
    });
    const records = diagnostics.records();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      executionId: expect.stringMatching(/^dqe-exec-/),
      batchId: expect.stringMatching(/^dqe-batch-/),
      requestId: expect.stringMatching(/^dqe-sim-/),
      pageId: 'na-customers',
      dataSourceIds: ['na-count-by-level'],
      status: 'success',
      rowCount: 3,
      totalCount: 3
    });
    expect(typeof records[0]!.durationMs).toBe('number');
    // 诊断默认不保留业务数据行:真实往返后检索不到任何行值与筛选值。
    const serialized = JSON.stringify(records);
    for (const businessValue of ['卓越NA', '战略NA', '核心NA', '中国地区部']) {
      expect(serialized).not.toContain(businessValue);
    }
  });

  it('通过 DQE Sim 归一化公式指标 alias，并保持页面字段稳定', async () => {
    const server = createDqeSimServer({ logger: false });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const gateway = createDqeGateway({
      endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`
    });

    await expect(gateway.fetchData(top100Query())).resolves.toEqual({
      rows: [
        { 'customer-level': '卓越NA', 'top100-customer-count': 12 },
        { 'customer-level': '战略NA', 'top100-customer-count': 36 },
        { 'customer-level': '核心NA', 'top100-customer-count': 39 }
      ],
      totalCount: 3
    });
  });

  it('DQE Sim 的拒答信封被映射为查询被拒绝,拒答说明(上游正文)不进入错误对象', async () => {
    const server = createDqeSimServer({ logger: false });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`,
      diagnostics
    });

    // 仿真语义面之外的指标组合会得到 DQE_SIM_UNSUPPORTED_QUERY 拒答信封。
    const rejected: EffectiveQuery = {
      language: 'dqe',
      body: {
        dsl_list: [{
          output_metrics: ['仿真面外指标'],
          output_dims: [],
          filter: { dims: [], metrics: [] },
          order: {}
        }]
      },
      fieldMappings: {
        value: { queryField: '仿真面外指标', type: 'number', role: 'measure' }
      },
      filterValues: []
    };

    const caught = await gateway.fetchData(rejected).then(
      () => {
        throw new Error('拒答信封必须拒绝');
      },
      (cause: unknown) => cause as { code: string; message: string; detail?: unknown }
    );

    expect(caught).toMatchObject({
      code: 'DQE_QUERY_REJECTED',
      detail: { resultCode: 'DQE_SIM_UNSUPPORTED_QUERY' }
    });
    expect(diagnostics.records()[0]).toMatchObject({
      status: 'error',
      errorCode: 'DQE_QUERY_REJECTED'
    });
    // 仿真 retDesc 是上游响应正文,不得进入错误对象与诊断记录。
    const serialized = JSON.stringify({
      message: caught.message,
      detail: caught.detail,
      records: diagnostics.records()
    });
    expect(serialized).not.toContain('不支持的 output_metrics/output_dims 组合');
  });

  it('维度候选值经 DQE Sim 端到端返回确定性去重候选值,面外维度不可用(issue #54)', async () => {
    const server = createDqeSimServer({ logger: false });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const gateway = createDqeGateway({
      endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`
    });

    // 语义面声明的维度取值域(闭集)确定性返回,声明顺序即输出顺序。
    await expect(gateway.fetchDimensionValues('客户级别')).resolves.toEqual({
      kind: 'values',
      candidates: ['卓越', '战略', '核心', '成长'].map((value) => ({
        value,
        label: value
      }))
    });
    await expect(gateway.fetchDimensionValues('区域')).resolves.toEqual({
      kind: 'values',
      candidates: ['华东', '华南', '华北', '西南', '华中', '东北', '西北'].map(
        (value) => ({ value, label: value })
      )
    });
    const iocDimensions = {
      'cloud-class': [{ value: '公有云', label: '公有云' }],
      'project-initiation-level': ['L1', 'L2', 'L3', 'L4'].map((value) => ({
        value,
        label: value
      })),
      'geo-pc-code': [
        { value: 'R05', label: '欧洲' },
        { value: 'TBD-APAC', label: '亚太' },
        { value: 'TBD-NAF', label: '北部非洲' },
        { value: 'TBD-MECA', label: '中东中亚' },
        { value: 'R99', label: '中国' },
        { value: 'TBD-LATAM', label: '拉美' },
        { value: 'TBD-SAF', label: '南部非洲' },
        { value: 'TBD-RU', label: '俄罗斯' }
      ],
      'region-dept-code': [
        { value: 'CN-BJ', label: '北京' },
        { value: 'CN-SH', label: '上海' },
        { value: 'CN-GD', label: '广东' }
      ],
      'rep-office-code': [
        { value: 'SH-01', label: '上海代表处' },
        { value: 'BJ-01', label: '北京代表处' },
        { value: 'GD-01', label: '广东代表处' },
        { value: 'SZ-01', label: '深圳代表处' },
        { value: 'HZ-01', label: '杭州代表处' },
        { value: 'CD-01', label: '成都代表处' },
        { value: 'SG-01', label: '新加坡代表处' },
        { value: 'TJ-01', label: '天津代表处' }
      ]
    } as const;
    for (const [dimension, candidates] of Object.entries(iocDimensions)) {
      await expect(gateway.fetchDimensionValues(dimension)).resolves.toEqual({
        kind: 'values',
        candidates
      });
    }
    // 语义面外维度得到拒答信封 → 该维度候选值能力不可用,而不是空结果。
    await expect(gateway.fetchDimensionValues('仿真面外维度')).resolves.toEqual({
      kind: 'unavailable'
    });
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

    expect(naRows.rows).toHaveLength(3);
    expect(top100Rows.rows).toHaveLength(3);
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
    language: 'dqe',
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
          role: 'measure'
        }
      },
    filterValues: []
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
    language: 'dqe',
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
          role: 'measure'
        }
      },
    filterValues: []
  };
}
