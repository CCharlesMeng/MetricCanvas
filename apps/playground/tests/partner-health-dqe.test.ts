import {readFileSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {parsePage, type PageDocument} from '@metriccanvas/page';
import {isQueryDataSource} from '@metriccanvas/page/internal';
import {createPageDataExecutor} from '../../../packages/data-execution/src/execute';
import {installLocalDevRuntimeConfig, installRuntimeConfig} from '../src/lib/runtime-config';
import {scenarioEnvironment} from '../src/lib/scenario-environment';
import {pageExternalInputs} from '../fixtures/preview-inputs';

const {transport} = vi.hoisted(() => ({transport: vi.fn<typeof fetch>()}));
vi.mock('../src/lib/services', async () => {
  const {createPlaygroundDqeGateway} = await import('../src/lib/runtime-config');
  return {dataGateway: createPlaygroundDqeGateway(transport)};
});

const document: PageDocument = JSON.parse(readFileSync('pages/temporary/partner-health.json', 'utf8'));
const parsed = parsePage(document);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const endpoint = '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
const queryCases = Object.entries(parsed.page.dataSources).flatMap(([id, definition]) => {
  if (!isQueryDataSource(definition)) return [];
  const query = definition.source.query;
  const branches = query.body ? {default: {body: query.body}} : query.queryModes!.cases;
  return Object.entries(branches).map(([mode, branch]) => ({id: `${id}/${mode}`, body: branch.body, fields: definition.fields}));
});

beforeEach(() => {
  installLocalDevRuntimeConfig();
  transport.mockReset();
  transport.mockResolvedValue(Response.json({retCode: 'CBC.0000', results: [{code: 'SUCCESS', data: [], total_count: 0}]}));
});
afterEach(() => installRuntimeConfig(null));

describe('伙伴健康度使用共享DQE传输', () => {
  it.each(queryCases)('$id发送页面声明的execute请求，空结果不回填演示行', async ({body, fields}) => {
    const {dataGateway} = scenarioEnvironment('partner-health');
    const result = await dataGateway.fetchData({
      language: 'dqe', body, fieldMappings: fields, filterValues: []
    });
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0]!;
    expect(url).toBe(endpoint);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(body);
    expect(result.rows).toEqual([]);
  });

  it('伙伴健康度不再注册模拟输入，传输失败向页面报告', async () => {
    expect(pageExternalInputs('partner-health')).toBeUndefined();
    transport.mockRejectedValue(new Error('DQE unavailable'));
    const definition = queryCases[0]!;
    await expect(scenarioEnvironment('partner-health').dataGateway.fetchData({
      language: 'dqe', body: definition.body,
      fieldMappings: definition.fields, filterValues: []
    })).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('完整页面默认条件通过批量execute，保持空结果且不修改输入', async () => {
    expect(queryCases).toHaveLength(28);
    const before = structuredClone(document);
    transport.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({retCode: 'CBC.0000', results: body.dsl_list.map(() => ({code: 'SUCCESS', data: [], total_count: 0}))});
    });
    const output = await createPageDataExecutor({gateway: scenarioEnvironment('partner-health').dataGateway}).execute(document);
    expect(transport.mock.calls.length).toBeGreaterThan(0);
    expect(transport.mock.calls.every(([url]) => url === endpoint)).toBe(true);
    expect(document).toEqual(before);
    expect(output.dataSources['voice-closure-score-region'].source).toMatchObject({initial: {rows: [], totalCount: 0}});
    expect(output.dataSources['customer-eval-score-region'].source).toMatchObject({initial: {rows: [], totalCount: 0}});
  });
});
