import { randomUUID } from 'node:crypto';
import postgres, {
  type JSONValue,
  type Sql,
  type TransactionSql
} from 'postgres';
import {
  createCatalogDiscovery,
  type CatalogDiscovery
} from '@metriccanvas/catalog-discovery';
import {
  createMemoryDpCatalog,
  DpCatalogError,
  type DpCatalog
} from '@metriccanvas/dp-catalog';

export type MetricNecessity = 'required' | 'optional';
export type MetricSuggestionSource = 'user' | 'ai';

export type AtomicMetricRequestStatus =
  | 'awaiting_candidate_confirmation'
  | 'awaiting_data_development_confirmation'
  | 'awaiting_dp_metric_link'
  | 'awaiting_publication'
  | 'awaiting_catalog_verification'
  | 'fulfilled'
  | 'rejected';

export type MetricRequestGroupReadiness =
  | 'blocked'
  | 'partially_ready'
  | 'ready';

export interface BlueprintModule {
  moduleId: string;
  title: string;
  metricRequestKeys: string[];
}

export interface PageBuildingBlueprint {
  blueprintId: string;
  pageId: string | null;
  baseRevisionId: string | null;
  goal: string;
  modules: BlueprintModule[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricRequestGroup {
  groupId: string;
  blueprintId: string;
  readiness: MetricRequestGroupReadiness;
  createdAt: string;
  updatedAt: string;
}

export interface AtomicMetricRequest {
  requestId: string;
  groupId: string;
  requestKey: string;
  name: string;
  definition: string;
  requiredDimensions: string[];
  requiredAggregations: string[];
  necessity: MetricNecessity;
  suggestedBy: MetricSuggestionSource;
  contextSummary: string;
  status: AtomicMetricRequestStatus;
  revisionNumber: number;
  reviewerId: string | null;
  dpMetricId: string | null;
  finalMetricCode: string | null;
  targetCatalog: string | null;
  catalogVerification: CatalogVerification | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CatalogVerificationStatus =
  | 'metric_missing'
  | 'capability_gap'
  | 'verified';

export interface CatalogVerification {
  status: CatalogVerificationStatus;
  metadataVersion: string;
  missingDimensions: string[];
  missingAggregations: string[];
  verifiedAt: string | null;
}

export interface BusinessMetricConfirmation {
  confirmationId: string;
  requestId: string;
  decision: 'create_new_metric' | 'reuse_dp_metric' | 'reject_metric';
  dpMetricId: string | null;
  actorId: string;
  occurredAt: string;
}

export type DataDevelopmentReturnCategory =
  | 'definition_unclear'
  | 'dimension_unavailable'
  | 'aggregation_unavailable'
  | 'existing_metric_reusable'
  | 'other';

export interface DataDevelopmentReview {
  reviewId: string;
  requestId: string;
  reviewerId: string;
  decision: 'accepted' | 'returned';
  returnCategory: DataDevelopmentReturnCategory | null;
  note: string | null;
  occurredAt: string;
}

export interface MetricRequestRevision {
  requestId: string;
  revisionNumber: number;
  name: string;
  definition: string;
  requiredDimensions: string[];
  requiredAggregations: string[];
  contextSummary: string;
  changedBy: string;
  changedAt: string;
}

export type MetricFulfillmentAuditAction =
  | 'blueprint_saved'
  | 'dp_metric_reuse_confirmed'
  | 'metric_gap_recorded'
  | 'data_development_accepted'
  | 'data_development_returned'
  | 'metric_request_revised'
  | 'dp_metric_linked'
  | 'dp_sync_failed'
  | 'catalog_verification_pending'
  | 'metric_fulfilled';

export interface MetricFulfillmentAudit {
  auditId: string;
  blueprintId: string;
  requestId: string | null;
  action: MetricFulfillmentAuditAction;
  actorId: string;
  clientId: string;
  occurredAt: string;
  details: Record<string, unknown>;
}

export interface MetricFulfillmentNotification {
  notificationId: string;
  recipientId: string;
  type: 'metric_group_ready';
  blueprintId: string;
  groupId: string;
  title: string;
  createdAt: string;
  readAt: string | null;
}

export interface MetricFulfillmentSnapshot {
  blueprint: PageBuildingBlueprint;
  group: MetricRequestGroup;
  requests: AtomicMetricRequest[];
  businessConfirmations: BusinessMetricConfirmation[];
  dataDevelopmentReviews: DataDevelopmentReview[];
  requestRevisions: MetricRequestRevision[];
  notifications: MetricFulfillmentNotification[];
  audits: MetricFulfillmentAudit[];
}

export interface ProposedMetricRequest {
  requestKey: string;
  name: string;
  definition: string;
  requiredDimensions: readonly string[];
  requiredAggregations: readonly string[];
  necessity?: MetricNecessity;
  suggestedBy: MetricSuggestionSource;
  contextSummary: string;
}

export interface SaveBlueprintCommand {
  blueprintId: string | null;
  pageId: string | null;
  baseRevisionId: string | null;
  goal: string;
  modules: readonly BlueprintModule[];
  metricRequests: readonly ProposedMetricRequest[];
  idempotencyKey: string;
}

export interface MetricFulfillmentContext {
  actorId: string;
  clientId: string;
  capabilities?: readonly MetricFulfillmentCapability[];
}

export type MetricFulfillmentCapability = 'metric_reviewer' | 'admin';

export type MetricFulfillmentErrorCode =
  | 'BLUEPRINT_NOT_FOUND'
  | 'INVALID_BLUEPRINT'
  | 'METRIC_REQUEST_NOT_FOUND'
  | 'INVALID_METRIC_REQUEST_STATE'
  | 'USER_CONFIRMATION_REQUIRED'
  | 'METRIC_REVIEW_FORBIDDEN'
  | 'METRIC_REQUEST_REVISION_FORBIDDEN'
  | 'METRIC_CONFIRMATION_FORBIDDEN'
  | 'DP_METRIC_NOT_FOUND'
  | 'DP_SYNC_FAILED';

export interface MetricFulfillmentError {
  code: MetricFulfillmentErrorCode;
  message: string;
}

export type MetricFulfillmentResult =
  | { ok: true; snapshot: MetricFulfillmentSnapshot }
  | { ok: false; error: MetricFulfillmentError };

export interface RecordMetricGapCommand {
  blueprintId: string;
  requestId: string;
  reviewerId: string;
  userConfirmed: boolean;
  idempotencyKey: string;
}

export interface ConfirmDpMetricReuseCommand {
  blueprintId: string;
  requestId: string;
  dpMetricId: string;
  userConfirmed: boolean;
  idempotencyKey: string;
}

export interface ReviewMetricRequestCommand {
  blueprintId: string;
  requestId: string;
  decision: 'accept' | 'return';
  returnCategory?: DataDevelopmentReturnCategory;
  note?: string;
  idempotencyKey: string;
}

export interface ReviseMetricRequestCommand {
  blueprintId: string;
  requestId: string;
  name?: string;
  definition: string;
  requiredDimensions: readonly string[];
  requiredAggregations: readonly string[];
  contextSummary: string;
  idempotencyKey: string;
}

export interface LinkDpMetricCommand {
  blueprintId: string;
  requestId: string;
  dpMetricId: string;
  idempotencyKey: string;
}

export interface RefreshMetricFulfillment {
  blueprintId: string;
}

export interface MetricFulfillment {
  saveBlueprint(
    command: SaveBlueprintCommand,
    context: MetricFulfillmentContext
  ): Promise<MetricFulfillmentResult>;
  recordMetricGap(
    command: RecordMetricGapCommand,
    context: MetricFulfillmentContext
  ): Promise<MetricFulfillmentResult>;
  confirmDpMetricReuse(
    command: ConfirmDpMetricReuseCommand,
    context: MetricFulfillmentContext
  ): Promise<MetricFulfillmentResult>;
  reviewMetricRequest(
    command: ReviewMetricRequestCommand,
    context: MetricFulfillmentContext
  ): Promise<MetricFulfillmentResult>;
  reviseMetricRequest(
    command: ReviseMetricRequestCommand,
    context: MetricFulfillmentContext
  ): Promise<MetricFulfillmentResult>;
  linkDpMetric(
    command: LinkDpMetricCommand,
    context: MetricFulfillmentContext
  ): Promise<MetricFulfillmentResult>;
  refresh(
    command: RefreshMetricFulfillment,
    context: MetricFulfillmentContext
  ): Promise<MetricFulfillmentResult>;
  findBlueprintForPage(pageId: string): Promise<MetricFulfillmentResult>;
  getBlueprint(blueprintId: string): Promise<MetricFulfillmentResult>;
  close(): Promise<void>;
}

export interface MemoryMetricFulfillmentOptions {
  dpCatalog?: DpCatalog;
  catalog?: Pick<CatalogDiscovery, 'current'>;
  ids?: { next(): string };
  clock?: { now(): Date };
  initialSnapshots?: readonly MetricFulfillmentSnapshot[];
}

export interface PostgresMetricFulfillmentOptions
  extends Omit<MemoryMetricFulfillmentOptions, 'initialSnapshots'> {
  databaseUrl: string;
}

export function createMemoryMetricFulfillment(
  options: MemoryMetricFulfillmentOptions = {}
): MetricFulfillment {
  const ids = options.ids ?? {
    next: () => randomUUID()
  };
  const clock = options.clock ?? { now: () => new Date() };
  const dpCatalog = options.dpCatalog ?? createMemoryDpCatalog([]);
  const catalog =
    options.catalog ??
    createCatalogDiscovery({
      current: async () => ({
        version: 'empty',
        snapshot: {
          formatVersion: '2.0',
          syncedAt: new Date(0).toISOString(),
          source: 'empty',
          metrics: [],
          dimensions: []
        }
      })
    });
  const snapshots = new Map(
    (options.initialSnapshots ?? []).map((snapshot) => [
      snapshot.blueprint.blueprintId,
      cloneSnapshot(snapshot)
    ])
  );
  const idempotency = new Map<string, MetricFulfillmentResult>();

  return {
    async saveBlueprint(command, context) {
      const replay = idempotency.get(
        idempotencyKey('save_blueprint', context, command.idempotencyKey)
      );
      if (replay) return cloneResult(replay);
      if (
        !command.goal.trim() ||
        command.metricRequests.length === 0 ||
        new Set(command.metricRequests.map((request) => request.requestKey)).size !==
          command.metricRequests.length
      ) {
        return {
          ok: false,
          error: {
            code: 'INVALID_BLUEPRINT',
            message: '页面搭建蓝图必须包含目标和 requestKey 唯一的原子指标需求'
          }
        };
      }

      const timestamp = clock.now().toISOString();
      const blueprintId = command.blueprintId ?? ids.next();
      const groupId = ids.next();
      const requests = command.metricRequests.map((request) => ({
        requestId: ids.next(),
        groupId,
        requestKey: request.requestKey,
        name: request.name.trim(),
        definition: request.definition.trim(),
        requiredDimensions: unique(request.requiredDimensions),
        requiredAggregations: unique(request.requiredAggregations),
        necessity:
          request.necessity ??
          (request.suggestedBy === 'user' ? 'required' : 'optional'),
        suggestedBy: request.suggestedBy,
        contextSummary: request.contextSummary.trim(),
        status: 'awaiting_candidate_confirmation' as const,
        revisionNumber: 1,
        reviewerId: null,
        dpMetricId: null,
        finalMetricCode: null,
        targetCatalog: null,
        catalogVerification: null,
        syncError: null,
        createdAt: timestamp,
        updatedAt: timestamp
      }));
      const snapshot: MetricFulfillmentSnapshot = {
        blueprint: {
          blueprintId,
          pageId: command.pageId,
          baseRevisionId: command.baseRevisionId,
          goal: command.goal.trim(),
          modules: command.modules.map((module) => ({
            moduleId: module.moduleId,
            title: module.title,
            metricRequestKeys: [...module.metricRequestKeys]
          })),
          ownerId: context.actorId,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        group: {
          groupId,
          blueprintId,
          readiness: 'blocked',
          createdAt: timestamp,
          updatedAt: timestamp
        },
        requests,
        businessConfirmations: [],
        dataDevelopmentReviews: [],
        requestRevisions: requests.map((request) =>
          toRequestRevision(request, context.actorId, timestamp)
        ),
        notifications: [],
        audits: [
          {
            auditId: ids.next(),
            blueprintId,
            requestId: null,
            action: 'blueprint_saved',
            actorId: context.actorId,
            clientId: context.clientId,
            occurredAt: timestamp,
            details: {
              metricRequestCount: requests.length,
              moduleCount: command.modules.length
            }
          }
        ]
      };
      snapshots.set(blueprintId, snapshot);
      const result: MetricFulfillmentResult = { ok: true, snapshot };
      idempotency.set(
        idempotencyKey('save_blueprint', context, command.idempotencyKey),
        result
      );
      return cloneResult(result);
    },

    async recordMetricGap(command, context) {
      if (!command.userConfirmed) {
        return {
          ok: false,
          error: {
            code: 'USER_CONFIRMATION_REQUIRED',
            message: '登记指标缺口需要用户明确确认'
          }
        };
      }
      const key = idempotencyKey(
        'record_metric_gap',
        context,
        command.idempotencyKey
      );
      const replay = idempotency.get(key);
      if (replay) return cloneResult(replay);

      const snapshot = snapshots.get(command.blueprintId);
      if (!snapshot) {
        return {
          ok: false,
          error: {
            code: 'BLUEPRINT_NOT_FOUND',
            message: `页面搭建蓝图不存在:${command.blueprintId}`
          }
        };
      }
      const request = snapshot.requests.find(
        (candidate) => candidate.requestId === command.requestId
      );
      if (!request) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REQUEST_NOT_FOUND',
            message: `原子指标需求不存在:${command.requestId}`
          }
        };
      }
      if (request.status !== 'awaiting_candidate_confirmation') {
        return {
          ok: false,
          error: {
            code: 'INVALID_METRIC_REQUEST_STATE',
            message: `当前状态不能登记指标缺口:${request.status}`
          }
        };
      }

      const occurredAt = clock.now().toISOString();
      request.status = 'awaiting_data_development_confirmation';
      request.reviewerId = command.reviewerId;
      request.updatedAt = occurredAt;
      snapshot.group.updatedAt = occurredAt;
      snapshot.blueprint.updatedAt = occurredAt;
      snapshot.businessConfirmations.push({
        confirmationId: ids.next(),
        requestId: request.requestId,
        decision: 'create_new_metric',
        dpMetricId: null,
        actorId: context.actorId,
        occurredAt
      });
      snapshot.audits.push({
        auditId: ids.next(),
        blueprintId: snapshot.blueprint.blueprintId,
        requestId: request.requestId,
        action: 'metric_gap_recorded',
        actorId: context.actorId,
        clientId: context.clientId,
        occurredAt,
        details: { decision: 'create_new_metric' }
      });
      const result: MetricFulfillmentResult = {
        ok: true,
        snapshot: cloneSnapshot(snapshot)
      };
      idempotency.set(key, result);
      return cloneResult(result);
    },

    async confirmDpMetricReuse(command, context) {
      if (!command.userConfirmed) {
        return {
          ok: false,
          error: {
            code: 'USER_CONFIRMATION_REQUIRED',
            message: '复用 DP 指标需要用户明确确认'
          }
        };
      }
      const key = idempotencyKey(
        'confirm_dp_metric_reuse',
        context,
        command.idempotencyKey
      );
      const replay = idempotency.get(key);
      if (replay) return cloneResult(replay);
      const snapshot = snapshots.get(command.blueprintId);
      if (!snapshot) return metricFulfillmentNotFound(command.blueprintId);
      if (
        snapshot.blueprint.ownerId !== context.actorId &&
        !context.capabilities?.includes('admin')
      ) {
        return {
          ok: false,
          error: {
            code: 'METRIC_CONFIRMATION_FORBIDDEN',
            message: '只有页面搭建蓝图所有者可以确认复用 DP 指标'
          }
        };
      }
      const request = snapshot.requests.find(
        (candidate) => candidate.requestId === command.requestId
      );
      if (!request) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REQUEST_NOT_FOUND',
            message: `原子指标需求不存在:${command.requestId}`
          }
        };
      }
      if (request.status !== 'awaiting_candidate_confirmation') {
        return {
          ok: false,
          error: {
            code: 'INVALID_METRIC_REQUEST_STATE',
            message: `当前状态不能确认复用 DP 指标:${request.status}`
          }
        };
      }
      let metric;
      try {
        metric = await dpCatalog.getMetric(command.dpMetricId);
      } catch (cause) {
        return {
          ok: false,
          error: {
            code: 'DP_SYNC_FAILED',
            message: cause instanceof Error ? cause.message : String(cause)
          }
        };
      }
      if (!metric) {
        return {
          ok: false,
          error: {
            code: 'DP_METRIC_NOT_FOUND',
            message: `DP 指标不存在:${command.dpMetricId}`
          }
        };
      }

