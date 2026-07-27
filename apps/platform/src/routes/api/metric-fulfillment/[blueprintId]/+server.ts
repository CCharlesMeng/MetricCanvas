import { json } from '@sveltejs/kit';
import type {
  ConfirmDpMetricReuseCommand,
  LinkDpMetricCommand,
  MetricFulfillmentContext,
  MetricFulfillmentResult,
  RecordMetricGapCommand,
  ReviewMetricRequestCommand,
  ReviseMetricRequestCommand
} from '@metriccanvas/metric-fulfillment';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const { metricFulfillment } = await getPlatformServices();
  const result =
    url.searchParams.get('refresh') === '1'
      ? await metricFulfillment.refresh(
          { blueprintId: params.blueprintId },
          fulfillmentContext('system-sync')
        )
      : await metricFulfillment.getBlueprint(params.blueprintId);
  return metricResponse(result);
};

export const POST: RequestHandler = async ({ params, request }) => {
  const body = await requestJson(request);
  if (!isRecord(body) || typeof body.action !== 'string') {
    return invalidRequest('指标履约动作不合法');
  }

  const services = await getPlatformServices();
  const blueprintId = params.blueprintId;
  switch (body.action) {
    case 'reuse_dp_metric':
      if (
        typeof body.requestId !== 'string' ||
        typeof body.dpMetricId !== 'string' ||
        typeof body.idempotencyKey !== 'string'
      ) {
        return invalidRequest('确认复用 DP 指标参数不合法');
      }
      return metricResponse(
        await services.metricFulfillment.confirmDpMetricReuse(
          {
            blueprintId,
            requestId: body.requestId,
            dpMetricId: body.dpMetricId,
            userConfirmed: true,
            idempotencyKey: body.idempotencyKey
          } satisfies ConfirmDpMetricReuseCommand,
          fulfillmentContext('developer-1')
        )
      );
    case 'record_gap':
      if (
        typeof body.requestId !== 'string' ||
        typeof body.reviewerId !== 'string' ||
        typeof body.idempotencyKey !== 'string'
      ) {
        return invalidRequest('登记指标缺口参数不合法');
      }
      return metricResponse(
        await services.metricFulfillment.recordMetricGap(
          {
            blueprintId,
            requestId: body.requestId,
            reviewerId: body.reviewerId,
            userConfirmed: true,
            idempotencyKey: body.idempotencyKey
          } satisfies RecordMetricGapCommand,
          fulfillmentContext('developer-1')
        )
      );
    case 'review':
      if (
        typeof body.requestId !== 'string' ||
        (body.decision !== 'accept' && body.decision !== 'return') ||
        typeof body.idempotencyKey !== 'string'
      ) {
        return invalidRequest('数据开发确认参数不合法');
      }
      return metricResponse(
        await services.metricFulfillment.reviewMetricRequest(
          {
            blueprintId,
            requestId: body.requestId,
            decision: body.decision,
            ...(typeof body.returnCategory === 'string'
              ? { returnCategory: body.returnCategory }
              : {}),
            ...(typeof body.note === 'string' ? { note: body.note } : {}),
            idempotencyKey: body.idempotencyKey
          } as ReviewMetricRequestCommand,
          fulfillmentContext('reviewer-data-1')
        )
      );
    case 'revise':
      if (
        typeof body.requestId !== 'string' ||
        typeof body.definition !== 'string' ||
        !isStringArray(body.requiredDimensions) ||
        !isStringArray(body.requiredAggregations) ||
        typeof body.contextSummary !== 'string' ||
        typeof body.idempotencyKey !== 'string'
      ) {
        return invalidRequest('原子指标需求修订参数不合法');
      }
      return metricResponse(
        await services.metricFulfillment.reviseMetricRequest(
          {
            blueprintId,
            requestId: body.requestId,
            ...(typeof body.name === 'string' ? { name: body.name } : {}),
            definition: body.definition,
            requiredDimensions: body.requiredDimensions,
            requiredAggregations: body.requiredAggregations,
            contextSummary: body.contextSummary,
            idempotencyKey: body.idempotencyKey
          } satisfies ReviseMetricRequestCommand,
          fulfillmentContext('developer-1')
        )
      );
    case 'search_candidates': {
      if (typeof body.requestId !== 'string') {
        return invalidRequest('DP 候选查询缺少原子指标需求 ID');
      }
      const current = await services.metricFulfillment.getBlueprint(blueprintId);
      if (!current.ok) return metricResponse(current);
      const metricRequest = current.snapshot.requests.find(
        (candidate) => candidate.requestId === body.requestId
      );
      if (!metricRequest) return invalidRequest('原子指标需求不存在');
      const candidates = await services.dpCatalog.searchCandidates({
        query: `${metricRequest.name} ${metricRequest.definition}`,
        requiredDimensions: metricRequest.requiredDimensions,
        requiredAggregations: metricRequest.requiredAggregations
      });
      return json(
        { ok: true, candidates: candidates.candidates },
        { headers: { 'cache-control': 'no-store' } }
      );
    }
    case 'link_dp_metric':
      if (
        typeof body.requestId !== 'string' ||
        typeof body.dpMetricId !== 'string' ||
        typeof body.idempotencyKey !== 'string'
      ) {
        return invalidRequest('关联 DP 指标参数不合法');
      }
      return metricResponse(
        await services.metricFulfillment.linkDpMetric(
          {
            blueprintId,
            requestId: body.requestId,
            dpMetricId: body.dpMetricId,
            idempotencyKey: body.idempotencyKey
          } satisfies LinkDpMetricCommand,
          fulfillmentContext('reviewer-data-1')
        )
      );
    case 'refresh':
      return metricResponse(
        await services.metricFulfillment.refresh(
          { blueprintId },
          fulfillmentContext('system-sync')
        )
      );
    default:
      return invalidRequest(`不支持的指标履约动作:${body.action}`);
  }
};

function fulfillmentContext(actorId: string): MetricFulfillmentContext {
  return {
    actorId,
    clientId: 'workbench',
    ...(actorId === 'reviewer-data-1'
      ? { capabilities: ['metric_reviewer'] as const }
      : {})
  };
}

function metricResponse(
  result: MetricFulfillmentResult
) {
  const status = result.ok
    ? 200
    : result.error.code === 'BLUEPRINT_NOT_FOUND'
      ? 404
      : result.error.code.endsWith('_FORBIDDEN')
        ? 403
        : 409;
  return json(result, {
    status,
    headers: { 'cache-control': 'no-store' }
  });
}

function invalidRequest(message: string) {
  return json(
    { ok: false, error: { code: 'INVALID_REQUEST', message } },
    { status: 400 }
  );
}

async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
