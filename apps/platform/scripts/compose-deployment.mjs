import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync} from 'node:fs';
import {resolve, relative, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const hash = data => createHash('sha256').update(data).digest('hex');
const inside = (parent, child) => child === parent || child.startsWith(parent + sep);
/** Compose an independently built deployment adapter with an immutable platform release. */
export function composeDeployment({platform, adapter, output}) {
  const source = resolve(platform), script = resolve(adapter), target = resolve(output);
  if (existsSync(target)) throw Error('Deployment output must not already exist.');
  if (inside(source, target) || inside(target, source) || inside(target, script)) throw Error('Deployment output must be separate from its inputs.');
  const raw = readFileSync(resolve(source, 'release.json'));
  const release = JSON.parse(raw);
  if (release.deployment) throw Error('Compose from an original platform release, not an existing deployment.');
  if (release.deploymentContractVersion !== '1') throw Error('Unsupported deployment contract version.');
  for (const [name, expected] of Object.entries(release.files)) {
    const path = resolve(source, name);
    if (!inside(source, path) || hash(readFileSync(path)) !== expected) throw Error('Platform release integrity check failed.');
  }
  const marker = '<script src="./assets/platform.umd.js"></script>';
  const html = readFileSync(resolve(source, 'index.html'), 'utf8');
  if (html.split(marker).length !== 2) throw Error('Unrecognized platform HTML entry.');
  const adapterBytes = readFileSync(script);
  if (!adapterBytes.length) throw Error('Deployment adapter is empty.');
  cpSync(source, target, {recursive: true});
  mkdirSync(resolve(target, 'deployment'));
  writeFileSync(resolve(target, 'deployment/adapter.js'), adapterBytes);
  writeFileSync(resolve(target, 'index.html'), html.replace(marker, '<script src="./deployment/adapter.js"></script>' + marker));
  const walk = dir => readdirSync(dir).sort().flatMap(name => {
    const path = resolve(dir, name);return statSync(path).isDirectory() ? walk(path) : [path];
  });
  // Keep original resource provenance, but update hashes to describe the composed directory.
  const manifest = {...release, deployment: {
    contractVersion: '1', baseReleaseSha256: hash(raw), adapterSha256: hash(adapterBytes),
    baseFiles: release.files, targetPortal: 'NOT_RUN'
  }, files: Object.fromEntries(walk(target).filter(p => p !== resolve(target, 'release.json'))
    .map(p => [relative(target, p).split(sep).join('/'), hash(readFileSync(p))]))};
  writeFileSync(resolve(target, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [platform, adapter, output] = process.argv.slice(2);
  if (!platform || !adapter || !output) throw Error('Usage: node compose-deployment.mjs PLATFORM_DIR ADAPTER_JS OUTPUT_DIR');
  const manifest = composeDeployment({platform, adapter, output});
  console.log(JSON.stringify({output: resolve(output), version: manifest.version, ...manifest.deployment}, null, 2));
}