      const occurredAt = clock.now().toISOString();
      request.dpMetricId = metric.id;
      request.finalMetricCode = metric.code;
      request.targetCatalog = metric.catalog;
      request.status =
        metric.status === 'published'
          ? 'awaiting_catalog_verification'
          : 'awaiting_publication';
      request.updatedAt = occurredAt;
      snapshot.blueprint.updatedAt = occurredAt;
      snapshot.group.updatedAt = occurredAt;
      snapshot.businessConfirmations.push({
        confirmationId: ids.next(),
        requestId: request.requestId,
        decision: 'reuse_dp_metric',
        dpMetricId: metric.id,
        actorId: context.actorId,
        occurredAt
      });
      snapshot.audits.push({
        auditId: ids.next(),
        blueprintId: snapshot.blueprint.blueprintId,
        requestId: request.requestId,
        action: 'dp_metric_reuse_confirmed',
        actorId: context.actorId,
        clientId: context.clientId,
        occurredAt,
        details: { dpMetricId: metric.id, dpStatus: metric.status }
      });
      const result: MetricFulfillmentResult = {
        ok: true,
        snapshot: cloneSnapshot(snapshot)
      };
      idempotency.set(key, result);
      return cloneResult(result);
    },

    async reviewMetricRequest(command, context) {
      if (!context.capabilities?.includes('metric_reviewer')) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REVIEW_FORBIDDEN',
            message: '数据开发确认需要 metric_reviewer 能力'
          }
        };
      }
      const key = idempotencyKey(
        'review_metric_request',
        context,
        command.idempotencyKey
      );
      const replay = idempotency.get(key);
      if (replay) return cloneResult(replay);

      const snapshot = snapshots.get(command.blueprintId);
      if (!snapshot) {
        return {
          ok: false,
          error: {
            code: 'BLUEPRINT_NOT_FOUND',
            message: `页面搭建蓝图不存在:${command.blueprintId}`
          }
        };
      }
      const request = snapshot.requests.find(
        (candidate) => candidate.requestId === command.requestId
      );
      if (!request) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REQUEST_NOT_FOUND',
            message: `原子指标需求不存在:${command.requestId}`
          }
        };
      }
      if (request.reviewerId !== context.actorId) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REVIEW_FORBIDDEN',
            message: `只有指定的数据开发确认人 ${request.reviewerId ?? '未指定'} 可以处理该原子指标需求`
          }
        };
      }
      if (request.status !== 'awaiting_data_development_confirmation') {
        return {
          ok: false,
          error: {
            code: 'INVALID_METRIC_REQUEST_STATE',
            message: `当前状态不能进行数据开发确认:${request.status}`
          }
        };
      }
      if (command.decision === 'return' && !command.returnCategory) {
        return {
          ok: false,
          error: {
            code: 'INVALID_METRIC_REQUEST_STATE',
            message: '数据开发退回必须提供结构化分类'
          }
        };
      }

      const occurredAt = clock.now().toISOString();
      const decision =
        command.decision === 'accept' ? ('accepted' as const) : ('returned' as const);
      request.status =
        decision === 'accepted' ? 'awaiting_dp_metric_link' : 'rejected';
      request.updatedAt = occurredAt;
      snapshot.group.updatedAt = occurredAt;
      snapshot.blueprint.updatedAt = occurredAt;
      snapshot.dataDevelopmentReviews.push({
        reviewId: ids.next(),
        requestId: request.requestId,
        reviewerId: context.actorId,
        decision,
        returnCategory: command.returnCategory ?? null,
        note: command.note?.trim() || null,
        occurredAt
      });
      snapshot.audits.push({
        auditId: ids.next(),
        blueprintId: snapshot.blueprint.blueprintId,
        requestId: request.requestId,
        action:
          decision === 'accepted'
            ? 'data_development_accepted'
            : 'data_development_returned',
        actorId: context.actorId,
        clientId: context.clientId,
        occurredAt,
        details: {
          returnCategory: command.returnCategory ?? null,
          note: command.note?.trim() || null
        }
      });
      const result: MetricFulfillmentResult = {
        ok: true,
        snapshot: cloneSnapshot(snapshot)
      };
      idempotency.set(key, result);
      return cloneResult(result);
    },

    async reviseMetricRequest(command, context) {
      const key = idempotencyKey(
        'revise_metric_request',
        context,
        command.idempotencyKey
      );
      const replay = idempotency.get(key);
      if (replay) return cloneResult(replay);

      const snapshot = snapshots.get(command.blueprintId);
      if (!snapshot) {
        return {
          ok: false,
          error: {
            code: 'BLUEPRINT_NOT_FOUND',
            message: `页面搭建蓝图不存在:${command.blueprintId}`
          }
        };
      }
      if (
        snapshot.blueprint.ownerId !== context.actorId &&
        !context.capabilities?.includes('admin')
      ) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REQUEST_REVISION_FORBIDDEN',
            message: '只有页面搭建蓝图所有者可以修订原子指标需求'
          }
        };
      }
      const request = snapshot.requests.find(
        (candidate) => candidate.requestId === command.requestId
      );
      if (!request) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REQUEST_NOT_FOUND',
            message: `原子指标需求不存在:${command.requestId}`
          }
        };
      }
      if (request.status !== 'rejected') {
        return {
          ok: false,
          error: {
            code: 'INVALID_METRIC_REQUEST_STATE',
            message: `只有被退回的原子指标需求可以修订:${request.status}`
          }
        };
      }

      const changedAt = clock.now().toISOString();
      request.name = command.name?.trim() || request.name;
      request.definition = command.definition.trim();
      request.requiredDimensions = unique(command.requiredDimensions);
      request.requiredAggregations = unique(command.requiredAggregations);
      request.contextSummary = command.contextSummary.trim();
      request.revisionNumber += 1;
      request.status = 'awaiting_data_development_confirmation';
      request.syncError = null;
      request.updatedAt = changedAt;
      snapshot.requestRevisions.push(
        toRequestRevision(request, context.actorId, changedAt)
      );
      snapshot.blueprint.updatedAt = changedAt;
      snapshot.group.updatedAt = changedAt;
      snapshot.audits.push({
        auditId: ids.next(),
        blueprintId: snapshot.blueprint.blueprintId,
        requestId: request.requestId,
        action: 'metric_request_revised',
        actorId: context.actorId,
        clientId: context.clientId,
        occurredAt: changedAt,
        details: { revisionNumber: request.revisionNumber }
      });
      const result: MetricFulfillmentResult = {
        ok: true,
        snapshot: cloneSnapshot(snapshot)
      };
      idempotency.set(key, result);
      return cloneResult(result);
    },

    async linkDpMetric(command, context) {
      const key = idempotencyKey(
        'link_dp_metric',
        context,
        command.idempotencyKey
      );
      const replay = idempotency.get(key);
      if (replay) return cloneResult(replay);
      const snapshot = snapshots.get(command.blueprintId);
      if (!snapshot) {
        return {
          ok: false,
          error: {
            code: 'BLUEPRINT_NOT_FOUND',
            message: `页面搭建蓝图不存在:${command.blueprintId}`
          }
        };
      }
      const request = snapshot.requests.find(
        (candidate) => candidate.requestId === command.requestId
      );
      if (!request) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REQUEST_NOT_FOUND',
            message: `原子指标需求不存在:${command.requestId}`
          }
        };
      }
      if (
        !context.capabilities?.includes('metric_reviewer') ||
        request.reviewerId !== context.actorId
      ) {
        return {
          ok: false,
          error: {
            code: 'METRIC_REVIEW_FORBIDDEN',
            message: '只有指定的数据开发确认人可以关联 DP 指标 ID'
          }
        };
      }
      if (request.status !== 'awaiting_dp_metric_link') {
        return {
          ok: false,
          error: {
            code: 'INVALID_METRIC_REQUEST_STATE',
            message: `当前状态不能关联 DP 指标:${request.status}`
          }
        };
      }

      let metric;
      try {
        metric = await dpCatalog.getMetric(command.dpMetricId);
      } catch (cause) {
        return {
          ok: false,
          error: {
            code: 'DP_SYNC_FAILED',
            message:
              cause instanceof DpCatalogError ? cause.message : String(cause)
          }
        };
      }
      if (!metric) {
        return {
          ok: false,
          error: {
            code: 'DP_METRIC_NOT_FOUND',
            message: `DP 指标不存在:${command.dpMetricId}`
          }
        };
      }

      const occurredAt = clock.now().toISOString();
      request.dpMetricId = metric.id;
      request.finalMetricCode = metric.code;
      request.targetCatalog = metric.catalog;
      request.catalogVerification = null;
      request.status =
        metric.status === 'published'
          ? 'awaiting_catalog_verification'
          : 'awaiting_publication';
      request.syncError = null;
      request.updatedAt = occurredAt;
      snapshot.blueprint.updatedAt = occurredAt;
      snapshot.group.updatedAt = occurredAt;
      snapshot.audits.push({
        auditId: ids.next(),
        blueprintId: snapshot.blueprint.blueprintId,
        requestId: request.requestId,
        action: 'dp_metric_linked',
        actorId: context.actorId,
        clientId: context.clientId,
        occurredAt,
        details: {
          dpMetricId: metric.id,
          dpStatus: metric.status
        }
      });
      const result: MetricFulfillmentResult = {
        ok: true,
        snapshot: cloneSnapshot(snapshot)
      };
      idempotency.set(key, result);
      return cloneResult(result);
    },

    async refresh(command, context) {
      const snapshot = snapshots.get(command.blueprintId);
      if (!snapshot) {
        return {
          ok: false,
          error: {
            code: 'BLUEPRINT_NOT_FOUND',
            message: `页面搭建蓝图不存在:${command.blueprintId}`
          }
        };
      }
      const occurredAt = clock.now().toISOString();
      for (const request of snapshot.requests) {
        if (
          !request.dpMetricId ||
          (request.status !== 'awaiting_publication' &&
            request.status !== 'awaiting_catalog_verification')
        ) {
          continue;
        }

        let dpMetric;
        try {
          dpMetric = await dpCatalog.getMetric(request.dpMetricId);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          request.syncError = message;
          request.updatedAt = occurredAt;
          snapshot.audits.push({
            auditId: ids.next(),
            blueprintId: snapshot.blueprint.blueprintId,
            requestId: request.requestId,
            action: 'dp_sync_failed',
            actorId: context.actorId,
            clientId: context.clientId,
            occurredAt,
            details: { message }
          });
          continue;
        }
        if (!dpMetric) {
          request.syncError = `DP 指标不存在:${request.dpMetricId}`;
          request.updatedAt = occurredAt;
          continue;
        }
        if (dpMetric.status === 'draft') {
          request.syncError = null;
          request.updatedAt = occurredAt;
          continue;
        }
        if (!dpMetric.code || !dpMetric.catalog) {
          request.syncError = 'DP 已发布指标缺少最终 code 或数据服务目录';
          request.updatedAt = occurredAt;
          continue;
        }

        request.status = 'awaiting_catalog_verification';
        request.finalMetricCode = dpMetric.code;
        request.targetCatalog = dpMetric.catalog;
        request.syncError = null;
        request.updatedAt = occurredAt;

        let currentCatalog;
        try {
          currentCatalog = await catalog.current();
        } catch (cause) {
          request.syncError =
            cause instanceof Error ? cause.message : String(cause);
          continue;
        }
        const catalogMetric = currentCatalog.snapshot.metrics.find(
          (metric) => metric.code === dpMetric.code
        );
        if (!catalogMetric) {
          const changed =
            request.catalogVerification?.status !== 'metric_missing' ||
            request.catalogVerification.metadataVersion !== currentCatalog.version;
          request.catalogVerification = {
            status: 'metric_missing',
            metadataVersion: currentCatalog.version,
            missingDimensions: [],
            missingAggregations: [],
            verifiedAt: null
          };
          if (changed) {
            snapshot.audits.push({
              auditId: ids.next(),
              blueprintId: snapshot.blueprint.blueprintId,
              requestId: request.requestId,
              action: 'catalog_verification_pending',
              actorId: context.actorId,
              clientId: context.clientId,
              occurredAt,
              details: {
                metricCode: dpMetric.code,
                reason: 'metric_missing',
                metadataVersion: currentCatalog.version
              }
            });
          }
          continue;
        }

        const missingDimensions = missingCapabilities(
          request.requiredDimensions,
          catalogMetric.availableDimensions
        );
        const missingAggregations = missingCapabilities(
          request.requiredAggregations,
          catalogMetric.availableAggregations
        );
        if (missingDimensions.length > 0 || missingAggregations.length > 0) {
          request.catalogVerification = {
            status: 'capability_gap',
            metadataVersion: currentCatalog.version,
            missingDimensions,
            missingAggregations,
            verifiedAt: null
          };
          continue;
        }

        request.status = 'fulfilled';
        request.catalogVerification = {
          status: 'verified',
          metadataVersion: currentCatalog.version,
          missingDimensions: [],
          missingAggregations: [],
          verifiedAt: occurredAt
        };
        snapshot.audits.push({
          auditId: ids.next(),
          blueprintId: snapshot.blueprint.blueprintId,
          requestId: request.requestId,
          action: 'metric_fulfilled',
          actorId: context.actorId,
          clientId: context.clientId,
          occurredAt,
          details: {
            metricCode: dpMetric.code,
            metadataVersion: currentCatalog.version
          }
        });
      }

      const previousReadiness = snapshot.group.readiness;
      snapshot.group.readiness = deriveReadiness(snapshot.requests);
      snapshot.group.updatedAt = occurredAt;
      snapshot.blueprint.updatedAt = occurredAt;
      if (
        previousReadiness !== 'ready' &&
        snapshot.group.readiness === 'ready' &&
        !snapshot.notifications.some(
          (notification) =>
            notification.type === 'metric_group_ready' &&
            notification.groupId === snapshot.group.groupId
        )
      ) {
        snapshot.notifications.push({
          notificationId: ids.next(),
          recipientId: snapshot.blueprint.ownerId,
          type: 'metric_group_ready',
          blueprintId: snapshot.blueprint.blueprintId,
          groupId: snapshot.group.groupId,
          title: '指标已就绪，可以继续完成页面',
          createdAt: occurredAt,
          readAt: null
        });
      }
      return { ok: true, snapshot: cloneSnapshot(snapshot) };
    },

    async getBlueprint(blueprintId) {
      const snapshot = snapshots.get(blueprintId);
      return snapshot
        ? { ok: true, snapshot: cloneSnapshot(snapshot) }
        : {
            ok: false,
            error: {
              code: 'BLUEPRINT_NOT_FOUND',
              message: `页面搭建蓝图不存在:${blueprintId}`
            }
          };
    },

    async findBlueprintForPage(pageId) {
      const snapshot = [...snapshots.values()]
        .filter((candidate) => candidate.blueprint.pageId === pageId)
        .sort((left, right) =>
          right.blueprint.updatedAt.localeCompare(left.blueprint.updatedAt)
        )[0];
      return snapshot
        ? { ok: true, snapshot: cloneSnapshot(snapshot) }
        : metricFulfillmentNotFound(pageId);
    },

    async close() {}
  };
}

