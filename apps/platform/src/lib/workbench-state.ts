import type {
  AgentInteraction,
  AgentMessage,
  ToolCall
} from '@metriccanvas/agent-runner';

export type WorkbenchStageKey =
  | 'catalog'
  | 'validation'
  | 'identity'
  | 'revision'
  | 'preview'
  | 'publish';

export type WorkbenchStageStatus =
  | 'pending'
  | 'complete'
  | 'action_required'
  | 'failed';

export interface WorkbenchStage {
  key: WorkbenchStageKey;
  status: WorkbenchStageStatus;
}

export interface CatalogReceipt {
  metadataVersion: string;
  metric: {
    code: string;
    name: string;
    aggregation: string | null;
    dimensions: string[];
  };
}

export interface ValidationReceipt {
  valid: boolean;
  currentFormatVersion: string | null;
  metadataVersion: string | null;
  errors: unknown[];
}

export interface PageIdentityReceipt {
  pageId: string;
  title: string | null;
  stablePath: string;
  confirmed: boolean;
  immutableAfterSave: true;
}

export interface RevisionReceipt {
  pageId: string;
  revisionId: string;
  revisionNumber: number;
  contentHash: string;
  metadataVersion: string;
  createdBy: string;
  createdAt: string;
  document: Record<string, unknown>;
}

export interface PreviewReceipt {
  pageId: string;
  revisionId: string;
  previewUrl: string;
  matchesRevision: boolean;
}

export interface PublishReceipt {
  requestId: string;
  pageId: string;
  revisionId: string;
  expiresAt: string;
  confirmationUrl: string;
  status: WorkbenchPublishStatus;
  matchesRevision: boolean;
}

export type WorkbenchPublishStatus =
  | 'pending'
  | 'published'
  | 'expired'
  | 'validation_failed'
  | 'rejected'
  | 'cancelled';

export interface WorkbenchState {
  stages: WorkbenchStage[];
  catalog?: CatalogReceipt;
  validation?: ValidationReceipt;
  identity?: PageIdentityReceipt;
  revision?: RevisionReceipt;
  preview?: PreviewReceipt;
  publish?: PublishReceipt;
}

export interface DeriveWorkbenchStateInput {
  messages: AgentMessage[];
  interaction?: AgentInteraction | null;
  confirmedPageIds?: Iterable<string>;
  publishStatus?: WorkbenchPublishStatus;
}

