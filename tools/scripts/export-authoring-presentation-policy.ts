/** One product policy text for OutputMap generation and Python distribution resources. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalizeJson } from '../../packages/page/src/canonical-json';

export async function authoringPresentationPolicy(root: string): Promise<string> {
  const source = path.join(root, 'metriccanvas-authoring/core/presentation/policy.json');
  return canonicalizeJson(JSON.parse(await readFile(source, 'utf8'))) + '\n';
}

export async function exportAuthoringPresentationPolicy(root: string, target = path.join(root, 'metriccanvas-authoring/contracts/exported/authoring-presentation-policy.json')) {
  const content = await authoringPresentationPolicy(root);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}
