import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

/** Repository tooling only: relative paths use / on every platform. */
export function pageFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return pageFiles(join(root, entry.name)).map(file => `${entry.name}/${file}`);
    return entry.isFile() && entry.name.endsWith('.json') ? [entry.name] : [];
  }).sort();
}

export function pageFilesById(root) {
  const index = new Map();
  for (const file of pageFiles(root)) {
    const id = basename(file, '.json');
    if (index.has(id)) throw new Error(`重复页面 ID ${id}: ${index.get(id)} / ${join(root, file)}`);
    index.set(id, join(root, file));
  }
  return index;
}
