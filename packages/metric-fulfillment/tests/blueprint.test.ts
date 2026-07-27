import { describe, expect, it } from 'vitest';
import {
  createMemoryMetricFulfillment,
  type SaveBlueprintCommand
} from '@metriccanvas/metric-fulfillment';

describe('页面搭建蓝图', () => {
  it('用户明确提出的指标默认必需，AI 建议的辅助指标默认可选', async () => {
    const fulfillment = createMemoryMetricFulfillment({
      ids: sequenceIds(
        'blueprint-defaults',
        'group-defaults',
        'request-user',
        'request-ai',
        'audit-defaults'
      )
    });
    const result = await fulfillment.saveBlueprint(
      {
        blueprintId: null,
        pageId: null,
        baseRevisionId: null,
        goal: '观察成交表现',
        modules: [],
        metricRequests: [
          {
            requestKey: 'gmv',
            name: '成交总额',
            definition: '成交订单总金额',
            requiredDimensions: [],
            requiredAggregations: ['sum'],
            suggestedBy: 'user',
            contextSummary: '用户明确提出'
          },
          {
            requestKey: 'conversion-rate',
            name: '转化率',
            definition: '访问到成交的转化率',
            requiredDimensions: [],
            requiredAggregations: ['avg'],
            suggestedBy: 'ai',
            contextSummary: 'AI 辅助建议'
          }
        ],
        idempotencyKey: 'save-defaults'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );

    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        requests: [
          { requestKey: 'gmv', necessity: 'required' },
          { requestKey: 'conversion-rate', necessity: 'optional' }
        ]
      }
    });
  });

  it('保存页面目标、模块结构和待确认的原子指标需求,不保存完整对话或业务数据行', async () => {
    const fulfillment = createMemoryMetricFulfillment({
      ids: sequenceIds('blueprint-1', 'group-1', 'request-1', 'audit-1'),
      clock: fixedClock('2026-07-23T02:00:00.000Z')
    });

    const result = await fulfillment.saveBlueprint(
      {
        blueprintId: null,
        pageId: 'tokens-operations',
        baseRevisionId: 'revision-4',
        goal: '按办公区和模型观察 Tokens 消耗趋势',
        modules: [
          {
            moduleId: 'overview',
            title: 'Tokens 消耗概览',
            metricRequestKeys: ['tokens-consumption']
          }
        ],
        metricRequests: [
          {
            requestKey: 'tokens-consumption',
            name: 'Tokens 消耗量',
            definition: '统计模型推理产生的输入与输出 Tokens 总量。',
            requiredDimensions: ['office', 'model'],
            requiredAggregations: ['sum', 'day', 'month'],
            necessity: 'required',
            suggestedBy: 'user',
            contextSummary: '用于办公区与模型消耗趋势分析'
          }
        ],
        idempotencyKey: 'save-blueprint-1',
        conversation: '完整对话绝不能落库',
        businessRows: [{ office: '上海', tokens: 123456 }]
      } as SaveBlueprintCommand,
      { actorId: 'user-meng', clientId: 'workbench' }
    );

    expect(result).toEqual({
      ok: true,
      snapshot: {
        blueprint: {
          blueprintId: 'blueprint-1',
          pageId: 'tokens-operations',
          baseRevisionId: 'revision-4',
          goal: '按办公区和模型观察 Tokens 消耗趋势',
          modules: [
            {
              moduleId: 'overview',
              title: 'Tokens 消耗概览',
              metricRequestKeys: ['tokens-consumption']
            }
          ],
          ownerId: 'user-meng',
          createdAt: '2026-07-23T02:00:00.000Z',
          updatedAt: '2026-07-23T02:00:00.000Z'
        },
        group: {
          groupId: 'group-1',
          blueprintId: 'blueprint-1',
          readiness: 'blocked',
          createdAt: '2026-07-23T02:00:00.000Z',
          updatedAt: '2026-07-23T02:00:00.000Z'
        },
        requests: [
          expect.objectContaining({
            requestId: 'request-1',
            requestKey: 'tokens-consumption',
            status: 'awaiting_candidate_confirmation',
            necessity: 'required',
            suggestedBy: 'user',
            revisionNumber: 1
          })
        ],
        businessConfirmations: [],
        dataDevelopmentReviews: [],
        requestRevisions: [
          expect.objectContaining({
            requestId: 'request-1',
            revisionNumber: 1,
            changedBy: 'user-meng'
          })
        ],
        notifications: [],
        audits: [
          expect.objectContaining({
            auditId: 'audit-1',
            action: 'blueprint_saved',
            actorId: 'user-meng'
          })
        ]
      }
    });
    expect(JSON.stringify(result)).not.toContain('完整对话绝不能落库');
    expect(JSON.stringify(result)).not.toContain('123456');
  });

  it('只有用户明确确认后才幂等登记指标缺口并等待数据开发确认', async () => {
    const fulfillment = createMemoryMetricFulfillment({
      ids: sequenceIds(
        'blueprint-1',
        'group-1',
        'request-1',
        'audit-1',
        'confirmation-1',
        'audit-2'
      ),
      clock: fixedClock('2026-07-23T02:00:00.000Z')
    });
    const saved = await fulfillment.saveBlueprint(
      blueprintCommand(),
      { actorId: 'user-meng', clientId: 'workbench' }
    );
    if (!saved.ok) throw new Error(saved.error.message);

    await expect(
      fulfillment.recordMetricGap(
        {
          blueprintId: 'blueprint-1',
          requestId: 'request-1',
          reviewerId: 'reviewer-chen',
          userConfirmed: false,
          idempotencyKey: 'record-gap-1'
        },
        { actorId: 'user-meng', clientId: 'workbench' }
      )
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'USER_CONFIRMATION_REQUIRED',
        message: '登记指标缺口需要用户明确确认'
      }
    });
    const unchanged = await fulfillment.getBlueprint('blueprint-1');
    expect(unchanged.ok && unchanged.snapshot.requests[0]?.status).toBe(
      'awaiting_candidate_confirmation'
    );

    const command = {
      blueprintId: 'blueprint-1',
      requestId: 'request-1',
      reviewerId: 'reviewer-chen',
      userConfirmed: true,
      idempotencyKey: 'record-gap-2'
    };
    const first = await fulfillment.recordMetricGap(command, {
      actorId: 'user-meng',
      clientId: 'workbench'
    });
    const replay = await fulfillment.recordMetricGap(command, {
      actorId: 'user-meng',
      clientId: 'workbench'
    });

    expect(replay).toEqual(first);
    expect(first).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        requests: [
          expect.objectContaining({
            requestId: 'request-1',
            status: 'awaiting_data_development_confirmation',
            reviewerId: 'reviewer-chen'
          })
        ],
        businessConfirmations: [
          expect.objectContaining({
            confirmationId: 'confirmation-1',
            requestId: 'request-1',
            decision: 'create_new_metric',
            actorId: 'user-meng'
          })
        ],
        audits: expect.arrayContaining([
          expect.objectContaining({
            auditId: 'audit-2',
            action: 'metric_gap_recorded'
          })
        ])
      })
    });
  });

  it('只有被指定且具备 metric_reviewer 能力的数据开发确认人可以接受新指标', async () => {
    const fulfillment = createMemoryMetricFulfillment({
      ids: sequenceIds(
        'blueprint-1',
        'group-1',
        'request-1',
        'audit-1',
        'confirmation-1',
        'audit-2',
        'review-1',
        'audit-3'
      ),
      clock: fixedClock('2026-07-23T02:00:00.000Z')
    });
    await fulfillment.saveBlueprint(blueprintCommand(), {
      actorId: 'user-meng',
      clientId: 'workbench'
    });
    await fulfillment.recordMetricGap(
      {
        blueprintId: 'blueprint-1',
        requestId: 'request-1',
        reviewerId: 'reviewer-chen',
        userConfirmed: true,
        idempotencyKey: 'record-gap-1'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );
    const command = {
      blueprintId: 'blueprint-1',
      requestId: 'request-1',
      decision: 'accept' as const,
      idempotencyKey: 'review-1'
    };

    await expect(
      fulfillment.reviewMetricRequest(command, {
        actorId: 'reviewer-chen',
        clientId: 'workbench'
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'METRIC_REVIEW_FORBIDDEN',
        message: '数据开发确认需要 metric_reviewer 能力'
      }
    });
    await expect(
      fulfillment.reviewMetricRequest(command, {
        actorId: 'another-reviewer',
        clientId: 'workbench',
        capabilities: ['metric_reviewer']
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'METRIC_REVIEW_FORBIDDEN',
        message: '只有指定的数据开发确认人 reviewer-chen 可以处理该原子指标需求'
      }
    });

    const accepted = await fulfillment.reviewMetricRequest(command, {
      actorId: 'reviewer-chen',
      clientId: 'workbench',
      capabilities: ['metric_reviewer']
    });
    expect(accepted).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        requests: [
          expect.objectContaining({
            requestId: 'request-1',
            status: 'awaiting_dp_metric_link'
          })
        ],
        dataDevelopmentReviews: [
          expect.objectContaining({
            reviewId: 'review-1',
            requestId: 'request-1',
            reviewerId: 'reviewer-chen',
            decision: 'accepted'
          })
        ],
        audits: expect.arrayContaining([
          expect.objectContaining({
            auditId: 'audit-3',
            action: 'data_development_accepted'
          })
        ])
      })
    });
  });

  it('数据开发结构化退回后修订同一原子指标需求,保留历史且不创建重复需求', async () => {
    const fulfillment = createMemoryMetricFulfillment({
      ids: sequenceIds(
        'blueprint-1',
        'group-1',
        'request-1',
        'audit-1',
        'confirmation-1',
        'audit-2',
        'review-1',
        'audit-3',
        'audit-4'
      ),
      clock: fixedClock('2026-07-23T02:00:00.000Z')
    });
    await fulfillment.saveBlueprint(blueprintCommand(), {
      actorId: 'user-meng',
      clientId: 'workbench'
    });
    await fulfillment.recordMetricGap(
      {
        blueprintId: 'blueprint-1',
        requestId: 'request-1',
        reviewerId: 'reviewer-chen',
        userConfirmed: true,
        idempotencyKey: 'record-gap-1'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );
    const returned = await fulfillment.reviewMetricRequest(
      {
        blueprintId: 'blueprint-1',
        requestId: 'request-1',
        decision: 'return',
        returnCategory: 'definition_unclear',
        note: '请明确是否包含缓存命中的 Tokens',
        idempotencyKey: 'review-return-1'
      },
      {
        actorId: 'reviewer-chen',
        clientId: 'workbench',
        capabilities: ['metric_reviewer']
      }
    );
    expect(returned.ok && returned.snapshot.requests[0]?.status).toBe('rejected');

    const revised = await fulfillment.reviseMetricRequest(
      {
        blueprintId: 'blueprint-1',
        requestId: 'request-1',
        definition: '统计模型实际计费的输入与输出 Tokens 总量，不含缓存命中量。',
        requiredDimensions: ['office', 'model'],
        requiredAggregations: ['sum', 'day', 'month'],
        contextSummary: '已按退回意见明确缓存边界',
        idempotencyKey: 'revise-request-1'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );

    expect(revised).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        requests: [
          expect.objectContaining({
            requestId: 'request-1',
            requestKey: 'tokens-consumption',
            revisionNumber: 2,
            status: 'awaiting_data_development_confirmation',
            definition: '统计模型实际计费的输入与输出 Tokens 总量，不含缓存命中量。'
          })
        ],
        requestRevisions: [
          expect.objectContaining({
            requestId: 'request-1',
            revisionNumber: 1,
            definition: '统计模型推理产生的输入与输出 Tokens 总量。'
          }),
          expect.objectContaining({
            requestId: 'request-1',
            revisionNumber: 2,
            definition: '统计模型实际计费的输入与输出 Tokens 总量，不含缓存命中量。'
          })
        ]
      })
    });
  });
});

function blueprintCommand() {
  return {
    blueprintId: null,
    pageId: 'tokens-operations',
    baseRevisionId: 'revision-4',
    goal: '按办公区和模型观察 Tokens 消耗趋势',
    modules: [
      {
        moduleId: 'overview',
        title: 'Tokens 消耗概览',
        metricRequestKeys: ['tokens-consumption']
      }
    ],
    metricRequests: [
      {
        requestKey: 'tokens-consumption',
        name: 'Tokens 消耗量',
        definition: '统计模型推理产生的输入与输出 Tokens 总量。',
        requiredDimensions: ['office', 'model'],
        requiredAggregations: ['sum', 'day', 'month'],
        necessity: 'required' as const,
        suggestedBy: 'user' as const,
        contextSummary: '用于办公区与模型消耗趋势分析'
      }
    ],
    idempotencyKey: 'save-blueprint-1'
  };
}

function sequenceIds(...values: string[]) {
  let index = 0;
  return { next: () => values[index++]! };
}

function fixedClock(iso: string) {
  return { now: () => new Date(iso) };
}
