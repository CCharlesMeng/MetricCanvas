import { canonicalizeJson, type DisplayInputsSnapshot, type Page } from '@metriccanvas/page/internal';
import { createCandidateValidator } from './candidate-validation';
import { validateCandidatePage } from './column-candidates';
import { composeEffectiveQuery, executeQuery } from './effective-query';
import type { FilterValues } from './filter-values';
import type { FilterCandidatesRequest, FilterCandidatesResult, RuntimeDataGateway } from './ports';
import type { sourceCandidateWindow } from './source-candidate-window';

type Window = NonNullable<ReturnType<typeof sourceCandidateWindow>>;
type Read = NonNullable<FilterCandidatesRequest['sourceRead']>;
type Context = {displayInputs?: DisplayInputsSnapshot; filterRevision?: number; now?: Date};

/** The page-owned gateway keeps the latest successful dependency check for each filter. */
export function createSourceCandidateWindowReader(page:Page) {
  const verified = new Map<string, {key:string|undefined; passed:boolean}>();

  async function verifyDependencies(sourceId:string, input:WindowContext) {
    const {context, conditions, filterId, gateway, signal} = input;
    signal.throwIfAborted();
    const key = verificationKey(context, conditions);
    const previous = verified.get(filterId);
    const receipt = key !== undefined && previous?.key === key ? previous : {key, passed:false};
    if (receipt.passed) return;
    verified.set(filterId, receipt);
    const validator = createCandidateValidator(page, gateway, {...context, displayInputs: () => context.displayInputs, filterRevision: () => context.filterRevision ?? 0});
    await validator.verify(sourceId, conditions, signal);
    signal.throwIfAborted();
    if (key !== undefined) receipt.passed = true;
  }

  return async function readSourceCandidateWindow(definition:Window, filterId:string, read:Read,
    conditions:FilterValues, gateway:RuntimeDataGateway, signal:AbortSignal, context:Context):Promise<FilterCandidatesResult> {
    const input = {page, filterId, conditions, gateway, signal, context};
    await verifyDependencies(definition.sourceId, input);
    if (read.kind === 'page') return readWindow(definition, input, read.offset, definition.limit, read.search);
    return verifySelection(definition, input, read.values);
  };
}

function verificationKey(context:Context, conditions:FilterValues):string|undefined {
  if (context.filterRevision === undefined || !context.now) return;
  return canonicalizeJson([context.filterRevision, context.now.getTime(), context.displayInputs ?? null, Object.fromEntries(conditions)]);
}

type WindowContext = {page:Page; filterId:string; conditions:FilterValues; gateway:RuntimeDataGateway; signal:AbortSignal; context:Context};

async function verifySelection(definition: Window, context: WindowContext, selected: readonly string[]): Promise<FilterCandidatesResult> {
  const values = [...new Set(selected)];
  if (!values.length) return readWindow(definition, context, 0, 1, '', []);
  const candidates = [];
  const size = Math.min(definition.limit, 1000);
  for (let index = 0; index < values.length; index += size) {
    const batch = values.slice(index, index + size);
    const result = await readWindow(definition, context, 0, batch.length, '', batch);
    const allowed = new Set(batch);
    if (result.candidates.some(candidate => !allowed.has(candidate.value)) || result.totalCount > batch.length) failWindow();
    candidates.push(...result.candidates);
  }
  return {kind:'values', candidates};
}

async function readWindow(definition: Window, input: WindowContext, offset: number, limit: number, search: string, selected?: string[]) {
  if (!Number.isSafeInteger(offset) || offset < 0) failWindow();
  const {page, filterId, conditions, gateway, signal, context} = input;
  const {source, sourceId, field} = definition;
  const query = composeEffectiveQuery({...context, page, filters:page.filters, dataSource:source}, conditions, 0, [],
    selected?.length ? {[field]:{mode:'select',values:selected}} : {}, search.trim() ? {fields:[field], query:search} : undefined);
  query.pagination = {offset, limit};
  const snapshot = await executeQuery(query, gateway, {
    pageId:page.id, dataSourceIds:[sourceId],
    sourceCandidates:{filterId, reason:'declared-query-window', kind:selected ? 'selection' : 'page', offset, limit}
  }, signal);
  signal.throwIfAborted();
  if (snapshot.status === 'error') throw Object.assign(new Error(snapshot.error.message), snapshot.error);
  if (snapshot.status !== 'ready' && snapshot.status !== 'empty') failWindow();
  const rows = snapshot.status === 'ready' ? snapshot.rows : [];
  const candidates = rows.map(row => {
    const value = row[field];
    if (typeof value !== 'string' || !value) failWindow();
    return {value, label:value};
  });
  const totalCount = snapshot.totalCount;
  if (totalCount === undefined) failWindow();
  validateCandidatePage({kind:'values', candidates, totalCount}, offset, limit);
  return {kind:'values' as const, candidates, totalCount};
}

function failWindow(): never {
  throw Object.assign(new Error('分页筛选候选值未通过结果契约校验'), {code:'DQE_ROW_CONTRACT_ERROR'});
}
