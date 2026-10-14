import { resolvePageParams, type PageDocument } from '@metriccanvas/page';
import {
  declaredPaginationLimit, flattenPageComponents, queryResultDependencies,
  type DataSnapshot, type DataSource, type QueryDataSource
} from '@metriccanvas/page/internal';
import { composeEffectiveQuery, executeQuery } from './effective-query';
import { initialFilterValues } from './filter-values';
import { seedPageParamFilters } from './page-params';
import type { DataGateway } from './ports';
import { resolveQueryResultInputs } from './query-result-inputs';
import { queryRowsFromPageRows } from './query-rows';
import { rawSnapshot } from './snapshots';
import { initialQuerySourceIds } from './source-scope';

export interface PageDataExecutor {
  execute(metadata: PageDocument): Promise<PageDocument>;
}

/** One-shot execution always fetches fresh data, while source failures preserve input initial. */
export function createPageDataExecutor(config: { gateway: DataGateway }): PageDataExecutor {
  return {
    async execute(metadata) {
      const resolved = resolvePageParams(metadata);
      if (!resolved.ok) throw new Error(resolved.issues[0].message);
      const page = seedPageParamFilters(resolved.resolvedPage, resolved.effectiveInputs);
      const output = structuredClone(resolved.document);
      const now = new Date();
      const capturedAt = now.toISOString();
      const filters = initialFilterValues(page.filters ?? [], now);
      const sources = new Map<string, DataSource>(Object.entries(page.dataSources));
      const raw = new Map<string, DataSnapshot>();
      const requests = new Map<string, Promise<DataSnapshot>>();
      const pending = new Set(initialQuerySourceIds(page));
      for (const [id, source] of sources) {
        if (source.source.type === 'inline') raw.set(id, rawSnapshot(source.source.rows));
        else if (!pending.has(id)) raw.set(id, { status: 'error', error: { code: 'UNKNOWN', message: '查询需要点击上下文' } });
      }
      const paged = new Set(flattenPageComponents({
        sections: page.sections, detailViews: page.detailViews?.filter(view => view.mode === 'snapshot')
      }).flatMap(component => component.type === 'table' && component.props.pagination?.mode === 'query'
        ? [component.data.main] : []));

      async function fetchSource(id: string): Promise<void> {
        const source = sources.get(id)!;
        if (!isQuerySource(source)) return;
        const input = resolveQueryResultInputs(source, raw, sources);
        if (input.status === 'waiting') throw new Error('页面查询依赖未就绪');
        let snapshot: DataSnapshot;
        if (input.status === 'terminal') snapshot = input.snapshot;
        else {
          const limit = paged.has(id) ? declaredPaginationLimit(source.source.query) : undefined;
          const query = composeEffectiveQuery({ dataSource: source, ...(limit ? { pagination: { limit } } : {}) }, filters, 0, [], {});
          query.filterValues.push(...input.values);
          const key = JSON.stringify(query);
          let request = requests.get(key);
          if (!request) {
            request = executeQuery(query, config.gateway, { pageId: page.id, dataSourceIds: [id] });
            requests.set(key, request);
          }
          snapshot = await request;
        }
        if (snapshot.status === 'ready' || snapshot.status === 'empty') {
          try {
            const rows = snapshot.status === 'ready' ? snapshot.rows : [];
            const limit = declaredPaginationLimit(source.source.query);
            if ((snapshot.totalCount !== undefined && (!Number.isSafeInteger(snapshot.totalCount) || snapshot.totalCount < rows.length)) ||
                (source.source.resultScope === 'complete' && snapshot.totalCount !== undefined && snapshot.totalCount !== rows.length) ||
                (limit !== undefined && rows.length > limit)) throw new Error('查询结果不符合声明范围');
            const serialized = queryRowsFromPageRows(rows, source.fields);
            const target = output.dataSources[id].source;
            if (target.type === 'query') target.initial = {
              capturedAt, rows: serialized,
              ...(snapshot.totalCount === undefined ? {} : { totalCount: snapshot.totalCount })
            };
          } catch {
            snapshot = { status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR', message: '查询结果不符合字段或范围契约' } };
          }
        }
        // Retained output initial never enters this execution's dependency graph.
        raw.set(id, snapshot);
      }

      while (pending.size) {
        const ready = [...pending].filter(id => queryResultDependencies(sources.get(id)).every(dependency => raw.has(dependency)));
        if (!ready.length) throw new Error('页面查询依赖无法执行');
        for (let offset = 0; offset < ready.length; offset += 5) {
          await Promise.all(ready.slice(offset, offset + 5).map(fetchSource));
        }
        ready.forEach(id => pending.delete(id));
      }
      return output;
    }
  };
}

function isQuerySource(source: DataSource): source is QueryDataSource {
  return source.source.type === 'query';
}
