/** Offline resolution for the public contracts' URI refs. No network fetch is needed. */
export function schemaCatalog(outputs: Map<string, string>): object {
  const ids: Record<string, string> = {};
  for (const [file, text] of outputs) {
    if (!file.endsWith('.json')) continue;
    const value = JSON.parse(text);
    if (typeof value.$id === 'string') ids[value.$id] ??= file;
  }
  for (const [file, text] of outputs) {
    if (!file.startsWith('authoring-contracts/') || !file.endsWith('.schema.json')) continue;
    for (const reference of references(JSON.parse(text))) {
      if (!reference.startsWith('#') && !ids[reference.split('#')[0]]) throw new Error(`MC schema reference not installed: ${file} -> ${reference}`);
    }
  }
  return {scope: 'URI references resolve to installed resources; source manifests describe product provenance', ids};
}

function references(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(references);
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [...(typeof node.$ref === 'string' ? [node.$ref] : []), ...Object.values(node).flatMap(references)];
}
