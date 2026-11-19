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
  let active: { target: TipTarget; fetch: FetchDefinitions } | undefined;
  let request: AbortController | undefined;
  let state: MetricDefinitionTipState | undefined;

  function update(next: MetricDefinitionTipState | undefined) {
    state = next;
    publish(next);
  }

  function open(target: TipTarget, fetch: FetchDefinitions) {
    if (state?.anchor === target.anchor) {
      if (target.keyboard && !state.keyboard) update({ ...state, keyboard: true });
      return;
    }
    active = { target, fetch };
    void retry();
  }

  async function retry() {
    if (!active) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const { target, fetch } = active;
    const { signal } = controller;
    update({ ...target, keyboard: state?.anchor === target.anchor ? state.keyboard : target.keyboard, phase: 'loading' });
    try {
      const definitions = await fetch([target.code], { signal });
      if (signal.aborted || !state) return;
      const definition = definitions.find(item => item?.code === target.code && hasDefinitionText(item));
      update(definition ? { ...state, phase: 'loaded', definition } : { ...state, phase: 'error' });
    } catch {
      if (!signal.aborted && state) update({ ...state, phase: 'error' });
    }
  }

  function close() {
    request?.abort();
    request = undefined;
    active = undefined;
    if (state) update(undefined);
  }

  return { open, retry, close };
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