export async function createPostgresMetricFulfillment(
  options: PostgresMetricFulfillmentOptions
): Promise<MetricFulfillment> {
  const sql = postgres(options.databaseUrl, { max: 5, onnotice: () => {} });
  await ensureMetricFulfillmentSchema(sql);

  const runIdempotent = async (
    operation: string,
    blueprintId: string | null,
    idempotency: string,
    context: MetricFulfillmentContext,
    invoke: (fulfillment: MetricFulfillment) => Promise<MetricFulfillmentResult>
  ): Promise<MetricFulfillmentResult> =>
    sql.begin(async (tx) => {
      await tx`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            ${`metric_fulfillment:${operation}:${context.clientId}:${idempotency}`},
            0
          )
        )
      `;
      const replay = await selectMetricFulfillmentIdempotency(
        tx,
        operation,
        context.clientId,
        idempotency
      );
      if (replay) return replay;

      const snapshot = blueprintId
        ? await lockMetricFulfillmentSnapshot(tx, blueprintId)
        : null;
      const fulfillment = createMemoryMetricFulfillment({
        dpCatalog: options.dpCatalog,
        catalog: options.catalog,
        ids: options.ids,
        clock: options.clock,
        initialSnapshots: snapshot ? [snapshot] : []
      });
      const result = await invoke(fulfillment);
      if (result.ok) {
        await upsertMetricFulfillmentSnapshot(tx, result.snapshot);
        await tx`
          INSERT INTO metric_fulfillment_idempotency (
            operation,
            client_id,
            idempotency_key,
            result
          )
          VALUES (
            ${operation},
            ${context.clientId},
            ${idempotency},
            ${tx.json(result as unknown as JSONValue)}
          )
        `;
      }
      return result;
    });

  return {
    saveBlueprint: (command, context) =>
      runIdempotent(
        'save_blueprint',
        command.blueprintId,
        command.idempotencyKey,
        context,
        (fulfillment) => fulfillment.saveBlueprint(command, context)
      ),
    recordMetricGap: (command, context) =>
      runIdempotent(
        'record_metric_gap',
        command.blueprintId,
        command.idempotencyKey,
        context,
        (fulfillment) => fulfillment.recordMetricGap(command, context)
      ),
    confirmDpMetricReuse: (command, context) =>
      runIdempotent(
        'confirm_dp_metric_reuse',
        command.blueprintId,
        command.idempotencyKey,
        context,
        (fulfillment) => fulfillment.confirmDpMetricReuse(command, context)
      ),
    reviewMetricRequest: (command, context) =>
      runIdempotent(
        'review_metric_request',
        command.blueprintId,
        command.idempotencyKey,
        context,
        (fulfillment) => fulfillment.reviewMetricRequest(command, context)
      ),
    reviseMetricRequest: (command, context) =>
      runIdempotent(
        'revise_metric_request',
        command.blueprintId,
        command.idempotencyKey,
        context,
        (fulfillment) => fulfillment.reviseMetricRequest(command, context)
      ),
    linkDpMetric: (command, context) =>
      runIdempotent(
        'link_dp_metric',
        command.blueprintId,
        command.idempotencyKey,
        context,
        (fulfillment) => fulfillment.linkDpMetric(command, context)
      ),
    async refresh(command, context) {
      return sql.begin(async (tx) => {
        const snapshot = await lockMetricFulfillmentSnapshot(
          tx,
          command.blueprintId
        );
        if (!snapshot) {
          return metricFulfillmentNotFound(command.blueprintId);
        }
        const fulfillment = createMemoryMetricFulfillment({
          dpCatalog: options.dpCatalog,
          catalog: options.catalog,
          ids: options.ids,
          clock: options.clock,
          initialSnapshots: [snapshot]
        });
        const result = await fulfillment.refresh(command, context);
        if (result.ok) {
          await upsertMetricFulfillmentSnapshot(tx, result.snapshot);
        }
        return result;
      });
    },
    async getBlueprint(blueprintId) {
      const rows = (await sql`
        SELECT snapshot
        FROM metric_fulfillment_blueprints
        WHERE blueprint_id = ${blueprintId}
      `) as unknown as Array<{ snapshot: MetricFulfillmentSnapshot }>;
      return rows[0]
        ? { ok: true, snapshot: cloneSnapshot(rows[0].snapshot) }
        : metricFulfillmentNotFound(blueprintId);
    },
    async findBlueprintForPage(pageId) {
      const rows = (await sql`
        SELECT snapshot
        FROM metric_fulfillment_blueprints
        WHERE snapshot -> 'blueprint' ->> 'pageId' = ${pageId}
        ORDER BY updated_at DESC
        LIMIT 1
      `) as unknown as Array<{ snapshot: MetricFulfillmentSnapshot }>;
      return rows[0]
        ? { ok: true, snapshot: cloneSnapshot(rows[0].snapshot) }
        : metricFulfillmentNotFound(pageId);
    },
    async close() {
      await sql.end();
    }
  };
}

async function ensureMetricFulfillmentSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS metric_fulfillment_blueprints (
      blueprint_id TEXT PRIMARY KEY,
      snapshot JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS metric_fulfillment_idempotency (
      operation TEXT NOT NULL,
      client_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      result JSONB NOT NULL,
      PRIMARY KEY (operation, client_id, idempotency_key)
    )
  `;
}

async function selectMetricFulfillmentIdempotency(
  sql: Sql | TransactionSql,
  operation: string,
  clientId: string,
  idempotencyKey: string
): Promise<MetricFulfillmentResult | null> {
  const rows = (await sql`
    SELECT result
    FROM metric_fulfillment_idempotency
    WHERE operation = ${operation}
      AND client_id = ${clientId}
      AND idempotency_key = ${idempotencyKey}
  `) as unknown as Array<{ result: MetricFulfillmentResult }>;
  return rows[0]?.result ? cloneResult(rows[0].result) : null;
}

async function lockMetricFulfillmentSnapshot(
  sql: TransactionSql,
  blueprintId: string
): Promise<MetricFulfillmentSnapshot | null> {
  await sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`metric_fulfillment_blueprint:${blueprintId}`}, 0)
    )
  `;
  const rows = (await sql`
    SELECT snapshot
    FROM metric_fulfillment_blueprints
    WHERE blueprint_id = ${blueprintId}
    FOR UPDATE
  `) as unknown as Array<{ snapshot: MetricFulfillmentSnapshot }>;
  return rows[0]?.snapshot ? cloneSnapshot(rows[0].snapshot) : null;
}

