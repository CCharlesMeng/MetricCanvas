import { resolvePageParams, type PageDocument } from '@metriccanvas/page';
import { createSourceProgram } from './source-program/session';
import { initialFilterValues } from './filter-values';
import { seedPageParamFilters } from './page-params';
import type { DataGateway } from './ports';
import { initialQuerySourceIds } from './source-scope';

export interface PageDataExecutor { execute(metadata: PageDocument): Promise<PageDocument>; }
/** One-shot adapter: fresh reads, raw ordinary initial, final combination initial. */
export function createPageDataExecutor(config: { gateway: DataGateway }): PageDataExecutor {
  return { async execute(metadata) {
    const resolved = resolvePageParams(metadata);
    if (!resolved.ok) throw new Error(resolved.issues[0].message);
    const page = seedPageParamFilters(resolved.resolvedPage, resolved.effectiveInputs);
    const output = structuredClone(resolved.document);
    const program = createSourceProgram(page, config);
    try {
      for await (const update of program.read({ roots: initialQuerySourceIds(page), conditions: initialFilterValues(page.filters ?? []), freshness: 'refresh' })) {
        const source = output.dataSources[update.sourceId].source;
        if (!update.initial) continue;
        if (source.type === 'query') source.initial = update.initial;
        else if (source.type === 'pagedJoin' && 'view' in update.initial) source.initial = update.initial;
      }
    } finally { program.dispose(); }
    return output;
  } };
}
