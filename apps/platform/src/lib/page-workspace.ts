import type {
  CatalogSnapshot,
  Component,
  Page,
  StructuredQuery,
  TableColumnNode
} from '@metriccanvas/page';
import {
  editComponent,
  type ComponentEdit,
  type ComponentLocator
} from './page-editor';

export interface PageWorkspace {
  baseRevisionId: string | null;
  revisionNumber: number | null;
  baseDocument: Page;
  past: Page[];
  current: Page;
  future: Page[];
  selected: ComponentLocator | null;
  lastMutation: 'manual' | 'agent' | null;
}

export interface MetricCardInsertion {
  kind: 'metric_card';
  componentId: string;
  title: string;
  metricCode: string;
  span: number;
}

export type DimensionedVisualizationKind =
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'ranking_card'
  | 'table';

export interface DimensionedVisualizationInsertion {
  kind: DimensionedVisualizationKind;
  componentId: string;
  title: string;
  metricCode: string;
  dimensionCode: string;
  span: number;
}

export type BoundComponentInsertion =
  | MetricCardInsertion
  | DimensionedVisualizationInsertion;

export type BoundDataSourceSelection =
  | {
      mode: 'create_query';
      dataSourceId: string;
      aggregation: string;
    }
  | {
      mode: 'reuse';
      dataSourceId: string;
    };

const DOCUMENT_ID = /^[a-z0-9][a-z0-9-]*$/u;

export type PageWorkspaceCommand =
  | { type: 'select_component'; locator: ComponentLocator | null }
  | { type: 'edit_component'; locator: ComponentLocator; edit: ComponentEdit }
  | {
      type: 'move_component';
      locator: ComponentLocator;
      before: ComponentLocator;
    }
  | {
      type: 'edit_query_data_source';
      dataSourceId: string;
      query: StructuredQuery;
      catalog: CatalogSnapshot;
    }
  | {
      type: 'insert_bound_component';
      component: BoundComponentInsertion;
      placement: { sectionId: string; afterComponentId?: string };
      dataSource: BoundDataSourceSelection;
      catalog: CatalogSnapshot;
    }
  | { type: 'remove_component'; locator: ComponentLocator }
  | { type: 'apply_agent_document'; document: Page }
  | { type: 'undo' }
  | { type: 'redo' }
  | {
      type: 'mark_saved';
      revisionId: string;
      revisionNumber: number;
      document: Page;
    };

export function createPageWorkspace(input: {
  document: Page;
  baseRevisionId: string | null;
  revisionNumber: number | null;
}): PageWorkspace {
  const document = clonePage(input.document);
  return {
    baseRevisionId: input.baseRevisionId,
    revisionNumber: input.revisionNumber,
    baseDocument: document,
    past: [],
    current: clonePage(document),
    future: [],
    selected: null,
    lastMutation: null
  };
}

export function reducePageWorkspace(
  workspace: PageWorkspace,
  command: PageWorkspaceCommand
): PageWorkspace {
  if (command.type === 'select_component') {
    return {
      ...workspace,
      selected:
        command.locator && locateComponent(workspace.current, command.locator)
          ? { ...command.locator }
          : null
    };
  }

  if (command.type === 'undo') {
    const previous = workspace.past.at(-1);
    if (!previous) return workspace;
    return {
      ...workspace,
      past: workspace.past.slice(0, -1),
      current: clonePage(previous),
      future: [clonePage(workspace.current), ...workspace.future],
      selected: retainSelection(previous, workspace.selected)
    };
  }

  if (command.type === 'redo') {
    const next = workspace.future[0];
    if (!next) return workspace;
    return {
      ...workspace,
      past: [...workspace.past, clonePage(workspace.current)],
      current: clonePage(next),
      future: workspace.future.slice(1),
      selected: retainSelection(next, workspace.selected)
    };
  }

  if (command.type === 'mark_saved') {
    const document = clonePage(command.document);
    return {
      ...workspace,
      baseRevisionId: command.revisionId,
      revisionNumber: command.revisionNumber,
      baseDocument: document,
      past: [],
      current: clonePage(document),
      future: [],
      selected: retainSelection(document, workspace.selected),
      lastMutation: null
    };
  }

  let next: Page;
  let mutation: 'manual' | 'agent';
  if (command.type === 'edit_component') {
    next = editComponent(workspace.current, command.locator, command.edit);
    mutation = 'manual';
  } else if (command.type === 'move_component') {
    next = moveComponentBefore(
      workspace.current,
      command.locator,
      command.before
    );
    mutation = 'manual';
  } else if (command.type === 'edit_query_data_source') {
    next = editQueryDataSource(
      workspace.current,
      command.dataSourceId,
      command.query,
      command.catalog
    );
    mutation = 'manual';
  } else if (command.type === 'insert_bound_component') {
    next = insertBoundComponent(workspace.current, command);
    mutation = 'manual';
  } else if (command.type === 'remove_component') {
    next = removeComponent(workspace.current, command.locator);
    mutation = 'manual';
  } else {
    next = clonePage(command.document);
    mutation = 'agent';
  }
  if (next.id !== workspace.current.id || equalPage(next, workspace.current)) {
    return workspace;
  }
  return {
    ...workspace,
    past: [...workspace.past.slice(-99), clonePage(workspace.current)],
    current: clonePage(next),
    future: [],
    selected: retainSelection(next, workspace.selected),
    lastMutation: mutation
  };
}

