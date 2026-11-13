import {resolveFinalizationDates} from './finalization';
import {requiresQueryContext,hasPeriodQueryDefault} from '@metriccanvas/page/internal';
import { resolvePageParams, type PageDocument } from '@metriccanvas/page';
import { createSourceProgram, type SourceUpdate } from './source-program/session';
import { initialFilterValues } from './filter-values';
import { seedPageParamFilters } from './page-params';
import type { RuntimeDataGateway } from './ports';
import { initialQuerySourceIds } from './source-scope';
import {initialTableViews,remoteHeaderDefaultSources} from './table-defaults';

export interface PageDataExecutor { execute(metadata: PageDocument): Promise<PageDocument>; }
/** One-shot adapter: fresh reads, raw ordinary initial, final combination initial. */
export function createPageDataExecutor(config: { gateway: RuntimeDataGateway;displayInputs?:()=>import('@metriccanvas/page/internal').DisplayInputsSnapshot|undefined;filterRevision?:()=>number;now?:Date }): PageDataExecutor {
  return { async execute(metadata) {
    const resolved = resolvePageParams(metadata);
    if (!resolved.ok) throw new Error(resolved.issues[0].message);
    const page = seedPageParamFilters(resolved.resolvedPage, resolved.effectiveInputs);
    const output = structuredClone(resolved.document);
    for(const source of Object.values(output.dataSources))if(source.source.type==='query'&&(requiresQueryContext(source.source.query,page.filters)||hasPeriodQueryDefault(source.source.query,page)))delete source.source.initial;
    const now=config.now??new Date(),displayInputs=structuredClone(config.displayInputs?.()),filterRevision=config.filterRevision?.()??0;
    const dates=await resolveFinalizationDates(page,config.gateway,now);
    const conditions=initialFilterValues(page.filters ?? [],now,displayInputs,filterRevision,dates);
    const {initialization,filtered}=prepareTableExecution(page,output,{declarations:page.filters??[],filters:conditions,displaySnapshot:displayInputs,filterRevision});
    const program = createSourceProgram(page, {...config,now,displayInputs:()=>displayInputs,filterRevision:()=>filterRevision??0});
    try {
      for await (const update of program.read({ roots: initialQuerySourceIds(page,{declarations:page.filters??[],filters:conditions,displaySnapshot:displayInputs,filterRevision}), conditions, views:initialization.views, selections: {}, freshness: 'refresh' })) {
        const source = output.dataSources[update.sourceId].source;
        if(update.candidateRejected&&source.type!=='inline')delete source.initial;
        if (!capturableInitial(update,filtered,source.type)) continue;
        captureSourceInitial(source, update.initial);
      }
    } finally { program.dispose(); }
    return output;
  } };
}

function prepareTableExecution(page: import('@metriccanvas/page/internal').Page, output: PageDocument, context: import('@metriccanvas/page/internal').ConditionContext) {
  const initialization=initialTableViews(page,context);
  if(initialization.pending.size)throw new Error('表格默认筛选的条件尚未就绪');
  const filtered=remoteHeaderDefaultSources(page);
  for(const id of filtered){const source=output.dataSources[id].source;if(source.type==='query')delete source.initial;}
  return {initialization,filtered};
}
function capturableInitial(update: SourceUpdate, filtered: ReadonlySet<string>, type: string): update is SourceUpdate & {initial:NonNullable<SourceUpdate['initial']>} {
  return !!update.initial && !(filtered.has(update.sourceId) && type==='query');
}

function captureSourceInitial(source: PageDocument['dataSources'][string]['source'], initial: NonNullable<SourceUpdate['initial']>): void {
  if (source.type === 'query') source.initial = initial;
  else if (source.type !== 'inline' && 'view' in initial) source.initial = initial;
}
