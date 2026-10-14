import {mkdir, readFile, writeFile, chmod} from 'node:fs/promises';
import {basename, join, resolve} from 'node:path';
import {createHash} from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestName = 'snapshot-manifest.txt';
try {
  const args = process.argv.slice(2);
  if (args[0] === '--check' && args.length === 2) {
    const folder = resolve(args[1]);
    const manifest = JSON.parse(await readFile(join(folder, manifestName), 'utf8'));
    if (manifest.file !== basename(manifest.file)) throw new Error('Invalid snapshot filename');
    const actual = digest(await readFile(join(folder, manifest.file)));
    if (actual !== manifest.sha256) throw new Error('Snapshot bytes changed after capture');
    console.log(JSON.stringify({ok: true, folder, file: manifest.file, sha256: actual}));
  } else if (args.length === 2 && !args[0].startsWith('--')) {
    const source = resolve(args[0]), folder = resolve(args[1]);
    const bytes = await readFile(source);
    if (!source.endsWith('.json')) throw new Error('Snapshot source must be a JSON page file');
    // The caller creates the output parent. A snapshot directory is one attempt,
    // never a reusable generation workspace; mkdir rejects every repeated name.
    await mkdir(folder);
    const target = join(folder, basename(source));
    await writeFile(target, bytes, {flag: 'wx'});
    await writeFile(join(folder, manifestName), JSON.stringify({file: basename(source), sha256: digest(bytes)}, null, 2) + '\n', {flag: 'wx'});
    await chmod(target, 0o444);
    await chmod(join(folder, manifestName), 0o444);
    console.log(JSON.stringify({ok: true, folder, file: target, sha256: digest(bytes)}));
  } else {
    throw new Error('Usage: node snapshot-attempt.mjs <page.json> <new-attempt-dir> | --check <attempt-dir>');
  }
} catch (error) {
  console.error(JSON.stringify({ok: false, message: String(error)}));
  process.exitCode = 1;
}
