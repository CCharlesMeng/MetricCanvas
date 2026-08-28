import type {
  PageRevision,
  RevisionReference
} from '@metriccanvas/page-lifecycle';

export interface TemplateContext {
  actorId: string;
  clientId: string;
  subjectIds?: readonly string[];
  roles?: readonly TemplateRole[];
}

export type TemplateRole = 'admin';

export interface TemplateRevision {
  revisionId: string;
  revisionNumber: number;
  templateId: string;
  baseRevisionId: string | null;
  title: string;
  description: string;
  tags: string[];
  viewerSubjectIds: string[];
  source: RevisionReference;
  createdBy: string;
  createdAt: string;
}

export interface SaveTemplateRevisionCommand {
  templateId: string;
  baseRevisionId: string | null;
  title: string;
  description?: string;
  tags?: string[];
  viewerSubjectIds: string[];
  source: RevisionReference;
  idempotencyKey: string;
}

export interface RequestTemplatePublishCommand {
  templateId: string;
  revisionId: string;
  idempotencyKey: string;
}

export interface ConfirmTemplatePublishCommand {
  requestId: string;
  token: string;
}

export interface TemplatePublishRequest {
  requestId: string;
  templateId: string;
  revisionId: string;
  confirmationUrl: string;
  requestedBy: string;
  status: TemplatePublishStatus;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type TemplatePublishStatus = 'pending' | 'published';

export interface TemplateListItem {
  templateId: string;
  latestRevision: TemplateRevision;
  publishedRevision: TemplateRevision | null;
}

export interface TemplateMatch {
  templateId: string;
  revision: TemplateRevision;
  sourcePageRevision: PageRevision;
}

export type TemplateErrorCode =
  | 'TEMPLATE_FORBIDDEN'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_REVISION_NOT_FOUND'
  | 'TEMPLATE_REVISION_CONFLICT'
  | 'TEMPLATE_REVISION_NOT_LATEST'
  | 'SOURCE_REVISION_NOT_PUBLISHED'
  | 'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND'
  | 'TEMPLATE_PUBLISH_REQUEST_CLOSED'
  | 'INVALID_TEMPLATE_CONFIRMATION_TOKEN'
  | 'INVALID_TEMPLATE';

export interface TemplateError {
  code: TemplateErrorCode;
  message: string;
  currentLatestRevision?: TemplateRevision | null;
}

export type TemplateRevisionResult =
  | { ok: true; revision: TemplateRevision }
  | { ok: false; error: TemplateError };

export type TemplatePublishRequestResult =
  | { ok: true; request: TemplatePublishRequest }
  | { ok: false; error: TemplateError };

export interface TemplateLibrary {
  saveRevision(
    command: SaveTemplateRevisionCommand,
    context: TemplateContext
  ): Promise<TemplateRevisionResult>;
  requestPublish(
    command: RequestTemplatePublishCommand,
    context: TemplateContext
  ): Promise<TemplatePublishRequestResult>;
  getPublishRequest(
    reference: { requestId: string },
    context: TemplateContext
  ): Promise<TemplatePublishRequestResult>;
  confirmPublish(
    command: ConfirmTemplatePublishCommand,
    context: TemplateContext
  ): Promise<TemplateRevisionResult>;
  list(context: TemplateContext): Promise<{ templates: TemplateListItem[] }>;
  search(
    query: { query: string; limit?: number },
    context: TemplateContext
  ): Promise<{ matches: TemplateMatch[] }>;
  close(): Promise<void>;
}
