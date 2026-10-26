import { flattenPageComponents, hasColumnConditions, type ConditionContext, type Page } from '@metriccanvas/page/internal';
import { tableColumnPresentation } from './column-presentation';
import type { TableSession } from './session';
/** Reconcile source-owned sessions before the orchestrator captures any effective query. */
export function reconcileTableSources(page: Page, sessions: ReadonlyMap<string, TableSession>, context: ConditionContext): Set<string> {
    const changed = new Set<string>();
    for (const table of flattenPageComponents(page)) {
        if (table.type !== 'table' || !hasColumnConditions(table.props.columns))
            continue;
        const source = page.dataSources[table.data.main]?.source;
        if (source?.type === 'inline' || source?.type === 'query' && source.resultScope === 'complete')
            continue;
        const columns = tableColumnPresentation(page, table, context);
        if (sessions.get(table.data.main)?.reconcileColumns(columns, false))
            changed.add(table.data.main);
    }
    return changed;
}
