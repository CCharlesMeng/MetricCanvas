import { readFileSync } from 'node:fs';
import { normalizePageDocument, versionPolicy } from '@metriccanvas/page';
import type { Component } from '@metriccanvas/page/internal';
import type { PageDocument } from '@metriccanvas/page';
import { responsiveFixtures } from '../../../engine/widgets/tests/responsive-fixtures';

const examples = new URL('../../../../contracts/metriccanvas/page/reference/examples/', import.meta.url);

/** Public contract examples supply all schema branches; no business attachment is checked in. */
export function presentationFixtures(): Array<{ name: string; document: PageDocument }> {
  return Object.entries(responsiveFixtures).flatMap(([type, { variants }]) => variants.map(variant => {
    const name = `${type}${variant === 'default' ? '' : `-${variant}`}`;
    const document = JSON.parse(readFileSync(new URL(`component-${name}.json`, examples), 'utf8'));
    for (const source of Object.values(document.dataSources) as Array<any>) {
      if (source.source.type !== 'query') continue;
      if (!source.source.initial) source.source.initial = {
        capturedAt: '2026-10-08T00:00:00Z',
        rows: [Object.fromEntries(Object.entries(source.fields).map(([id, field]: [string, any]) =>
          [field.queryField ?? id, field.type === 'number' ? 65 : field.type === 'boolean' ? true : field.type === 'date' ? '2026-01-01' : '北京']))]
      };
      source.source.initial.totalCount = source.source.initial.rows.length;
    }
    const normalized = normalizePageDocument(document);
    if (!normalized.ok) throw new Error(`${name}: ${JSON.stringify(normalized.errors)}`);
    return { name, document: normalized.document };
  }));
}

export function configuredTitles(component: Component): string[] {
  const titles: string[] = typeof component.props.title === 'string' ? [component.props.title] : [];
  if (component.type === 'compositeCard') titles.push(...component.props.components.flatMap(configuredTitles));
  if (component.type === 'tabContainer') {
    const active = component.props.tabs.find(tab => tab.id === component.props.defaultTab) ?? component.props.tabs[0]!;
    titles.push(...('components' in active ? active.components : [active.component]).flatMap(configuredTitles));
  }
  return titles;
}

export function drawingCount(component: Component): number {
  if (['barChart', 'lineChart', 'pieChart', 'mapChart'].includes(component.type)) return 1;
  if (component.type === 'metricCard') return component.props.progress ? 1 : 0;
  if (component.type === 'compositeCard') return component.props.components.reduce((count, child) => count + drawingCount(child), 0);
  return 0;
}

export function scalarPage(components: Component[], filters?: PageDocument['filters']): PageDocument {
  const normalized = normalizePageDocument({ schemaVersion: versionPolicy.current, layout: 'report', id: 'presentation-regression',
    dataSources: { values: { fields: {
      amount: { type: 'number', role: 'measure' }, name: { type: 'string', role: 'dimension' }
    }, source: { type: 'inline', rows: [{ amount: 65, name: '配置取值' }] } } },
    filters, sections: [{ id: 'main', container: 'card', components }] });
  if (!normalized.ok) throw new Error(JSON.stringify(normalized.errors));
  return normalized.document;
}
