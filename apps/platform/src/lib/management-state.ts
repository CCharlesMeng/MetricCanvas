export interface RevisionAudit {
  revisionId: string;
  revisionNumber: number;
  baseRevisionId: string | null;
  contentHash: string;
  metadataVersion: string;
  createdBy: string;
  createdAt: string;
}

export interface RevisionComparison {
  selected: RevisionAudit;
  base: RevisionAudit | null;
}

/**
 * A Page Revision points at its linear predecessor. Resolve that relationship
 * by id rather than depending on the order returned by a transport.
 */
export function selectRevisionComparison(
  revisions: RevisionAudit[],
  revisionId: string
): RevisionComparison | null {
  const selected = revisions.find((revision) => revision.revisionId === revisionId);
  if (!selected) return null;
  return {
    selected,
    base:
      selected.baseRevisionId === null
        ? null
        : revisions.find((revision) => revision.revisionId === selected.baseRevisionId) ?? null
  };
}

export function runtimePreviewUrl(
  runtimeOrigin: string,
  pageId: string,
  revisionId: string
): string {
  const origin = runtimeOrigin.replace(/\/+$/, '');
  return `${origin}/pages/${encodeURIComponent(pageId)}?revision=${encodeURIComponent(revisionId)}`;
}

/** Serialize arbitrary diff payloads consistently for audit review. */
export function formatStructuredJson(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)])
  );
}