function removeComponent(document: Page, locator: ComponentLocator): Page {
  const section = document.sections.find(
    (candidate) => candidate.id === locator.sectionId
  );
  const component = section?.components.find(
    (candidate) => candidate.id === locator.componentId
  );
  if (!section || !component) return document;

  const next = clonePage(document);
  const targetSection = next.sections.find(
    (candidate) => candidate.id === locator.sectionId
  )!;
  targetSection.components = targetSection.components.filter(
    (candidate) => candidate.id !== locator.componentId
  );

  const removedSourceIds = new Set(Object.values(component.data ?? {}));
  const retainedSourceIds = new Set(
    next.sections.flatMap((candidate) =>
      candidate.components.flatMap((item) => Object.values(item.data ?? {}))
    )
  );
  for (const dataSourceId of removedSourceIds) {
    if (!retainedSourceIds.has(dataSourceId)) {
      delete next.dataSources[dataSourceId];
    }
  }
  return next;
}

function insertBoundComponent(
  document: Page,
  command: Extract<PageWorkspaceCommand, { type: 'insert_bound_component' }>
): Page {
  const section = document.sections.find(
    (candidate) => candidate.id === command.placement.sectionId
  );
  const metric = command.catalog.metrics.find(
    (candidate) => candidate.code === command.component.metricCode
  );
  const dimensionCode =
    command.component.kind === 'metric_card'
      ? null
      : command.component.dimensionCode;
  const dimension = dimensionCode
    ? command.catalog.dimensions.find(
        (candidate) => candidate.code === dimensionCode
      ) ?? null
    : null;
  if (
    !section ||
    !metric ||
    (command.component.kind !== 'metric_card' &&
      (!dimension || !metric.availableDimensions.includes(dimension.code))) ||
    !DOCUMENT_ID.test(command.component.componentId) ||
    !command.component.title.trim() ||
    !Number.isInteger(command.component.span) ||
    command.component.span < 1 ||
    command.component.span > 12 ||
    document.sections.some((candidate) =>
      candidate.components.some(
        (component) => component.id === command.component.componentId
      )
    )
  ) {
    return document;
  }

  if (
    command.placement.afterComponentId !== undefined &&
    !section.components.some(
      (component) => component.id === command.placement.afterComponentId
    )
  ) {
    return document;
  }

  if (command.dataSource.mode === 'create_query') {
    if (
      !DOCUMENT_ID.test(command.dataSource.dataSourceId) ||
      Object.hasOwn(document.dataSources, command.dataSource.dataSourceId) ||
      !metric.availableAggregations.includes(command.dataSource.aggregation)
    ) {
      return document;
    }
  } else {
    const source = document.dataSources[command.dataSource.dataSourceId];
    if (
      !source ||
      source.source.type !== 'query' ||
      source.fields[metric.code]?.role !== 'metric' ||
      !source.source.query.metrics.includes(metric.code) ||
      (dimension !== null &&
        (source.fields[dimension.code]?.role !== 'dimension' ||
          !source.source.query.dimensions?.includes(dimension.code)))
    ) {
      return document;
    }
  }

  const next = clonePage(document);
  if (command.dataSource.mode === 'create_query') {
    next.dataSources[command.dataSource.dataSourceId] = {
      fields: Object.fromEntries([
        ...(dimension
          ? [[dimension.code, dimensionField(dimension)] as const]
          : []),
        [metric.code, metricField(metric)]
      ]),
      source: {
        type: 'query',
        query: insertionQuery(command.component, command.dataSource.aggregation)
      }
    };
  }

  const targetSection = next.sections.find(
    (candidate) => candidate.id === command.placement.sectionId
  )!;
  const afterIndex = command.placement.afterComponentId
    ? targetSection.components.findIndex(
        (component) => component.id === command.placement.afterComponentId
      )
    : targetSection.components.length - 1;
  targetSection.components.splice(
    afterIndex + 1,
    0,
    insertionComponent(
      command.component,
      metric.name,
      dimension?.name,
      command.dataSource.dataSourceId
    )
  );
  return next;
}

