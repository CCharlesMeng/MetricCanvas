import type { TemporalEvaluation } from '../../../packages/page/src/temporal-evaluation';
import { normalizePageDocument } from '../../../packages/page/src/validate';
import { upgradePageDocument } from '../../../packages/page/src/upgrade-document';
import { versionPolicy, supportedVersions, capabilityFloorErrors, requiredMinorVersion } from '../../../packages/page/src/version';
import { definitionSourceIds, resultSourceIds } from '../../../packages/page/src/data-source-references';
import { walkDocumentComponents } from '../../../packages/page/src/component-walk';
import { pageSchema } from '../../../packages/page/src/schema';
import { scanPageData } from './data-scan';
import type { DataSource } from '../../../packages/page/src/data-source';
import type { PageDocument } from '../../../packages/page/src/page-document';

/** Complete static reading projection. No query execution, rows or document writes. */
export function inspectPageSchema(input: unknown, evaluation?: TemporalEvaluation) {
  const declared = input && typeof input === 'object' ? (input as Record<string, unknown>).schemaVersion : undefined;
  const parsed = normalizePageDocument(input, {evaluation});
  const upgrade = upgradePageDocument(input, undefined, evaluation);
  const scan = parsed.ok ? scanPageData(parsed.document, pageSchema) : undefined;
  const fields = scan?.uses.filter(use => use.field && use.source) ?? [];
  const components: object[] = [];
  if (parsed.ok) walkDocumentComponents(parsed.document, (component, path) => {
    const match = /^\/sections\/(\d+)\//.exec(path);
    components.push({ id: component.id, type: component.type, path, data: component.data ?? {},
      sectionId: match ? parsed.document.sections[Number(match[1])].id : null });
  });
  return { declaredVersion: declared ?? null, targetVersion: versionPolicy.current,
    readableVersions: supportedVersions(), readable: parsed.ok,
    requiredVersion: `${versionPolicy.major}.${requiredMinorVersion(input)}`,
    capabilityErrors: capabilityFloorErrors(input), validationErrors: parsed.ok ? [] : parsed.errors,
    fieldUses: fields.map(({ componentId, source, field, path, slot, kind }) => ({ componentId, source, field, path, slot, kind })),
    components, dataCoverage: scan ? { diagnostics: scan.diagnostics, sources: sourceCoverage(parsed.ok ? parsed.document : undefined),
      declarationScope: 'all declared data slots, filter branches and source dependencies; no query bodies or data rows' } : null,
    upgrade: { possible: upgrade.ok, changes: upgrade.changes, warnings: upgrade.warnings, errors: upgrade.errors },
    status: parsed.ok ? (declared === versionPolicy.current ? 'current' : 'readable') : (upgrade.ok ? 'upgrade_required' : 'needs_review'),
    note: 'Read-only diagnosis. Upgrade writes only to an explicitly chosen new directory; never edit schemaVersion alone.' };
}

function sourceCoverage(document: PageDocument | undefined): object[] {
  if (!document) return [];
  return Object.entries(document.dataSources).map(([id, source]) => ({ id, type: source.source.type,
    fields: Object.keys(source.fields), definitionDependencies: definitionSourceIds(source as DataSource),
    resultDependencies: resultSourceIds(source as DataSource), computeOperations: source.compute?.length ?? 0 }));
}
