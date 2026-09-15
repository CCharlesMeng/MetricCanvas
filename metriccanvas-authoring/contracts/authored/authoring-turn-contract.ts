import schema from './authoring-turn.schema.json';

/** Program channel only. Structural validity never proves authority or freshness. */
export interface AuthoringTurnBinding {
  version: '1.0'; contextRef: string; actorId: string; workspaceId: string;
  requestId: string; runId: string; turnId: string; pageId: string;
  capabilityVersion: string; status: 'active' | 'cancelled' | 'closed';
  mode: 'new' | 'existing'; access: 'read' | 'write';
  baseRef: { pageId: string; revisionId: string; resourceId: string } | null;
  documentSha256: string | null; selectedComponentId: string | null;
}

type Schema = Record<string, any>;
// This deliberately supports only the vocabulary present in the frozen author.
// A schema extension fails closed until both consumers and vectors are updated.
const keywords = new Set(['$schema', '$id', 'title', 'type', 'const', 'enum', 'minLength', 'maxLength', 'pattern', 'properties', 'required', 'additionalProperties', 'allOf', 'anyOf', 'if', 'then', 'else']);
function matches(node: Schema, value: unknown): boolean {
  if (Object.keys(node).some(key => !keywords.has(key))) return false;
  if ('const' in node && value !== node.const) return false;
  if (node.enum && !node.enum.includes(value)) return false;
  if (node.type === 'null' && value !== null) return false;
  if (node.type === 'string') {
    if (typeof value !== 'string' || value.length < (node.minLength ?? 0) || value.length > (node.maxLength ?? Infinity)) return false;
    if (node.pattern && !new RegExp(node.pattern).test(value)) return false;
  }
  if (node.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) return false;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (node.required?.some((key: string) => !Object.hasOwn(record, key))) return false;
    if (node.additionalProperties === false && Object.keys(record).some(key => !Object.hasOwn(node.properties ?? {}, key))) return false;
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      if (Object.hasOwn(record, key) && !matches(child as Schema, record[key])) return false;
    }
  }
  if (node.anyOf && !node.anyOf.some((child: Schema) => matches(child, value))) return false;
  if (node.allOf && !node.allOf.every((child: Schema) => matches(child, value))) return false;
  if (node.if) {
    const branch = matches(node.if, value) ? node.then : node.else;
    if (branch && !matches(branch, value)) return false;
  }
  return true;
}
export function validateAuthoringTurn(value: unknown): value is AuthoringTurnBinding {
  return matches(schema, value);
}
