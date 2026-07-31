import { describe, expect, it } from 'vitest';
import {
  resolveDataSourceFields,
  type DataSource
} from '../src';

describe('v3 页面数据源字段解析', () => {
  it('inline 直接使用显式结果字段契约', () => {
    const source: DataSource = {
      fields: {
        revenue: {
          type: 'number',
          role: 'measure',
          label: '收入',
          unit: '元',
          nullable: false,
          defaultFormat: 'number-grouped'
        }
      },
      source: {
        type: 'inline',
        rows: [{ revenue: 128600 }]
      }
    };

    expect(resolveDataSourceFields(source)).toEqual(source.fields);
  });

  it('query 解析字段契约时移除外部 queryField', () => {
    const source: DataSource = {
      fields: {
        region: {
          queryField: '地区部',
          type: 'string',
          role: 'dimension',
          nullable: false
        },
        count: {
          queryField: 'NA客户数',
          type: 'number',
          role: 'measure',
          unit: '个'
        }
      },
      source: {
        type: 'query',
        query: {
          language: 'dqe',
          body: {
            dsl_list: [
              {
                output_dims: ['地区部'],
                output_metrics: ['NA客户数']
              }
            ]
          }
        }
      }
    };

    expect(resolveDataSourceFields(source)).toEqual({
      region: {
        type: 'string',
        role: 'dimension',
        nullable: false
      },
      count: {
        type: 'number',
        role: 'measure',
        unit: '个'
      }
    });
  });
});
