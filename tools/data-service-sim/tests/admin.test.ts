import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createSimServer } from '../src/server';

const servers: ReturnType<typeof createSimServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
    )
  );
});

describe('数据服务仿真测试控制点', () => {
  it('测试人员登记指标后，正式目录协议能够发现 code 和维度', async () => {
    const server = createSimServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const registered = await fetch(`${baseUrl}/__admin/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'token-consumption-admin-test',
        name: 'Tokens 消耗量',
        dimensions: ['office', 'model']
      })
    });
    expect(registered.status).toBe(201);

    const headers = {
      'content-type': 'application/json',
      'x-operator-id': 'tester',
      tenantId: 'dev'
    };
    const metricsResponse = await fetch(
      `${baseUrl}/rest/cbc/cbcbidynamicapiservice/v1/graphql`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          apiQuery:
            '{restQuery{MetricBaseInfo(request:{metric_type:"element", limit:-1, offset:0}){metric_code metric_name_zh scope}}}',
          isTest: true
        })
      }
    );
    const metrics = (await metricsResponse.json()) as {
      data: {
        restQuery: {
          MetricBaseInfo: Array<{ metric_code: string }>;
        };
      };
    };
    const fieldsResponse = await fetch(
      `${baseUrl}/rest/cbc/cbcbidynamicapiservice/v1/graphql`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          apiQuery:
            '{P001_ADS_T_IOC_SPD_METRIC_ACC_D:__type(name:"P001_ADS_T_IOC_SPD_METRIC_ACC_D"){fields{name}}}',
          isTest: true
        })
      }
    );
    const fields = (await fieldsResponse.json()) as {
      data: {
        P001_ADS_T_IOC_SPD_METRIC_ACC_D: {
          fields: Array<{ name: string }>;
        };
      };
    };
    expect(
      metrics.data.restQuery.MetricBaseInfo.map((metric) => metric.metric_code)
    ).toContain('token-consumption-admin-test');
    expect(
      fields.data.P001_ADS_T_IOC_SPD_METRIC_ACC_D.fields.map(
        (field) => field.name
      )
    ).toEqual(expect.arrayContaining(['office', 'model']));
  });
});
