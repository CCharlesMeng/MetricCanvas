export const AUTHORING_PROTOCOL = 'metriccanvas-authoring' as const;
export const AUTHORING_PROTOCOL_VERSION = 1 as const;

export interface AuthoringComponentLocator {
  sectionId: string;
  componentId: string;
}

export type AuthoringIntent =
  | { type: 'select_component'; locator: AuthoringComponentLocator }
  | {
      type: 'move_component';
      locator: AuthoringComponentLocator;
      before: AuthoringComponentLocator;
    }
  | {
      type: 'edit_component';
      locator: AuthoringComponentLocator;
      edit: { title?: string; detail?: string; span?: number };
    };

export interface AuthoringRenderMessage {
  protocol: typeof AUTHORING_PROTOCOL;
  version: typeof AUTHORING_PROTOCOL_VERSION;
  sessionId: string;
  type: 'render_document';
  document: unknown;
  selected?: AuthoringComponentLocator;
}

export type AuthoringRuntimeMessage =
  | {
      protocol: typeof AUTHORING_PROTOCOL;
      version: typeof AUTHORING_PROTOCOL_VERSION;
      sessionId: string;
      type: 'ready';
    }
  | {
      protocol: typeof AUTHORING_PROTOCOL;
      version: typeof AUTHORING_PROTOCOL_VERSION;
      sessionId: string;
      type: 'intent';
      intent: AuthoringIntent;
    };

export function authoringRenderMessage(
  sessionId: string,
  document: unknown,
  selected?: AuthoringComponentLocator | null
): AuthoringRenderMessage {
  return {
    protocol: AUTHORING_PROTOCOL,
    version: AUTHORING_PROTOCOL_VERSION,
    sessionId,
    type: 'render_document',
    document,
    ...(selected ? { selected: { ...selected } } : {})
  };
}

export function parseAuthoringHostMessage(
  value: unknown,
  sessionId: string
): AuthoringRenderMessage | null {
  if (!isEnvelope(value, sessionId) || value.type !== 'render_document') return null;
  if (!('document' in value) || value.document === undefined) return null;
  if ('selected' in value && value.selected !== undefined && !isLocator(value.selected)) {
    return null;
  }
  return value as unknown as AuthoringRenderMessage;
}

export function parseAuthoringRuntimeMessage(
  value: unknown,
  sessionId: string
): AuthoringRuntimeMessage | null {
  if (!isEnvelope(value, sessionId)) return null;
  if (value.type === 'ready') return value as unknown as AuthoringRuntimeMessage;
  if (value.type !== 'intent' || !('intent' in value) || !isIntent(value.intent)) {
    return null;
  }
  return value as unknown as AuthoringRuntimeMessage;
}

export function authoringReadyMessage(sessionId: string): AuthoringRuntimeMessage {
  return {
    protocol: AUTHORING_PROTOCOL,
    version: AUTHORING_PROTOCOL_VERSION,
    sessionId,
    type: 'ready'
  };
}

export function authoringIntentMessage(
  sessionId: string,
  intent: AuthoringIntent
): AuthoringRuntimeMessage {
  return {
    protocol: AUTHORING_PROTOCOL,
    version: AUTHORING_PROTOCOL_VERSION,
    sessionId,
    type: 'intent',
    intent
  };
}

function isEnvelope(
  value: unknown,
  sessionId: string
): value is Record<string, unknown> & { type: string } {
  return (
    isRecord(value) &&
    value.protocol === AUTHORING_PROTOCOL &&
    value.version === AUTHORING_PROTOCOL_VERSION &&
    value.sessionId === sessionId &&
    typeof value.type === 'string'
  );
}

function isIntent(value: unknown): value is AuthoringIntent {
  if (!isRecord(value) || typeof value.type !== 'string' || !isLocator(value.locator)) {
    return false;
  }
  if (value.type === 'select_component') return true;
  if (value.type === 'move_component') return isLocator(value.before);
  if (value.type !== 'edit_component' || !isRecord(value.edit)) return false;
  const edit = value.edit;
  const validTitle = edit.title === undefined || typeof edit.title === 'string';
  const validDetail = edit.detail === undefined || typeof edit.detail === 'string';
  const validSpan =
    edit.span === undefined ||
    (typeof edit.span === 'number' && Number.isInteger(edit.span) && edit.span >= 1 && edit.span <= 12);
  return validTitle && validDetail && validSpan;
}

function isLocator(value: unknown): value is AuthoringComponentLocator {
  return (
    isRecord(value) &&
    typeof value.sectionId === 'string' &&
    value.sectionId.length > 0 &&
    typeof value.componentId === 'string' &&
    value.componentId.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
