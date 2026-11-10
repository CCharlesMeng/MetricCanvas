import { exampleGuideText, type ExampleGuide, type ExampleGuideRole } from './local-authoring-example-guides';
import { textWindows } from './local-authoring-text-windows';
import type { KnowledgeExample, KnowledgeQuery, QueryKnowledge, QueryResult } from './local-authoring-query-types';

const roles: ExampleGuideRole[] = ['purpose', 'references', 'boundary', 'expectations'];

function assertGuideOptions(options: KnowledgeQuery, command: 'find' | 'show'): void {
  const shared = ['kind', 'limit', 'cursor'];
  const allowed = command === 'find' ? [...shared, 'owner', 'query'] : [...shared, 'id', 'select'];
  const unsupported = Object.keys(options).filter(key => options[key as keyof KnowledgeQuery] !== undefined && !allowed.includes(key));
  if (unsupported.length) throw new TypeError(`Unsupported guide ${command} option: ${unsupported.join(', ')}`);
  if (options.kind !== undefined && options.kind !== 'guide') throw new TypeError('Guide queries require kind guide');
}

/** Cards expose declarations and stable task identities, never the original prose. */
export function guideCard(guide: ExampleGuide): QueryResult {
  return {id: guide.id, kind: 'guide', title: guide.title, pageId: guide.pageId,
    lifecycle: guide.lifecycle, verified: guide.verified, verification: guide.verification};
}

function matchesGuide(example: KnowledgeExample, guide: ExampleGuide, options: KnowledgeQuery): boolean {
  if (options.owner && !example.objects.some(object => guide.components.includes(object.id) && object.type === options.owner)) return false;
  const searchable = [guide.id, guide.title, guide.pageId, ...guide.components,
    ...Object.values(guide.fields).map(field => field.summary)].join(' ').toLocaleLowerCase();
  return (options.query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean).every(term => searchable.includes(term));
}

export function findGuides(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  assertGuideOptions(options, 'find');
  const items = (model.examples ?? []).flatMap(example => (example.guides ?? [])
    .filter(guide => matchesGuide(example, guide, options)).map(guideCard));
  return {kind: 'guide', items};
}

function selectedGuide(model: QueryKnowledge, id: string | undefined): ExampleGuide {
  const guide = (model.examples ?? []).flatMap(example => example.guides ?? []).find(guide => guide.id === id);
  if (!guide) throw new TypeError(`Unknown guide: ${String(id)}`);
  return guide;
}

/** The reader supplies the packaged local excerpt; each role retains its complete original prose. */
export function showGuide(model: QueryKnowledge, options: KnowledgeQuery, read: (guide: ExampleGuide) => string): QueryResult {
  assertGuideOptions(options, 'show');
  const guide = selectedGuide(model, options.id), select = options.select ?? 'card';
  if (select === 'card') return {...guideCard(guide), available: roles,
    fields: Object.fromEntries(roles.map(role => [role, guide.fields[role].status]))};
  if (!roles.includes(select as ExampleGuideRole)) throw new TypeError(`Unknown guide selection: ${select}`);
  const role = select as ExampleGuideRole, field = guide.fields[role];
  const metadata = {...guideCard(guide), select, source: guide.source, status: field.status,
    scope: 'Author guidance for this example; protocol rules and target-page applicability require separate checks.'};
  if (field.status === 'not-provided') return {...metadata, complete: false, items: []};
  return {...metadata, items: textWindows(exampleGuideText(guide, role, read(guide))),
    note: 'Read all ordered windows and continuation pages to reconstruct the selected author guidance.'};
}
