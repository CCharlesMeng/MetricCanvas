import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  componentCatalog,
  ERROR_TYPES,
  pageSchema,
  QUERY_ERROR_CODES,
  validate,
  versionPolicy
} from '../../packages/page/src/index.ts';
import { ANALYSIS_INTENTS } from '../../apps/platform/src/lib/server/session/step-event.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const bundleRoot = path.join(repoRoot, 'metriccanvas-authoring');
const generatedRoot = path.join(bundleRoot, 'contracts/generated');
const checkOnly = process.argv.includes('--check');

type OutputMap = Map<string, string>;

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function buildOutputs(): Promise<OutputMap> {
  const outputs: OutputMap = new Map();
  outputs.set('page-schema.json', json(pageSchema));
  outputs.set('component-catalog.json', json(componentCatalog));
  outputs.set('query-error-codes.json', json({ codes: QUERY_ERROR_CODES }));
  outputs.set('page-error-types.json', json({ types: ERROR_TYPES }));
  outputs.set('analysis-intents.json', json({ intents: ANALYSIS_INTENTS }));
  outputs.set(
    'page-build-spec.schema.json',
    await readFile(
      path.join(bundleRoot, 'contracts/source/page-build-spec.schema.json'),
      'utf8'
    )
  );
  outputs.set(
    'data-context-schema.json',
    await readFile(path.join(repoRoot, 'docs/schema-metadata.schema.json'), 'utf8')
  );

  const validFixtureRoot = path.join(repoRoot, 'packages/page/fixtures/contract-valid');
  for (const fileName of (await readdir(validFixtureRoot)).sort()) {
    if (!fileName.endsWith('.json')) continue;
    outputs.set(
      `conformance/page-valid/${fileName}`,
      await readFile(path.join(validFixtureRoot, fileName), 'utf8')
    );
  }

  const missingSchemaVersion = {
    id: 'missing-schema-version',
    dataSources: {},
    sections: []
  };
  outputs.set(
    'conformance/page-invalid/missing-schema-version.json',
    json({
      case: 'missing-schema-version',
      input: missingSchemaVersion,
      expected: validate(missingSchemaVersion)
    })
  );

  const files = [...outputs.entries()]
    .map(([file, content]) => ({ file, sha256: sha256(content) }))
    .sort((left, right) => left.file.localeCompare(right.file));
  outputs.set(
    'manifest.json',
    json({
      contractBundleVersion: '0.1.0',
      pageSchemaVersion: versionPolicy.current,
      source: 'TypeScript/Zod single-way export',
      files
    })
  );
  return outputs;
}

async function writeOutputs(outputs: OutputMap): Promise<void> {
  await rm(generatedRoot, { recursive: true, force: true });
  for (const [relativePath, content] of outputs) {
    const target = path.join(generatedRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  await writeFile(path.join(bundleRoot, 'bundle.lock.json'), await buildBundleLock(outputs), 'utf8');
}

async function buildBundleLock(outputs: OutputMap): Promise<string> {
  const bundle = JSON.parse(await readFile(path.join(bundleRoot, 'bundle.json'), 'utf8')) as {
    bundleVersion: string;
  };
  const artifactPaths = [
    'README.md',
    'SKILL.md',
    'bundle.json',
    'requirements.in',
    'requirements.lock',
    'server.py'
  ];
  for (const directory of [
    'contracts/source',
    'core',
    'fixtures',
    'infrastructure',
    'interfaces',
    'scripts',
    'tests'
  ]) {
    const absoluteDirectory = path.join(bundleRoot, directory);
    try {
      const files = await listFiles(absoluteDirectory);
      artifactPaths.push(
        ...files
          .filter((file) => !file.includes('__pycache__') && !file.endsWith('.pyc'))
          .map((file) => path.posix.join(directory, file))
      );
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw cause;
    }
  }
  const artifacts = await Promise.all(
    artifactPaths.map(async (file) => {
      const content = await readFile(path.join(bundleRoot, file), 'utf8');
      return { file, sha256: sha256(content) };
    })
  );
  const contractManifest = outputs.get('manifest.json');
  if (!contractManifest) throw new Error('contracts manifest was not generated');
  artifacts.push({
    file: 'contracts/generated/manifest.json',
    sha256: sha256(contractManifest)
  });
  return json({
    bundleVersion: bundle.bundleVersion,
    pageSchemaVersion: versionPolicy.current,
    artifacts: artifacts.sort((left, right) => left.file.localeCompare(right.file))
  });
}

async function assertCurrent(outputs: OutputMap): Promise<void> {
  const drift: string[] = [];
  for (const [relativePath, expected] of outputs) {
    const target = path.join(generatedRoot, relativePath);
    let actual: string;
    try {
      actual = await readFile(target, 'utf8');
    } catch {
      drift.push(`${relativePath}: missing`);
      continue;
    }
    if (actual !== expected) drift.push(`${relativePath}: stale`);
  }

  const expectedFiles = new Set(outputs.keys());
  for (const file of await listFiles(generatedRoot)) {
    if (!expectedFiles.has(file)) drift.push(`${file}: unexpected`);
  }
  if (drift.length > 0) {
    throw new Error(`authoring contracts drifted:\n${drift.join('\n')}`);
  }

  const lockPath = path.join(bundleRoot, 'bundle.lock.json');
  const actualLock = await readFile(lockPath, 'utf8');
  const expectedLock = await buildBundleLock(outputs);
  if (actualLock !== expectedLock) throw new Error('bundle.lock.json: stale');
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...(await listFiles(path.join(root, entry.name), relative)));
    else result.push(relative);
  }
  return result.sort();
}

const outputs = await buildOutputs();
if (checkOnly) await assertCurrent(outputs);
else await writeOutputs(outputs);

console.log(
  checkOnly
    ? `authoring contracts current (${outputs.size} files)`
    : `exported authoring contracts (${outputs.size} files)`
);
