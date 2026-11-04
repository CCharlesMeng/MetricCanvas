import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {authoringPageProgramOutputs} from './build-authoring-page-program';

/** Publish-side only; the target needs neither this source nor a package build. */
export async function exportRelayReference(root: string, output: string, releaseVersion: string, modules: string[] = ['metriccanvas_authoring.data.product_operations', 'metriccanvas_authoring.pages.product_operations', 'metriccanvas_authoring.work.product_operations'], interfaceVersion = '1.0.0'): Promise<void> {
  const staging = await mkdtemp(path.join(tmpdir(), 'mc-authoring-node-'));
  try {
    for (const [file, text] of await authoringPageProgramOutputs(root)) {
      const target = path.join(staging, file);
      await mkdir(path.dirname(target), {recursive: true});
      await writeFile(target, text);
    }
    const args = ['-B', path.join(root, 'tools/relay-reference/export.py'), '--root', root,
      '--output', path.resolve(output), '--release-version', releaseVersion, '--node-bundle', staging,
      '--interface-version', interfaceVersion];
    for (const module of modules) args.push('--python-operations', module);
    process.stdout.write(execFileSync(process.env.METRICCANVAS_PYTHON ?? 'python3', args,
      {encoding: 'utf8', env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'}}));
  } finally {
    await rm(staging, {recursive: true, force: true});
  }
}
