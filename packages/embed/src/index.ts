import {
  mount as mountSvelte,
  unmount
} from 'svelte';
import { createDqeGateway } from '@metriccanvas/data-gateway';
import EmbedRoot from './EmbedRoot.svelte';
import type {
  MountOptions,
  RuntimeHandle,
  RuntimeInput
} from './types';

export { createDqeGateway };
export type { DqeGatewayConfig } from '@metriccanvas/data-gateway';
export type {
  MountOptions,
  RuntimeEvent,
  RuntimeHandle,
  RuntimeInput
} from './types';
export type { TypedError } from '@metriccanvas/page';
export type { DataGateway } from '@metriccanvas/runtime';
export type { AiSummaryConfig } from '@metriccanvas/runtime-ui';

interface EmbedRootExports {
  update(input: RuntimeInput): void;
}

const instances = new WeakMap<HTMLElement, RuntimeHandle>();

export function mount(
  target: string | HTMLElement,
  options: MountOptions
): RuntimeHandle {
  const container = resolveTarget(target);
  if (instances.has(container)) {
    throw mountError('目标元素已经挂载了一个活动的 MetricCanvas 实例。');
  }

  const host = document.createElement('div');
  host.dataset.metriccanvasRuntime = '';
  host.style.display = 'block';
  host.style.width = '100%';
  host.style.minWidth = '0';
  const shadow = host.attachShadow({ mode: 'open' });
  container.append(host);

  let root: EmbedRootExports;
  try {
    root = mountSvelte(EmbedRoot, {
      target: shadow,
      props: {
        initialInput: runtimeInput(options),
        onEvent: options.onEvent
      }
    }) as EmbedRootExports;
  } catch (cause) {
    host.remove();
    throw cause;
  }

  let destroyed = false;
  const handle: RuntimeHandle = {
    update(input) {
      if (destroyed) {
        throw mountError('MetricCanvas 实例已销毁，不能再次更新。');
      }
      root.update(runtimeInput(input));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      instances.delete(container);
      void unmount(root);
      host.remove();
    }
  };
  instances.set(container, handle);
  return handle;
}

function runtimeInput(input: RuntimeInput): RuntimeInput {
  return {
    document: input.document,
    ...(input.dataGateway !== undefined
      ? { dataGateway: input.dataGateway }
      : {}),
    ...(input.aiSummary !== undefined
      ? { aiSummary: input.aiSummary }
      : {}),
    ...(input.initialSearch !== undefined
      ? { initialSearch: normalizeSearch(input.initialSearch) }
      : {})
  };
}

function normalizeSearch(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}

function resolveTarget(target: string | HTMLElement): HTMLElement {
  if (typeof document === 'undefined') {
    throw mountError('MetricCanvas 只能在浏览器中挂载。');
  }
  if (typeof target !== 'string') {
    if (!(target instanceof HTMLElement)) {
      throw mountError('挂载目标必须是 HTMLElement 或 CSS 选择器。');
    }
    return target;
  }

  const matches = document.querySelectorAll(target);
  if (matches.length === 0) {
    throw mountError(`找不到挂载目标:${target}`);
  }
  if (matches.length > 1) {
    throw mountError(`挂载目标必须唯一，选择器匹配了 ${matches.length} 个元素:${target}`);
  }
  const element = matches[0];
  if (!(element instanceof HTMLElement)) {
    throw mountError(`挂载目标不是 HTMLElement:${target}`);
  }
  return element;
}

function mountError(message: string): Error {
  const error = new Error(message);
  error.name = 'MetricCanvasMountError';
  return error;
}
