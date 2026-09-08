import { describe, expect, it, vi } from 'vitest';
import type { JsonObject } from '@metriccanvas/page/internal';
import {
  DQE_DEV_DETAIL_MASK,
  createDqeDevDetail,
  sanitizeDqeDevDetailItem,
  type DqeDevDetailRecord
} from '../src/lib/workbench/dev-detail';

/**
 * 开发期明细通道的实现在平台侧,不随引擎发布(ADR-0071),所以三重闸门与脱敏
 * 的用例也在这里。引擎那侧只验注入点会拿到原样生效项。
 */

/** 敏感哨兵值:任何明细序列化里检索到它即视为泄漏。 */
const SENTINEL = '哨兵客户机密9F3E';

function sentinelItem(): JsonObject {
  return {
    output_metrics: ['NA客户数', { formula: 'COUNT(*)', alias: '数量' }],
    output_dims: ['客户名称'],
    filter: {
      time: { period: 'month', is_aggregate: true, start: '2026-07', end: '2026-07' },
      dims: [{ dim_name: '客户名称', dim_value_list: [SENTINEL] }],
      metrics: []
    },
    order: {}
  };
}

describe('开发期明细通道(显式启用、脱敏、采样、环境限制)', () => {
  it('environment 不是 development 时通道不存在(失败关闭)', () => {
    const sink = vi.fn();
    for (const environment of ['production', 'test', 'staging', '']) {
      expect(createDqeDevDetail({ environment, sink })).toBeUndefined();
    }
    expect(sink).not.toHaveBeenCalled();
  });

  it('development 下记录脱敏后的生效 DQE 项:名称保留,筛选值与未知取值掩码', () => {
    const records: DqeDevDetailRecord[] = [];
    const devDetail = createDqeDevDetail({
      environment: 'development',
      sink: (record) => records.push(record)
    })!;

    devDetail.record('dqe-exec-1', sentinelItem());

    expect(records).toHaveLength(1);
    expect(records[0]!.executionId).toBe('dqe-exec-1');
    expect(records[0]!.effectiveItem).toEqual({
      output_metrics: ['NA客户数', { formula: 'COUNT(*)', alias: '数量' }],
      output_dims: ['客户名称'],
      filter: {
        time: {
          period: 'month',
          is_aggregate: true,
          start: DQE_DEV_DETAIL_MASK,
          end: DQE_DEV_DETAIL_MASK
        },
        dims: [{ dim_name: '客户名称', dim_value_list: [DQE_DEV_DETAIL_MASK] }],
        metrics: []
      },
      order: {}
    });
    expect(JSON.stringify(records)).not.toContain(SENTINEL);
  });

  it('采样:sampleRate 为 0 不记录,随机源大于采样率时跳过', () => {
    const zeroRecords: DqeDevDetailRecord[] = [];
    const zero = createDqeDevDetail({
      environment: 'development',
      sampleRate: 0,
      sink: (record) => zeroRecords.push(record)
    })!;
    zero.record('dqe-exec-1', { output_metrics: [] });
    expect(zeroRecords).toEqual([]);

    const sampledRecords: DqeDevDetailRecord[] = [];
    let next = 0.9;
    const sampled = createDqeDevDetail({
      environment: 'development',
      sampleRate: 0.5,
      random: () => next,
      sink: (record) => sampledRecords.push(record)
    })!;
    sampled.record('dqe-exec-2', { output_metrics: [] });
    expect(sampledRecords).toEqual([]);
    next = 0.2;
    sampled.record('dqe-exec-3', { output_metrics: [] });
    expect(sampledRecords).toHaveLength(1);
    expect(sampledRecords[0]!.executionId).toBe('dqe-exec-3');
  });

  it('脱敏失败关闭:未知键的取值一律替换为掩码', () => {
    expect(
      sanitizeDqeDevDetailItem({
        output_metrics: ['流水'],
        自定义扩展: SENTINEL,
        filter: {
          metrics: [{ metric_name: '流水', operator: '>', value: 100 }]
        }
      })
    ).toEqual({
      output_metrics: ['流水'],
      自定义扩展: DQE_DEV_DETAIL_MASK,
      filter: {
        metrics: [
          {
            metric_name: '流水',
            operator: '>',
            value: DQE_DEV_DETAIL_MASK
          }
        ]
      }
    });
  });
});
