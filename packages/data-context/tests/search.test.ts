import { describe, expect, it } from 'vitest';
import {
  createDataContextSearch,
  type DataContextSnapshot
} from '../src';

const snapshot: DataContextSnapshot = {
  formatVersion: '1.0',
  id: 'sales',
  version: 'v1',
  generatedAt: '2026-07-31T00:00:00.000Z',
  source: 'test',
  executionEnvironments: [{
    id: 'dqe',
    name: '销售 DQE',
    language: 'dqe',
    endpointRef: 'primary',
    schemas: [{
      id: 'sales',
      name: '销售',
      description: '销售域',
      objects: [{
        id: 'orders',
        name: '订单',
        kind: 'dataset',
        description: '订单汇总',
        fields: [{
          name: '成交总额',
          type: 'number',
          description: '订单成交金额',
          aliases: ['GMV'],
          roleHints: ['measure'],
          nullable: false,
          sensitive: false
        }]
      }],
      relationships: [],
      verifiedQueries: []
    }],
    constraints: {
      readOnly: true,
      maxRows: 1000,
      maxColumns: 20,
      maxQueriesPerBatch: 5,
      timeoutMs: 30000
    },
    security: { scope: 'current-user' }
  }]
};

describe('数据上下文检索', () => {
  it('按字段别名检索并携带不可变版本', async () => {
    const search = createDataContextSearch({ current: async () => snapshot });
    await expect(search.search({ query: 'GMV' })).resolves.toMatchObject({
      dataContextVersion: 'v1',
      matches: [{ kind: 'field', field: { name: '成交总额' } }]
    });
  });
});
