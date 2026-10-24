import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { versionPolicy, supportedVersions, pageCapabilities } from '../../packages/page/src/version';
import { localValidatorOutputs } from './local-authoring-projection';

type Outputs = Map<string, string>;
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function copyTree(root: string, prefix = ''): Promise<Outputs> {
  const outputs: Outputs = new Map();
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const file = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) for (const pair of await copyTree(root, file)) outputs.set(...pair);
    else outputs.set(file, await readFile(path.join(root, file), 'utf8'));
  }
  return outputs;
}

function addAtoms(outputs: Outputs, raw: any, source: string): void {
  for (const [key, content] of Object.entries(raw.tools)) outputs.set(`tool-contracts/${key}.json`, json({ ...content as object, source,
    ...(key === 'compose_page' ? { requestSchema: raw.composeSchema } : {}) }));
  const codes = new Set<string>([...raw.literalErrorCodes, ...raw.queryErrorCodes, ...raw.pageErrorTypes, ...Object.keys(raw.guidance)]);
  for (const code of codes) outputs.set(`errors/${code}.json`, json({ code,
    guidance: raw.guidance[code] ?? null, coverage: {
      literalCallSite: raw.literalErrorCodes.includes(code), queryClosedSet: raw.queryErrorCodes.includes(code), pageErrorType: raw.pageErrorTypes.includes(code), authoredGuidance: Object.hasOwn(raw.guidance, code)
    },
    note: 'Dynamic codes and deployment errors may be returned at runtime. Consume structured issue fields; no retry or permission is granted by this reference.' }));
}

function materialize(text: string, protocolVersion: string): string {
  return text.replaceAll('{{pageSchemaVersion}}', versionPolicy.current)
    .replaceAll('{{platformProtocolVersion}}', protocolVersion);
}

/** Compatibility projections are generated from MC facts; other Skill files remain authored. */
export async function mcPlatformFacts(root: string): Promise<Outputs> {
  const registration = JSON.parse(await readFile(path.join(root, 'metriccanvas-authoring/bundle.json'), 'utf8'));
  const protocol = registration.toolServices['metriccanvas-platform-content'].platformProtocolVersion;
  const outputs: Outputs = new Map();
  for (const [source, target] of [
    ['runtime/tool-behavior.md', 'references/tools.md'], ['runtime/error-repair.md', 'references/errors.md'],
    ['runtime/execution.md', 'references/execution.md'], ['layouts/reading.md', 'references/scenarios.md'],
    ['layouts/report.md', 'references/layouts/report.md'], ['layouts/dashboard.md', 'references/layouts/dashboard.md']
  ]) {
    let text = materialize(await readFile(path.join(root, 'tools/mc-content', source), 'utf8'), protocol);
    if (source === 'layouts/report.md') text = text.replace(/\]\(reading\.md\)/g, '](../scenarios.md)');
    outputs.set(target, text);
  }
  return outputs;
}

async function addPageTools(root: string, outputs: Outputs): Promise<void> {
  for (const [entry, target] of [
    ['tools/scripts/mc-content-page.ts', 'scripts/inspect-page.mjs'],
    ['tools/scripts/local-authoring-upgrade.ts', 'scripts/upgrade-page.mjs']
  ]) {
    for (const [file, text] of await localValidatorOutputs(root, entry, target)) {
      outputs.set(file === 'scripts/THIRD-PARTY-LICENSES.md' ? `${target}.LICENSES.md` : file, text);
    }
  }
}

function indexFor(outputs: Outputs): object {
  const directories: Record<string, string> = { error: 'errors/', tool: 'tool-contracts/', layout: 'layouts/standards/',
    protocol: 'protocols/', runtime: 'runtime/', snapshot: 'mc-closed-sets/' };
  return Object.fromEntries(Object.entries(directories).map(([topic, prefix]) => [topic,
    Object.fromEntries([...outputs.keys()].sort().filter(file => file.startsWith(prefix)).map(file => [
      file.slice(prefix.length).replace(/\.(?:json|md)$/, ''), file
    ]))]));
}

/** The active Python contract and the product policy are exported, never re-authored. */
export async function mcContentOutputs(root: string): Promise<Outputs> {
  const bundle = path.join(root, 'metriccanvas-authoring');
  const raw = JSON.parse(execFileSync(process.env.METRICCANVAS_PYTHON ?? 'python3',
    [path.join(root, 'tools/scripts/mc-contracts.py'), bundle], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, METRICCANVAS_BUNDLE_ROOT: bundle, PYTHONDONTWRITEBYTECODE: '1' }
    }));
  const outputs = await copyTree(path.join(root, 'tools/mc-content'));
  const lock = JSON.parse(await readFile(path.join(bundle, 'contract-lock.json'), 'utf8'));
  const registration = JSON.parse(await readFile(path.join(bundle, 'bundle.json'), 'utf8'));
  const alignedWith = { ...lock, platformProtocolVersion: registration.toolServices['metriccanvas-platform-content'].platformProtocolVersion };
  for (const [file, text] of outputs) if (file.endsWith('.md')) outputs.set(file, materialize(text, alignedWith.platformProtocolVersion));
  outputs.set('runtime/contract-alignment.json', json(alignedWith));
  const snapshot = json({ composeSchema: raw.composeSchema, patterns: raw.patterns,
    componentCatalog: raw.componentCatalog, authoringCapabilities: raw.authoringCapabilities,
    queryErrorCodes: raw.queryErrorCodes, pageErrorTypes: raw.pageErrorTypes });
  outputs.set('mc-closed-sets/snapshot.json', snapshot);
  outputs.set('protocols/page-schema.json', await readFile(path.join(bundle, 'contract-snapshot/page/schema.json'), 'utf8'));
  outputs.set('protocols/version-policy.json', json({ ...versionPolicy, readableVersions: supportedVersions(),
    capabilities: Object.fromEntries(Object.entries(pageCapabilities).map(([id, item]) => [id,
      { minor: item.minor, description: item.description, legacyReadable: !('legacyReadable' in item) || item.legacyReadable !== false }])) }));
  addAtoms(outputs, raw, 'active platform_mcp.py');
  await addPageTools(root, outputs);
  outputs.set('index.json', json(indexFor(outputs)));
  const files = [...outputs].map(([file, text]) => ({ file, sha256: hash(text) })).sort((a, b) => a.file.localeCompare(b.file, 'en'));
  outputs.set('mc-content.version.json', json({ interfaceVersion: '1.0',
    contentVersion: `1-${hash(json(files)).slice(0, 16)}`, contentSha256: hash(json(files)), files,
    alignedWith,
    snapshotSha256: hash(snapshot), evaluation: 'external-report; caller decides adoption' }));
  return outputs;
}
