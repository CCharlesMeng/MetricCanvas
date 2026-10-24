import { normalizePageDocument } from '../../packages/page/src/validate';
import { versionPolicy, requiredMinorVersion, pageCapabilities } from '../../packages/page/src/version';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { localPageReference, referenceProjection } from './local-authoring-projection';
import { localAuthoringKnowledge } from './local-authoring-knowledge';
import { knowledgeSelection, type AuthoringKnowledge } from './local-authoring-knowledge-core';

type Outputs = Map<string, string>;
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

/** Both consumers use the product reference, never an installed Skill directory. */
export async function addMcKnowledge(root: string, outputs: Outputs, product: Outputs, raw: any): Promise<void> {
  const reference = localPageReference(referenceProjection(product));
  for (const [file, text] of reference) outputs.set(`references/page-metadata/${file}`, text);
  const knowledge = await localAuthoringKnowledge(root, reference);
  for (const [file, text] of knowledge) outputs.set(file, text);
  for (const scene of ['business-report', 'usage-report']) {
    const page = JSON.parse(await readFile(path.join(root, `pages/capabilities/layout/mc-layout-${scene}.json`), 'utf8'));
    const parsed = normalizePageDocument({...page, schemaVersion: versionPolicy.current});
    if (!parsed.ok) throw new Error(`Invalid scene example: ${scene}`);
    outputs.set(`examples/${scene}.json`, json(parsed.document));
  }
  const model = JSON.parse(knowledge.get('references/authoring-knowledge/model.json')!) as AuthoringKnowledge;
  for (const [id, topic] of Object.entries(model.topics)) {
    outputs.set(`knowledge/${id}.json`, json(knowledgeSelection(model, [id])));
  }
  for (const entry of raw.componentCatalog) {
    const id = entry.type;
    const topic = `${id}.overview`;
    if (!model.topics[topic]) throw new Error(`Component knowledge missing: ${id}`);
    outputs.set(`components/${id}.json`, json({ ...entry, renderable: true,
      ...raw.authoringCapabilities[id], knowledge: topic, reference: model.modules[topic.slice(0, -9)].file,
      versionPolicy: 'protocol/version-policy', currentWriter: model.schemaVersion,
      exampleVersionRequirements: model.modules[id].examples.map(file => exampleVersion(outputs, file)),
      note: 'Renderable, assembled and data_editable are independent. Product capability floors are checked by inspect_schema.' }));
  }
}

/** Independent denominator: the maintained product map, not generated output keys. */
export async function knowledgeDenominator(root: string): Promise<any> {
  return JSON.parse(await readFile(path.join(root, 'docs/page-metadata/reference-map.json'), 'utf8'));
}

function exampleVersion(outputs: Outputs, file: string): object {
  const document = JSON.parse(outputs.get(file)!);
  return {file, requiredVersion: `${versionPolicy.major}.${requiredMinorVersion(document)}`,
    capabilities: Object.entries(pageCapabilities).filter(([, capability]) => capability.usedAt(document).length)
      .map(([id, capability]) => ({id, minor: capability.minor, description: capability.description})),
    scope: 'complete example; actual used fields determine the floor, independently of readableVersions'};
}