function insertionQuery(
  insertion: BoundComponentInsertion,
  aggregation: string
): StructuredQuery {
  if (insertion.kind === 'metric_card') {
    return { metrics: [insertion.metricCode], aggregation };
  }
  const query: StructuredQuery = {
    metrics: [insertion.metricCode],
    dimensions: [insertion.dimensionCode],
    aggregation
  };
  if (insertion.kind === 'line_chart') {
    query.orderBy = [{ field: insertion.dimensionCode, direction: 'asc' }];
    query.limit = 100;
  } else {
    query.orderBy = [{ field: insertion.metricCode, direction: 'desc' }];
    query.limit = insertion.kind === 'table' ? 100 : 10;
  }
  return query;
}

function insertionComponent(
  insertion: BoundComponentInsertion,
  metricName: string,
  dimensionName: string | undefined,
  dataSourceId: string
): Component {
  const base = {
    id: insertion.componentId,
    layout: { span: insertion.span },
    data: { main: dataSourceId }
  };
  const title = insertion.title.trim();
  if (insertion.kind === 'metric_card') {
    return {
      ...base,
      type: 'metricCard',
      props: {
        title,
        rows: [{ label: metricName, valueField: insertion.metricCode }]
      }
    };
  }
  const series = [{ field: insertion.metricCode, label: metricName }];
  if (insertion.kind === 'bar_chart') {
    return {
      ...base,
      type: 'barChart',
      props: {
        title,
        categoryField: insertion.dimensionCode,
        series,
        rounded: true
      }
    };
  }
  if (insertion.kind === 'line_chart') {
    return {
      ...base,
      type: 'lineChart',
      props: {
        title,
        xField: insertion.dimensionCode,
        series,
        smooth: true
      }
    };
  }
  if (insertion.kind === 'pie_chart') {
    return {
      ...base,
      type: 'pieChart',
      props: {
        title,
        categoryField: insertion.dimensionCode,
        valueField: insertion.metricCode,
        ring: '58%'
      }
    };
  }
  if (insertion.kind === 'ranking_card') {
    return {
      ...base,
      type: 'rankingCard',
      props: {
        title,
        nameField: insertion.dimensionCode,
        valueField: insertion.metricCode
      }
    };
  }
  return {
    ...base,
    type: 'table',
    props: {
      title,
      columns: [
        { field: insertion.dimensionCode, title: dimensionName },
        {
          field: insertion.metricCode,
          title: metricName,
          sortable: true,
          align: 'right'
        }
      ],
      pagination: { mode: 'none' }
    }
  };
}

export function workspaceIsDirty(workspace: PageWorkspace): boolean {
  return !equalPage(workspace.current, workspace.baseDocument);
}

function retainSelection(
  document: Page,
  locator: ComponentLocator | null
): ComponentLocator | null {
  return locator && locateComponent(document, locator) ? { ...locator } : null;
}

function locateComponent(document: Page, locator: ComponentLocator) {
  return document.sections
    .find((section) => section.id === locator.sectionId)
    ?.components.find((component) => component.id === locator.componentId);
}

function moveComponentBefore(
  document: Page,
  locator: ComponentLocator,
  before: ComponentLocator
): Page {
  if (locator.sectionId !== before.sectionId) return document;
  const next = clonePage(document);
  const section = next.sections.find((candidate) => candidate.id === locator.sectionId);
  if (!section) return document;
  const sourceIndex = section.components.findIndex(
    (component) => component.id === locator.componentId
  );
  const targetIndex = section.components.findIndex(
    (component) => component.id === before.componentId
  );
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return document;
  const [component] = section.components.splice(sourceIndex, 1);
  if (!component) return document;
  const insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  section.components.splice(insertionIndex, 0, component);
  return next;
}

