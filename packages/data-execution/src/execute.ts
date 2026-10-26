import {requiresQueryContext} from '@metriccanvas/page/internal';
import { resolvePageParams, type PageDocument } from '@metriccanvas/page';
import { createSourceProgram, type SourceUpdate } from './source-program/session';
import { initialFilterValues } from './filter-values';
import { seedPageParamFilters } from './page-params';
import type { RuntimeDataGateway } from './ports';
import { initialQuerySourceIds } from './source-scope';

export interface PageDataExecutor { execute(metadata: PageDocument): Promise<PageDocument>; }
/** One-shot adapter: fresh reads, raw ordinary initial, final combination initial. */
export function createPageDataExecutor(config: { gateway: RuntimeDataGateway;displayInputs?:()=>import('@metriccanvas/page/internal').DisplayInputsSnapshot|undefined;filterRevision?:()=>number;now?:Date }): PageDataExecutor {
  return { async execute(metadata) {
    const resolved = resolvePageParams(metadata);
    if (!resolved.ok) throw new Error(resolved.issues[0].message);
    const page = seedPageParamFilters(resolved.resolvedPage, resolved.effectiveInputs);
    const output = structuredClone(resolved.document);
    for(const source of Object.values(output.dataSources))if(source.source.type==='query'&&requiresQueryContext(source.source.query,page.filters))delete source.source.initial;
    const now=config.now??new Date(),displayInputs=structuredClone(config.displayInputs?.()),filterRevision=config.filterRevision?.()??0;
    const program = createSourceProgram(page, {...config,now,displayInputs:()=>displayInputs,filterRevision:()=>filterRevision??0});
    try {
      for await (const update of program.read({ roots: initialQuerySourceIds(page), conditions: initialFilterValues(page.filters ?? [],now,displayInputs,filterRevision), freshness: 'refresh' })) {
        const source = output.dataSources[update.sourceId].source;
        if(update.candidateRejected&&source.type!=='inline')delete source.initial;
        if (!update.initial) continue;
        captureSourceInitial(source, update.initial);
      }
    } finally { program.dispose(); }
    return output;
  } };
}

function captureSourceInitial(source: PageDocument['dataSources'][string]['source'], initial: NonNullable<SourceUpdate['initial']>): void {
  if (source.type === 'query') source.initial = initial;
  else if (source.type !== 'inline' && 'view' in initial) source.initial = initial;
}
