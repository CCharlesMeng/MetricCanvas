/** README content stays text: no HTML execution or natural-language configuration inference. */
export interface GuideBlock { kind: 'heading' | 'text' | 'code'; text: string }

export function guideSection(markdown: string, pageId: string): string {
  const lines = markdown.split('\n');
  const exact = lines.findIndex(line => line.includes(`/pages/${pageId}`) || line.includes(`页面 \`${pageId}\``));
  const hit = exact < 0 ? lines.findIndex(line => line.includes(pageId)) : exact;
  if (hit < 0) return '';
  let start = hit;
  while (start > 0 && !/^#{1,6} /.test(lines[start]!)) start--;
  const level = /^#+/.exec(lines[start]!)?.[0].length ?? 1;
  let end = start + 1;
  while (end < lines.length) {
    const heading = /^#+ /.exec(lines[end]!);
    if (heading && heading[0].trim().length <= level) break;
    end++;
  }
  return lines.slice(start, end).join('\n');
}

export function guideBlocks(markdown: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let code: string[] | undefined;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {
      if (code) { blocks.push({ kind: 'code', text: code.join('\n') }); code = undefined; }
      else code = [];
    } else if (code) code.push(line);
    else if (line.trim()) blocks.push({ kind: /^#+ /.test(line) ? 'heading' : 'text', text: line.replace(/^#+ /, '') });
  }
  if (code) blocks.push({ kind: 'code', text: code.join('\n') });
  return blocks;
}

export interface SourceFact { id: string; kind: string; fields: string[]; conditions: string[]; consumers: string[] }
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

export function documentComponents(value: unknown): RecordValue[] {
  if (Array.isArray(value)) return value.flatMap(documentComponents);
  const item = record(value);
  const own = typeof item.type === 'string' && typeof item.id === 'string' && 'props' in item ? [item] : [];
  return [...own, ...Object.values(item).flatMap(child => typeof child === 'object' && child !== null ? documentComponents(child) : [])];
}

function sourceConsumers(components: RecordValue[], sourceId: string): string[] {
  return components.filter(component => Object.values(record(component.data)).includes(sourceId))
    .map(component => `${component.type} · ${component.id}`);
}

export function sourceFacts(document: unknown): SourceFact[] {
  const root = record(document);
  const components = documentComponents(root);
  return Object.entries(record(root.dataSources)).map(([id, value]) => {
    const source = record(value), definition = record(source.source), query = record(definition.query);
    return { id, kind: String(definition.type ?? '未知'), fields: Object.keys(record(source.fields)),
      conditions: Object.keys(record(query.filterBindings)), consumers: sourceConsumers(components, id) };
  });
}

export function componentConfiguration(document: unknown, focus: string): unknown {
  if (focus === 'iocHeader') return record(document).iocHeader;
  const components = documentComponents(document);
  if (!focus) return document;
  return components.filter(component => component.type === focus);
}

/** Only explicitly isolated learning scenes may project their top-level sections. */
export function isolatedDocument(document: unknown, focus: string): unknown {
  const root = record(document);
  const sections = Array.isArray(root.sections) ? root.sections.map(record) : [];
  const selected = sections.filter(section => documentComponents(section).some(component => component.type === focus));
  if (!focus || !selected.length) return document;
  const ids = new Set(selected.map(section => section.id));
  const anchors = Array.isArray(root.sectionAnchors) ? root.sectionAnchors.filter(anchor => ids.has(record(anchor).sectionId)) : undefined;
  return { ...root, sections: selected, ...(anchors ? { sectionAnchors: anchors } : {}) };
}