function editQueryDataSource(
  document: Page,
  dataSourceId: string,
  query: StructuredQuery,
  catalog: CatalogSnapshot
): Page {
  const current = document.dataSources[dataSourceId];
  if (!current || current.source.type !== 'query' || query.metrics.length === 0) {
    return document;
  }
  const metrics = query.metrics.map((code) =>
    catalog.metrics.find((metric) => metric.code === code)
  );
  const dimensions = (query.dimensions ?? []).map((code) =>
    catalog.dimensions.find((dimension) => dimension.code === code)
  );
  if (metrics.some((metric) => !metric) || dimensions.some((dimension) => !dimension)) {
    return document;
  }
  const resolvedMetrics = metrics.filter((metric) => metric !== undefined);
  const resolvedDimensions = dimensions.filter((dimension) => dimension !== undefined);
  if (
    resolvedMetrics.some(
      (metric) =>
        resolvedDimensions.some(
          (dimension) => !metric.availableDimensions.includes(dimension.code)
        ) ||
        (query.aggregation !== undefined &&
          !metric.availableAggregations.includes(query.aggregation))
    )
  ) {
    return document;
  }

  const previousQuery = cloneQuery(current.source.query);
  const next = clonePage(document);
  const source = next.dataSources[dataSourceId]!;
  const previousFields = source.fields;
  source.fields = Object.fromEntries([
    ...resolvedDimensions.map((dimension) => [
      dimension.code,
      previousFields[dimension.code] ?? {
        type: 'string' as const,
        role: 'dimension' as const,
        label: dimension.name
      }
    ]),
    ...resolvedMetrics.map((metric) => [
      metric.code,
      {
        type: 'number' as const,
        role: 'metric' as const,
        label: metric.name,
        format:
          metric.valueType === 'percent'
            ? ('percent-2' as const)
            : metric.valueType === 'integer'
              ? ('number-grouped' as const)
              : ('number-2' as const)
      }
    ])
  ]);
  source.source = {
    type: 'query',
    query: {
      ...previousQuery,
      ...cloneQuery(query)
    }
  };

  for (const component of next.sections.flatMap((section) => section.components)) {
    if (!component.data || component.data.main !== dataSourceId) continue;
    adaptComponentBindings(
      component,
      resolvedMetrics.map((metric) => ({ code: metric.code, name: metric.name })),
      resolvedDimensions.map((dimension) => ({
        code: dimension.code,
        name: dimension.name
      }))
    );
  }
  return next;
}

function adaptComponentBindings(
  component: Component,
  metrics: Array<{ code: string; name: string }>,
  dimensions: Array<{ code: string; name: string }>
) {
  const metric = metrics[0];
  const dimension = dimensions[0];
  if (!metric) return;
  if (component.type === 'metricCard') {
    component.props.rows = metrics.map((candidate) => ({
      label: candidate.name,
      valueField: candidate.code
    }));
  } else if (component.type === 'barChart') {
    if (dimension) component.props.categoryField = dimension.code;
    component.props.series = metrics.map((candidate) => ({
      field: candidate.code,
      label: candidate.name
    }));
  } else if (component.type === 'lineChart') {
    if (dimension) component.props.xField = dimension.code;
    component.props.series = metrics.map((candidate) => ({
      field: candidate.code,
      label: candidate.name
    }));
  } else if (component.type === 'pieChart') {
    if (dimension) component.props.categoryField = dimension.code;
    component.props.valueField = metric.code;
  } else if (component.type === 'rankingCard') {
    if (dimension) component.props.nameField = dimension.code;
    component.props.valueField = metric.code;
    delete component.props.changeField;
  } else if (component.type === 'mapChart') {
    if (dimension) component.props.nameField = dimension.code;
    component.props.valueField = metric.code;
  } else if (component.type === 'table') {
    component.props.columns = [
      ...dimensions.map((candidate) => ({
        field: candidate.code,
        title: candidate.name
      })),
      ...metrics.map((candidate) => ({
        field: candidate.code,
        title: candidate.name,
        sortable: true,
        align: 'right' as const
      }))
    ] satisfies TableColumnNode[];
  }
  adaptActions(component, metric.code, dimension?.code);
}

function adaptActions(component: Component, metric: string, dimension?: string) {
  const actions = 'actions' in component.props ? component.props.actions : undefined;
  if (!actions) return;
  for (const action of actions) {
    if ('field' in action) action.field = dimension ?? metric;
    if ('navigate' in action && action.navigate.setFilters) {
      action.navigate.setFilters = Object.fromEntries(
        Object.keys(action.navigate.setFilters).map((filterId) => [
          filterId,
          dimension ?? metric
        ])
      );
    }
  }
}

function metricField(metric: CatalogSnapshot['metrics'][number]) {
  return {
    type: 'number' as const,
    role: 'metric' as const,
    label: metric.name,
    format:
      metric.valueType === 'percent'
        ? ('percent-2' as const)
        : metric.valueType === 'integer'
          ? ('number-grouped' as const)
          : ('number-2' as const)
  };
}

function dimensionField(dimension: CatalogSnapshot['dimensions'][number]) {
  return {
    type: 'string' as const,
    role: 'dimension' as const,
    label: dimension.name
  };
}

function cloneQuery(query: StructuredQuery): StructuredQuery {
  return JSON.parse(JSON.stringify(query)) as StructuredQuery;
}

function equalPage(left: Page, right: Page): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clonePage(document: Page): Page {
  return JSON.parse(JSON.stringify(document)) as Page;
}