export function deriveWorkbenchState(input: DeriveWorkbenchStateInput): WorkbenchState {
  const calls = toolCallsById(input.messages);
  const failedTools = new Set<string>();
  let catalogResult: Record<string, unknown> | undefined;
  let validationResult: Record<string, unknown> | undefined;
  let validationDocument: Record<string, unknown> | undefined;
  let revisionResult: Record<string, unknown> | undefined;
  let previewResult: Record<string, unknown> | undefined;
  let publishResult: Record<string, unknown> | undefined;

  for (const message of input.messages) {
    if (message.role !== 'tool') continue;
    if (message.isError) failedTools.add(message.name);
    const result = parseRecord(message.content);
    if (!result) continue;
    const call = calls.get(message.toolCallId);

    if (message.name === 'search_catalog') catalogResult = result;
    if (message.name === 'validate_page') {
      validationResult = result;
      validationDocument = nestedRecord(call?.input, ['document']);
    }
    if (message.name === 'save_page') revisionResult = nestedRecord(result, ['revision']);
    if (message.name === 'preview_page') previewResult = result;
    if (message.name === 'request_publish') {
      publishResult = nestedRecord(result, ['request']);
    }
  }

  const revision = toRevisionReceipt(revisionResult);
  const document =
    revision?.document ??
    validationDocument ??
    interactionDocument(input.interaction);
  const confirmedPageIds = new Set(input.confirmedPageIds ?? []);
  if (revision) confirmedPageIds.add(revision.pageId);

  const identity = toIdentityReceipt(
    document,
    input.interaction,
    confirmedPageIds
  );
  const catalog = toCatalogReceipt(catalogResult, document);
  const validation = toValidationReceipt(validationResult);
  const preview = toPreviewReceipt(previewResult, revision);
  const publish = toPublishReceipt(
    publishResult,
    revision,
    input.publishStatus ?? 'pending'
  );

  return {
    stages: [
      {
        key: 'catalog',
        status: stageStatus(catalog, failedTools.has('search_catalog'))
      },
      {
        key: 'validation',
        status: validation
          ? validation.valid
            ? 'complete'
            : 'failed'
          : failedTools.has('validate_page')
            ? 'failed'
            : 'pending'
      },
      {
        key: 'identity',
        status: identity
          ? identity.confirmed
            ? 'complete'
            : input.interaction?.kind === 'confirm_page_id'
              ? 'action_required'
              : 'pending'
          : 'pending'
      },
      {
        key: 'revision',
        status: stageStatus(revision, failedTools.has('save_page'))
      },
      {
        key: 'preview',
        status: preview
          ? preview.matchesRevision
            ? 'complete'
            : 'failed'
          : failedTools.has('preview_page')
            ? 'failed'
            : 'pending'
      },
      {
        key: 'publish',
        status: publish
          ? publish.matchesRevision
            ? publish.status === 'published'
              ? 'complete'
              : publish.status === 'pending'
                ? 'action_required'
                : 'failed'
            : 'failed'
          : failedTools.has('request_publish')
            ? 'failed'
            : 'pending'
      }
    ],
    ...(catalog ? { catalog } : {}),
    ...(validation ? { validation } : {}),
    ...(identity ? { identity } : {}),
    ...(revision ? { revision } : {}),
    ...(preview ? { preview } : {}),
    ...(publish ? { publish } : {})
  };
}

function toolCallsById(messages: AgentMessage[]): Map<string, ToolCall> {
  const calls = new Map<string, ToolCall>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const call of message.toolCalls) calls.set(call.id, call);
  }
  return calls;
}

function toCatalogReceipt(
  result: Record<string, unknown> | undefined,
  document: Record<string, unknown> | undefined
): CatalogReceipt | undefined {
  if (!result || typeof result.metadataVersion !== 'string' || !Array.isArray(result.matches)) {
    return undefined;
  }
  const query = firstWidgetQuery(document);
  const metricCode =
    query && Array.isArray(query.metrics) && typeof query.metrics[0] === 'string'
      ? query.metrics[0]
      : null;
  const match =
    result.matches.find(
      (candidate) =>
        isRecord(candidate) &&
        candidate.kind === 'metric' &&
        (metricCode === null || candidate.code === metricCode)
    ) ?? result.matches.find((candidate) => isRecord(candidate) && candidate.kind === 'metric');
  if (!isRecord(match) || typeof match.code !== 'string' || typeof match.name !== 'string') {
    return undefined;
  }
  return {
    metadataVersion: result.metadataVersion,
    metric: {
      code: match.code,
      name: match.name,
      aggregation:
        query && typeof query.aggregation === 'string' ? query.aggregation : null,
      dimensions:
        query && Array.isArray(query.dimensions)
          ? query.dimensions.filter((value): value is string => typeof value === 'string')
          : []
    }
  };
}

function toValidationReceipt(
  result: Record<string, unknown> | undefined
): ValidationReceipt | undefined {
  if (!result || typeof result.valid !== 'boolean') return undefined;
  return {
    valid: result.valid,
    currentFormatVersion:
      typeof result.currentFormatVersion === 'string'
        ? result.currentFormatVersion
        : null,
    metadataVersion:
      typeof result.metadataVersion === 'string' ? result.metadataVersion : null,
    errors: Array.isArray(result.errors) ? result.errors : []
  };
}

