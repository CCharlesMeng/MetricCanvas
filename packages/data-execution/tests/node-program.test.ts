import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { executePageDataProgram } from '../src/node';
import { queryRowsFromPageRows } from '../src/query-rows';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.close(() => resolve()); server.closeAllConnections();
  })));
});

describe('Node metadata program', () => {
  it('calls HTTP DQE twice in order, passes trusted headers, and emits only complete metadata', async () => {
    const calls: Array<{ headers: string | undefined; item: any }> = [];
    const server = createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      const item = JSON.parse(body).dsl_list[0];
      calls.push({ headers: req.headers.authorization, item });
      const data = calls.length === 1
        ? [{ '客户名称': '客户', '项目名称': '项目', '商务编号': 'A', 'SDT成员决策时长': 2 }]
        : [{ '商务编号': 'A', '阶段名称': '代表处SDT', 'SDT成员决策时长': 0, 'SDT成员决策次数': 3 }];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data, total_count: 1 }] }));
    });
    servers.push(server); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('server address');
    const page = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/query-cascade-page.json', 'utf8'));
    const child = spawn(process.execPath, ['--import', 'tsx', 'packages/data-execution/src/program.ts'], {
      env: { ...process.env, METRICCANVAS_DQE_ENDPOINT: `http://127.0.0.1:${address.port}/dqe`, METRICCANVAS_DQE_HEADERS: JSON.stringify({ authorization: 'fixture-identity' }) }
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
    child.stdin.end(JSON.stringify(page));
    const [code] = await once(child, 'exit');
    expect(code).toBe(0); expect(stderr).toBe('');
    const result = JSON.parse(stdout);
    expect(parsePage(result).ok).toBe(true);
    expect(Object.keys(result).sort()).toEqual(Object.keys(page).sort());
    expect(calls).toHaveLength(2);
    expect(calls.every(call => call.headers === 'fixture-identity')).toBe(true);
    expect(calls[1].item.filter.dims).toEqual([{ dim_name: '商务编号', dim_value_list: ['A'] }]);
    expect(result.dataSources['project-efficiency-bottom5'].source.initial.rows[0]['商务编号']).toBe('A');
  });

  it('rejects an absent Node endpoint before any query', async () => {
    const page = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/query-cascade-page.json', 'utf8'));
    await expect(executePageDataProgram(page, {})).rejects.toThrow('绝对DQE地址');
  });

  it('round-trips grouped and nested query field mappings while excluding computed fields', () => {
    const rows = queryRowsFromPageRows([{ key: 'A', records: [{ amount: 0 }], derived: 7 }], {
      key: { type: 'string', role: 'dimension', nullable: false, queryField: '外部键' },
      records: { type: 'recordList', role: 'detail', nullable: false, queryField: '外部明细', items: { fields: {
        amount: { type: 'number', role: 'measure', nullable: false, queryField: '外部金额' }
      } } },
      derived: { type: 'number', role: 'measure', nullable: false }
    });
    expect(rows).toEqual([{ '外部键': 'A', '外部明细': [{ '外部金额': 0 }] }]);
  });
});
