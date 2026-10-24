import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePageDocument } from '../../packages/page/src/validate';
import { upgradePageDocument } from '../../packages/page/src/upgrade-document';
import { versionPolicy, supportedVersions, capabilityFloorErrors, requiredMinorVersion } from '../../packages/page/src/version';
import { pageSchema } from '../../packages/page/src/schema';
import { scanPageData } from './local-authoring-data-analysis';

/** Separate runtime readability, authoring upgrade support, and future-version inputs. */
export function inspectSchema(input: unknown): object {
  const declared = input && typeof input === 'object' ? (input as Record<string, unknown>).schemaVersion : undefined;
  const parsed = normalizePageDocument(input);
  const upgrade = upgradePageDocument(input);
  const fields = parsed.ok ? scanPageData(parsed.document, pageSchema).uses.filter(use => use.field && use.source) : [];
  return { declaredVersion: declared ?? null, targetVersion: versionPolicy.current,
    readableVersions: supportedVersions(), readable: parsed.ok,
    requiredVersion: `${versionPolicy.major}.${requiredMinorVersion(input)}`,
    capabilityErrors: capabilityFloorErrors(input),
    validationErrors: parsed.ok ? [] : parsed.errors,
    fieldUses: fields.map(({componentId, source, field, path}) => ({componentId, source, field, path})),
    upgrade: { possible: upgrade.ok, changes: upgrade.changes, warnings: upgrade.warnings, errors: upgrade.errors },
    status: parsed.ok ? (declared === versionPolicy.current ? 'current' : 'readable')
      : (upgrade.ok ? 'upgrade_required' : 'needs_review'),
    note: 'Read-only diagnosis. Upgrade writes only to an explicitly chosen new directory; never edit schemaVersion alone.' };
}

export function main(args: string[]): number {
  const [file] = args;
  try {
    if (!file || args.length !== 1) throw new Error('Usage: node inspect-page.mjs <page.json|--stdin>');
    console.log(JSON.stringify(inspectSchema(JSON.parse(readFileSync(file === '--stdin' ? 0 : file, 'utf8')))));
    return 0;
  } catch (error) {
    console.error(JSON.stringify({ code: 'PAGE_INSPECTION_INPUT_INVALID', message: String(error) }));
    return 2;
  }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
