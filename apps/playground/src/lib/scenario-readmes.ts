import { guideSection, guideBlocks } from './scenario-guide';
import type { PlaygroundPageEntry } from './page-entry';

const readmes = import.meta.glob<string>('$pages/**/README.md', { query: '?raw', import: 'default' });

export async function readScenarioGuide(entry: PlaygroundPageEntry) {
  const directory = entry.filePath?.split('/').slice(0, -1).join('/');
  const suffix = `/pages/${directory}/README.md`;
  const path = Object.keys(readmes).find(key => key.endsWith(suffix));
  if (!path) return [];
  return guideBlocks(guideSection(await readmes[path]!(), entry.id));
}
