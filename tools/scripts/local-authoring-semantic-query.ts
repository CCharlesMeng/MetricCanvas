import type { KnowledgePassage, KnowledgeQuery, QueryKnowledge, QueryResult } from './local-authoring-query-types';
import { textWindows } from './local-authoring-text-windows';

/** Offsets address original prose; no second copy of protocol semantics is maintained. */
export function buildPassageIndex(model: QueryKnowledge): KnowledgePassage[] {
  return Object.entries(model.modules).flatMap(([module, value]) => value.semantics.flatMap((text, section) => {
    const title = text.split('\n')[0]!.replace(/^#+\s*/, '');
    return paragraphRanges(text).map(([start, end], index) => ({
      id: `semantic:${module}:${section}:${index}`, module, section, title, start, end
    }));
  }));
}

function paragraphRanges(text: string): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let start = 0;
  for (const match of text.matchAll(/```[\s\S]*?```|\n\s*\n/g)) {
    if (match[0].startsWith('```')) continue;
    const end = match.index + match[0].length;
    if (end > start) result.push([start, end]);
    start = end;
  }
  if (start < text.length) result.push([start, text.length]);
  return result;
}

function passages(model: QueryKnowledge): KnowledgePassage[] {
  return model.passages ?? buildPassageIndex(model);
}

export function findSemantic(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  const modules = exampleModules(model, options.example);
  const terms = (options.query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = passages(model).filter(passage => !options.owner || passage.module.includes(options.owner))
    .filter(passage => modules === undefined || modules.has(passage.module))
    .map(passage => semanticMatch(model, passage, terms)).filter(match => match.matched)
    .sort((left, right) => right.titleScore - left.titleScore || right.score - left.score);
  const sections = new Set<string>();
  const items = matches.flatMap(({passage, preview}) => {
    const section = `semantic:${passage.module}:${passage.section}`;
    if (sections.has(section)) return [];
    sections.add(section);
    return [{id: section, focus: passage.id, owner: passage.module, title: passage.title, preview}];
  });
  return {kind: 'semantic', items, ...(options.example === undefined ? {} : {example: options.example,
    scope: 'modules whose registered examples include this exact file; passages are module-level'})};
}

/** Exact registered file association is a scope, never evidence of passage relevance. */
function exampleModules(model: QueryKnowledge, id: string | undefined): Set<string> | undefined {
  if (id === undefined) return undefined;
  const example = model.examples?.find(entry => entry.id === id);
  if (!example) throw new TypeError(`Unknown example: ${id}`);
  return new Set(Object.entries(model.modules).filter(([, module]) => module.examples.includes(example.file))
    .map(([module]) => module));
}

function semanticMatch(model: QueryKnowledge, passage: KnowledgePassage, terms: string[]) {
  const original = passageText(model, passage);
  const body = original.replace(/^#+[^\n]*(?:\n|$)/, '').trim();
  const searchable = `${passage.title}\n${body}`.toLocaleLowerCase();
  const score = terms.filter(term => body.toLocaleLowerCase().includes(term)).length * 2 + Number(body.length > 0);
  const titleScore = terms.filter(term => passage.title.toLocaleLowerCase().includes(term)).length;
  return {passage, matched: terms.every(term => searchable.includes(term)), score, titleScore,
    preview: [...body].slice(0, 60).join('')};
}

function passageText(model: QueryKnowledge, passage: KnowledgePassage): string {
  const text = model.modules[passage.module]?.semantics[passage.section];
  if (text === undefined) throw new TypeError(`Unknown semantic module: ${passage.module}`);
  return text.slice(passage.start, passage.end);
}

export function showSemantic(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  if (options.owner || options.at || options.branch || options.example !== undefined) throw new TypeError('Semantic show accepts id, select, limit and cursor');
  const selected = semanticSelection(model, options.id ?? '');
  if (!options.select || options.select === 'card') {
    return {id: options.id, kind: 'semantic', available: ['text'], items: selected.map(({id, title}) => ({id, title}))};
  }
  if (options.select !== 'text') throw new TypeError('Semantic select must be card or text');
  return {id: options.id, kind: 'semantic', select: 'text', items: selected.flatMap(passage => textWindows(passageText(model, passage)).map(window => ({
    id: passage.id, ...window
  }))), note: 'Ordered text windows of original prose; consume all continuation pages before treating the selected rule as complete.'};
}

function semanticSelection(model: QueryKnowledge, id: string): KnowledgePassage[] {
  const selected = passages(model).filter(passage => passage.id === id || passage.id.startsWith(id + ':'));
  if (!/^semantic:[^:]+:\d+(?::\d+)?$/.test(id) || !selected.length) throw new TypeError(`Unknown semantic id: ${id}`);
  return selected;
}