async function upsertMetricFulfillmentSnapshot(
  sql: TransactionSql,
  snapshot: MetricFulfillmentSnapshot
): Promise<void> {
  await sql`
    INSERT INTO metric_fulfillment_blueprints (
      blueprint_id,
      snapshot,
      updated_at
    )
    VALUES (
      ${snapshot.blueprint.blueprintId},
      ${sql.json(snapshot as unknown as JSONValue)},
      ${new Date(snapshot.blueprint.updatedAt)}
    )
    ON CONFLICT (blueprint_id)
    DO UPDATE SET
      snapshot = EXCLUDED.snapshot,
      updated_at = EXCLUDED.updated_at
  `;
}

function metricFulfillmentNotFound(
  blueprintId: string
): MetricFulfillmentResult {
  return {
    ok: false,
    error: {
      code: 'BLUEPRINT_NOT_FOUND',
      message: `页面搭建蓝图不存在:${blueprintId}`
    }
  };
}

function idempotencyKey(
  operation: string,
  context: MetricFulfillmentContext,
  key: string
): string {
  return `${operation}:${context.clientId}:${key}`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function missingCapabilities(
  required: readonly string[],
  available: readonly string[]
): string[] {
  const availableSet = new Set(available);
  return required.filter((capability) => !availableSet.has(capability));
}

function deriveReadiness(
  requests: readonly AtomicMetricRequest[]
): MetricRequestGroupReadiness {
  const required = requests.filter((request) => request.necessity === 'required');
  if (
    required.length > 0 &&
    required.every((request) => request.status === 'fulfilled')
  ) {
    return 'ready';
  }
  return requests.some((request) => request.status === 'fulfilled')
    ? 'partially_ready'
    : 'blocked';
}

function toRequestRevision(
  request: AtomicMetricRequest,
  changedBy: string,
  changedAt: string
): MetricRequestRevision {
  return {
    requestId: request.requestId,
    revisionNumber: request.revisionNumber,
    name: request.name,
    definition: request.definition,
    requiredDimensions: [...request.requiredDimensions],
    requiredAggregations: [...request.requiredAggregations],
    contextSummary: request.contextSummary,
    changedBy,
    changedAt
  };
}

function cloneResult(result: MetricFulfillmentResult): MetricFulfillmentResult {
  return result.ok
    ? { ok: true, snapshot: cloneSnapshot(result.snapshot) }
    : { ok: false, error: { ...result.error } };
}

function cloneSnapshot(snapshot: MetricFulfillmentSnapshot): MetricFulfillmentSnapshot {
  return structuredClone(snapshot);
}
