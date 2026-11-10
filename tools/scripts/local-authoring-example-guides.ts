import { walkDocumentComponents } from '../../packages/page/src/component-walk';
import { digest } from './local-authoring-knowledge-core';

export type ExampleGuideRole = 'purpose' | 'references' | 'boundary' | 'expectations';
export type ExampleGuideLevel = 'structure' | 'browser' | 'export' | 'sim' | 'real-service';
export interface ExampleGuidePassage { start: number; end: number }
export interface ExampleGuideField {
  status: 'provided' | 'not-provided'; summary: string; passages: ExampleGuidePassage[];
}
export interface ExampleGuide {
  id: string; task: string; pageId: string; route: string; title: string; components: string[];
  lifecycle: 'candidate' | 'recommended' | 'historical'; verified: ExampleGuideLevel[];
  verification: {basis: 'author-declared'; current: 'not-assessed'};
  source: {file: string; heading: string; pageSha256: string};
  content: {file: string; sha256: string; bytes: number};
  fields: Record<ExampleGuideRole, ExampleGuideField>;
}
export interface ExampleGuideIndex {
  byPageId: Map<string, ExampleGuide[]>;
  /** Package these local excerpts alongside the knowledge index, without the full README. */
  references: Map<string, string>;
}
interface Section { title: string; text: string }
interface Declaration {
  task: string; page: string; components: string[];
  lifecycle: ExampleGuide['lifecycle']; verified: ExampleGuideLevel[];
}
interface PageIdentity { components: Map<string, number>; sha256: string }
interface GuideDeclaration { file: string; section: Section; entry: Declaration }
const roles: Record<string, ExampleGuideRole> = {
  '复用用途': 'purpose', '参考对象': 'references', '移植边界': 'boundary',
  '可观察预期与环境': 'expectations', '可观察预期': 'expectations'
};
const levels: ExampleGuideLevel[] = ['structure', 'browser', 'export', 'sim', 'real-service'];
const lifecycles = ['candidate', 'recommended', 'historical'];
const marker = /^[ \t]*<!--[ \t]*example-guide:[ \t]*([^\n]*?)-->[ \t]*$/gm;

function nextFence(current: string, line: string): string {
  const delimiter = line.match(/^\s*(`{3,}|~{3,})/);
  if (!delimiter) return current;
  if (!current) return delimiter[1]!;
  return delimiter[1]![0] === current[0] && delimiter[1]!.length >= current.length ? '' : current;
}

function declarationsText(text: string): string {
  let fence = '';
  return text.split('\n').map(line => {
    const previous = fence;
    fence = nextFence(fence, line);
    return previous || fence ? '' : line;
  }).join('\n');
}

function sections(text: string): Section[] {
  const result: Section[] = [];
  let current: Section = {title: '', text: ''}, fence = '';
  for (const line of text.split('\n')) {
    fence = nextFence(fence, line);
    const heading = !fence && line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) { result.push(current); current = {title: heading[1]!, text: ''}; }
    current.text += line + '\n';
  }
  return [...result, current];
}

function identifier(value: string | undefined, name: string): string {
  if (!value || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)) throw new Error(`Invalid example-guide ${name}: ${String(value)}`);
  return value;
}

function list(value: string | undefined): string[] {
  if (value === undefined) return [];
  const values = value.split(',').map(part => part.trim());
  if (values.some(part => !part) || new Set(values).size !== values.length) throw new Error('Invalid example-guide list');
  return values;
}

function declarationFields(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of text.split(';')) {
    const pair = part.trim().match(/^([a-z]+)\s*=\s*([^=]+)$/);
    if (!pair) throw new Error(`Invalid example-guide declaration: ${part}`);
    const key = pair[1]!, value = pair[2]!.trim();
    if (!['task', 'page', 'components', 'lifecycle', 'verified'].includes(key) || result.has(key)) {
      throw new Error(`Unknown or duplicate example-guide declaration: ${key}`);
    }
    result.set(key, value);
  }
  return result;
}

function declaration(text: string): Declaration {
  const fields = declarationFields(text);
  const lifecycle = fields.get('lifecycle') ?? 'candidate';
  const verified = list(fields.get('verified'));
  if (!lifecycles.includes(lifecycle)) throw new Error(`Unknown example-guide lifecycle: ${lifecycle}`);
  if (verified.some(level => !levels.includes(level as ExampleGuideLevel))) throw new Error('Unknown example-guide verified level');
  const components = list(fields.get('components')).map(value => identifier(value, 'component'));
  return {task: identifier(fields.get('task'), 'task'), page: identifier(fields.get('page'), 'page'),
    lifecycle: lifecycle as Declaration['lifecycle'], verified: verified as ExampleGuideLevel[], components};
}

function pageIdentities(pages: Map<string, string>): Map<string, PageIdentity> {
  const result = new Map<string, PageIdentity>();
  for (const content of pages.values()) {
    const page = JSON.parse(content);
    if (typeof page.id !== 'string' || !Array.isArray(page.sections)) continue;
    if (result.has(page.id)) throw new Error(`Duplicate example-guide page: ${page.id}`);
    const components = new Map<string, number>();
    walkDocumentComponents(page, component => {
      if (typeof component.id === 'string') components.set(component.id, (components.get(component.id) ?? 0) + 1);
    });
    result.set(page.id, {components, sha256: digest(content)});
  }
  return result;
}

function assertAssociation(entry: Declaration, section: Section, pages: Map<string, PageIdentity>): void {
  const page = pages.get(entry.page);
  if (!page) throw new Error(`Unknown example-guide page: ${entry.page}`);
  const routes = [...section.text.matchAll(/\/pages\/([a-zA-Z0-9_-]+)/g)].map(match => match[1]);
  if (!routes.includes(entry.page)) throw new Error(`Missing example-guide route: /pages/${entry.page}`);
  for (const component of entry.components) {
    if (!page.components.has(component)) throw new Error(`Unknown example-guide component ${entry.page}: ${component}`);
    if (page.components.get(component) !== 1) throw new Error(`Ambiguous example-guide component ${entry.page}: ${component}`);
  }
}

function summary(text: string): string {
  const plain = text.replace(/\s+/g, ' ').trim();
  return plain.length > 180 ? plain.slice(0, 180) + '…' : plain;
}

/** Preserve the source target as text: repository-relative and localhost links are not install links. */
function distributableText(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, target: string) => `${label}（原入口：\`${target}\`）`);
}

function guideFields(content: string): Record<ExampleGuideRole, ExampleGuideField> {
  const result: Record<ExampleGuideRole, ExampleGuideField> = {
    purpose: {status: 'not-provided', summary: '', passages: []},
    references: {status: 'not-provided', summary: '', passages: []},
    boundary: {status: 'not-provided', summary: '', passages: []},
    expectations: {status: 'not-provided', summary: '', passages: []}
  };
  let active: ExampleGuideRole | undefined;
  for (const paragraph of content.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g)) {
    const match = paragraph[0].match(/^\s*(?:\*\*)?(复用用途|参考对象|移植边界|可观察预期与环境|可观察预期)(?:\*\*)?[：:]\s*([^]*)$/);
    if (match) active = roles[match[1]!];
    if (!active) continue;
    const value = match ? match[2]! : paragraph[0];
    if (!value.trim()) continue;
    const field = result[active];
    field.status = 'provided';
    field.summary = summary([field.summary, value].join(' '));
    field.passages.push({start: paragraph.index!, end: paragraph.index! + paragraph[0].length});
  }
  return result;
}