function toIdentityReceipt(
  document: Record<string, unknown> | undefined,
  interaction: AgentInteraction | null | undefined,
  confirmedPageIds: Set<string>
): PageIdentityReceipt | undefined {
  const payload =
    interaction?.kind === 'confirm_page_id' ? interaction.payload : undefined;
  const pageId =
    typeof payload?.pageId === 'string'
      ? payload.pageId
      : typeof document?.id === 'string'
        ? document.id
        : null;
  if (!pageId) return undefined;
  const title =
    typeof payload?.title === 'string'
      ? payload.title
      : typeof document?.title === 'string'
        ? document.title
        : null;
  return {
    pageId,
    title,
    stablePath:
      typeof payload?.stablePath === 'string'
        ? payload.stablePath
        : `/pages/${pageId}`,
    confirmed: confirmedPageIds.has(pageId),
    immutableAfterSave: true
  };
}

function toRevisionReceipt(
  revision: Record<string, unknown> | undefined
): RevisionReceipt | undefined {
  if (
    !revision ||
    typeof revision.pageId !== 'string' ||
    typeof revision.revisionId !== 'string' ||
    typeof revision.revisionNumber !== 'number' ||
    typeof revision.contentHash !== 'string' ||
    typeof revision.metadataVersion !== 'string' ||
    typeof revision.createdBy !== 'string' ||
    typeof revision.createdAt !== 'string' ||
    !isRecord(revision.document)
  ) {
    return undefined;
  }
  return {
    pageId: revision.pageId,
    revisionId: revision.revisionId,
    revisionNumber: revision.revisionNumber,
    contentHash: revision.contentHash,
    metadataVersion: revision.metadataVersion,
    createdBy: revision.createdBy,
    createdAt: revision.createdAt,
    document: revision.document
  };
}

function toPreviewReceipt(
  result: Record<string, unknown> | undefined,
  revision: RevisionReceipt | undefined
): PreviewReceipt | undefined {
  if (
    !result ||
    typeof result.pageId !== 'string' ||
    typeof result.revisionId !== 'string' ||
    typeof result.previewUrl !== 'string'
  ) {
    return undefined;
  }
  return {
    pageId: result.pageId,
    revisionId: result.revisionId,
    previewUrl: result.previewUrl,
    matchesRevision:
      revision !== undefined &&
      revision.pageId === result.pageId &&
      revision.revisionId === result.revisionId
  };
}

function toPublishReceipt(
  request: Record<string, unknown> | undefined,
  revision: RevisionReceipt | undefined,
  status: WorkbenchPublishStatus
): PublishReceipt | undefined {
  if (
    !request ||
    typeof request.requestId !== 'string' ||
    typeof request.pageId !== 'string' ||
    typeof request.revisionId !== 'string' ||
    typeof request.expiresAt !== 'string' ||
    typeof request.confirmationUrl !== 'string'
  ) {
    return undefined;
  }
  return {
    requestId: request.requestId,
    pageId: request.pageId,
    revisionId: request.revisionId,
    expiresAt: request.expiresAt,
    confirmationUrl: request.confirmationUrl,
    status,
    matchesRevision:
      revision !== undefined &&
      revision.pageId === request.pageId &&
      revision.revisionId === request.revisionId
  };
}

function firstWidgetQuery(
  document: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!document || !Array.isArray(document.widgets)) return undefined;
  const widget = document.widgets.find(isRecord);
  return isRecord(widget?.query) ? widget.query : undefined;
}

function interactionDocument(
  interaction: AgentInteraction | null | undefined
): Record<string, unknown> | undefined {
  if (interaction?.kind !== 'confirm_page_id') return undefined;
  return isRecord(interaction.payload.document)
    ? interaction.payload.document
    : undefined;
}

function stageStatus(
  receipt: unknown,
  failed: boolean
): WorkbenchStageStatus {
  if (receipt) return 'complete';
  return failed ? 'failed' : 'pending';
}

function parseRecord(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function nestedRecord(
  value: unknown,
  path: string[]
): Record<string, unknown> | undefined {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return isRecord(current) ? current : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
