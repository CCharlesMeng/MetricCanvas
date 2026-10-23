import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upgradePageDocument } from '../../packages/page/src/upgrade-document';
import { versionPolicy } from '../../packages/page/src/version';

type Options = { input: string; output?: string; target: string };
const usage = 'Usage: node upgrade-page.mjs <page.json> [--out-dir <new-directory>] [--target <current-version>] | --version | --help';
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function options(args: string[]): Options {
  const result: Options = { input: '', target: versionPolicy.current };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--out-dir' || arg === '--target') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw Error(usage);
      const key = arg === '--out-dir' ? 'output' : 'target';
      if (args.indexOf(arg) !== index - 1) throw Error(usage);
      result[key] = value;
    } else {
      if (arg.startsWith('--') || result.input) throw Error(usage);
      result.input = arg;
    }
  }
  if (!result.input) throw Error(usage);
  return result;
}

async function runUpgrade(config: Options): Promise<number> {
  const input = resolve(config.input);
  const bytes = await readFile(input);
  const result = upgradePageDocument(JSON.parse(bytes.toString('utf8')), config.target);
  const { document, ...report } = result.ok ? result : { ...result, document: undefined };
  const receipt = {
    ...report, input, inputSha256: sha256(bytes),
    status: result.ok ? (result.changed ? 'ready' : 'unchanged') : 'blocked',
    ...(config.output && result.ok ? { output: join(resolve(config.output), 'page', `${document!.id}.json`) } : {})
  };
  if (!result.ok) { console.log(json(receipt)); return 1; }
  if (config.output) {
    const destination = resolve(config.output);
    // Exclusive creation protects previous attempts and the input, including symlink aliases.
    await mkdir(destination);
    await mkdir(join(destination, 'original'));
    await mkdir(join(destination, 'page'));
    await writeFile(join(destination, 'original', basename(input)), bytes, { flag: 'wx' });
    await writeFile(join(destination, 'page', `${document!.id}.json`), json(document), { flag: 'wx' });
    await writeFile(join(destination, 'migration.json'), json(receipt), { flag: 'wx' });
  }
  console.log(json(receipt));
  return 0;
}

export async function main(args: string[]): Promise<number> {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return 0; }
  if (args.length === 1 && args[0] === '--version') {
    console.log(json({ schemaVersion: versionPolicy.current, inputVersions: `5.0—5.4, 6.0—${versionPolicy.current}`, mode: 'explicit-authoring-upgrade' }));
    return 0;
  }
  try { return await runUpgrade(options(args)); }
  catch (cause) { console.log(json({ ok: false, status: 'error', message: String(cause) })); return 2; }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await main(process.argv.slice(2));
}