function buildGuide(file: string, section: Section, entry: Declaration, page: PageIdentity): {guide: ExampleGuide; content: string} {
  const content = distributableText(section.text.replace(marker, '')).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  const reference = `references/example-guides/${entry.page}/${entry.task}.md`;
  const fields = guideFields(content);
  if (entry.lifecycle === 'recommended' && (!entry.verified.length || !entry.components.length || Object.values(fields).some(field => field.status === 'not-provided'))) {
    throw new Error(`Incomplete recommended example-guide: ${entry.page}:${entry.task}`);
  }
  return {content, guide: {id: `guide:${entry.page}:${entry.task}`, task: entry.task, pageId: entry.page,
    route: `/pages/${entry.page}`, title: section.title, components: entry.components,
    lifecycle: entry.lifecycle, verified: entry.verified, verification: {basis: 'author-declared', current: 'not-assessed'},
    source: {file, heading: section.title, pageSha256: page.sha256},
    content: {file: reference, sha256: digest(content), bytes: Buffer.byteLength(content)}, fields}};
}

function sectionDeclarations(file: string, section: Section): GuideDeclaration[] {
  const result: GuideDeclaration[] = [];
  for (const match of declarationsText(section.text).matchAll(marker)) {
    if (!section.title) throw new Error(`example-guide requires a Markdown heading: ${file}`);
    result.push({file, section, entry: declaration(match[1]!)});
  }
  return result;
}

function readmeDeclarations(readmes: Map<string, string>): GuideDeclaration[] {
  const result: GuideDeclaration[] = [], ids = new Set<string>();
  for (const [file, text] of [...readmes].sort(([left], [right]) => left.localeCompare(right))) {
    const visible = declarationsText(text);
    const declared = [...visible.matchAll(/^[ \t]*<!--[ \t]*example-guide\b/gm)].length;
    const parsed = [...visible.matchAll(marker)].length;
    if (declared !== parsed) throw new Error(`Malformed example-guide marker: ${file}`);
    for (const section of sections(text)) {
      for (const declaration of sectionDeclarations(file, section)) {
        const id = `guide:${declaration.entry.page}:${declaration.entry.task}`;
        if (ids.has(id)) throw new Error(`Duplicate example-guide association: ${id}`);
        ids.add(id);
        result.push(declaration);
      }
    }
  }
  return result;
}

/** Discover only explicitly declared pages before loading JSON; this is the same parser as generation. */
export function declaredExampleGuidePages(readmes: Map<string, string>): string[] {
  return [...new Set(readmeDeclarations(readmes).map(declaration => declaration.entry.page))];
}

/** README text remains the sole prose source. Unmarked legacy sections are deliberately ignored. */
export function buildExampleGuides(readmes: Map<string, string>, pages: Map<string, string>): ExampleGuideIndex {
  const index: ExampleGuideIndex = {byPageId: new Map(), references: new Map()};
  const identities = pageIdentities(pages);
  for (const {file, section, entry} of readmeDeclarations(readmes)) {
    assertAssociation(entry, section, identities);
    const {guide, content} = buildGuide(file, section, entry, identities.get(entry.page)!);
    const guides = index.byPageId.get(entry.page) ?? [];
    guides.push(guide);
    index.byPageId.set(entry.page, guides);
    index.references.set(guide.content.file, content);
  }
  return index;
}

/** Each role projects only its original paragraphs; callers can budget/window the returned text. */
export function exampleGuideText(guide: ExampleGuide, role: ExampleGuideRole, content: string): string {
  if (digest(content) !== guide.content.sha256) throw new Error(`Example-guide content mismatch: ${guide.id}`);
  return guide.fields[role].passages.map(range => content.slice(range.start, range.end)).join('\n\n');
}
