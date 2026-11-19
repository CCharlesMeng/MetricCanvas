import type { MetricDefinition, MetricDefinitionsGateway } from '../../../runtime/src';

type FetchDefinitions = MetricDefinitionsGateway['fetchMetricDefinitions'];

interface TipTarget {
  anchor: HTMLButtonElement;
  code: string;
  title: string;
  keyboard: boolean;
}

export type MetricDefinitionTipState = TipTarget & (
  | { phase: 'loading' | 'error' }
  | { phase: 'loaded'; definition: MetricDefinition }
);

export interface MetricDefinitionTips {
  available(): boolean;
  expanded(anchor: HTMLButtonElement | undefined): boolean;
  open(target: TipTarget): void;
  leave(event: PointerEvent | FocusEvent): void;
  remove(anchor: HTMLButtonElement): void;
  panelId: string;
}

export const METRIC_DEFINITION_TIPS = Symbol('metric-definition-tips');

export function createMetricDefinitionTip(publish: (next: MetricDefinitionTipState | undefined) => void) {
  const cache = new Map<string, MetricDefinition>();
  let fetchDefinitions: FetchDefinitions | undefined;
  let active: TipTarget | undefined;
  let request: AbortController | undefined;
  let state: MetricDefinitionTipState | undefined;

  function update(next: MetricDefinitionTipState | undefined) {
    state = next;
    publish(next);
  }

  function setFetch(fetch: FetchDefinitions | undefined) {
    if (fetchDefinitions === fetch) return;
    fetchDefinitions = fetch;
    cache.clear();
    close();
  }

  function open(target: TipTarget, fetch: FetchDefinitions) {
    setFetch(fetch);
    if (state?.anchor === target.anchor) {
      if (target.keyboard && !state.keyboard) update({ ...state, keyboard: true });
      return;
    }
    active = target;
    const definition = cache.get(target.code);
    if (!definition) {
      void retry();
      return;
    }
    cancelRequest();
    update({ ...target, phase: 'loaded', definition });
  }

  async function retry() {
    const target = active;
    const fetch = fetchDefinitions;
    if (!target || !fetch) return;
    cancelRequest();
    const controller = new AbortController();
    request = controller;
    const { signal } = controller;
    update({ ...target, keyboard: state?.anchor === target.anchor ? state.keyboard : target.keyboard, phase: 'loading' });
    try {
      const definitions = await fetch([target.code], { signal });
      if (signal.aborted || !state) return;
      const definition = definitions.find(item => item?.code === target.code && hasDefinitionText(item));
      if (definition) cache.set(target.code, definition);
      update(definition ? { ...state, phase: 'loaded', definition } : { ...state, phase: 'error' });
    } catch {
      if (!signal.aborted && state) update({ ...state, phase: 'error' });
    }
  }

  function cancelRequest() {
    request?.abort();
    request = undefined;
  }

  function close() {
    cancelRequest();
    active = undefined;
    if (state) update(undefined);
  }

  return { open, retry, close, setFetch };
}

function hasDefinitionText(definition: MetricDefinition): boolean {
  return [definition.name, definition.definition, definition.formula, definition.manager]
    .every(text => typeof text === 'string');
}

/** The adapter supplies an absolute destination. Leave the rest of the definition visible without a link. */
export function metricDefinitionHref(value: string | null): string | undefined {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\u0000-\u001f\u007f\\]/.test(value)) return;
  try {
    return new URL(value).href;
  } catch {
    return undefined;
  }
}
