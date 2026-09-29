import {constants, copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {composeDeployment} from './compose-deployment.mjs';

/** Run from a downloaded release; no repository, package manager or build runtime required. */
export function packDeployment({platform, adapter, output}) {
  const directory = resolve(output);
  const archive = `${directory}.tar.gz`, checksum = `${archive}.sha256`;
  if (existsSync(archive) || existsSync(checksum)) throw Error('Deployment archive and checksum must not already exist.');
  const manifest = composeDeployment({platform, adapter, output: directory});
  const temporary = mkdtempSync(join(tmpdir(), 'metriccanvas-pack-'));
  try {
    const packed = join(temporary, 'deployment.tar.gz');
    execFileSync('tar', ['-czf', packed, '-C', directory, '.']);
    const sha256 = createHash('sha256').update(readFileSync(packed)).digest('hex');
    copyFileSync(packed, archive, constants.COPYFILE_EXCL);
    writeFileSync(checksum, `${sha256}  ${basename(archive)}\n`, {flag: 'wx'});
    return {output: directory, archive, checksum, sha256, version: manifest.version, deployment: manifest.deployment};
  } finally {
    rmSync(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [platform, adapter, output, ...extra] = process.argv.slice(2);
  if (!platform || !adapter || !output || extra.length) throw Error('Usage: node pack-deployment.mjs PLATFORM_DIR ADAPTER_JS OUTPUT_DIR');
  console.log(JSON.stringify(packDeployment({platform, adapter, output}), null, 2));
}
