import {
  mount as mountSvelte,
  unmount
} from 'svelte';
import { createDqeGateway } from '@metriccanvas/engine/dqe';
import EmbedRoot from './EmbedRoot.svelte';
import {resolveInitialSearch} from './initial-search';
import {browserNavigation} from './browser-navigation';
import type {
  MountOptions,
  RuntimeEvent,
  RuntimeHandle,
  RuntimeInput
} from './types';

export { createDqeGateway };
export {projectNavigationInputs} from '@metriccanvas/engine';
export { prepareExecution, loadExecution, createLastFilterRecorder, ExecutionError } from '@metriccanvas/engine';
export type { ExecutionBootstrap, ExecutionRequest, ExecutionTarget, ExecutionPort, LastFilterContext, LastFilterRequest, LastFilterPort, LastFilterStatus } from '@metriccanvas/engine';
export type { DqeGatewayConfig } from '@metriccanvas/engine/dqe';
export type {
  DataPeriodFact,DisplayInputsSource,DisplayInputsSnapshot,
  MountOptions,
  RuntimeEvent,
  RuntimeHandle,
  RuntimeInput
} from './types';
export type { TypedError } from '@metriccanvas/page';
export type {
  DataGateway,
  DimensionValuesGateway,
  RuntimeDataGateway
} from '@metriccanvas/engine';
export type { AuthRequiredEvent, AiSummaryConfig, NavigationInputContract, RuntimeNavigation, RuntimeNavigationTarget } from '@metriccanvas/engine/ui';

interface EmbedRootExports {
  update(input: RuntimeInput): void;
}

interface MountedInstance {
  handle: RuntimeHandle;
  update(options: MountOptions): void;
}

interface MountConfiguration {
  onEvent: MountOptions['onEvent'];
  navigationInput: RuntimeInput['navigation'];
  navigation: RuntimeInput['navigation'];
}

interface AttachedRuntime {
  container: HTMLElement;
  host: HTMLElement;
  root: EmbedRootExports;
  configuration: MountConfiguration;
}

const instances = new WeakMap<HTMLElement, MountedInstance>();

function readInput(input: RuntimeInput, configuration: MountConfiguration): RuntimeInput {
  // Replacing only the auth handler must not recreate the navigation dependency.
  if (input.navigation !== configuration.navigationInput) {
    configuration.navigationInput = input.navigation;
    configuration.navigation = browserNavigation(configuration.navigationInput, window);
  }
  return runtimeInput(input, configuration.navigation);
}

function createRuntimeHandle(attached: AttachedRuntime | undefined): RuntimeHandle {
  return {
    update(input) {
      if (!attached) throw mountError('MetricCanvas 实例已销毁，不能再次更新。');
      attached.root.update(readInput(input, attached.configuration));
    },
    destroy() {
      const instance = attached;
      if (!instance) return;
      attached = undefined;
      instance.configuration.onEvent = undefined;
      instances.delete(instance.container);
      try {
        void unmount(instance.root);
      } finally {
        instance.host.remove();
      }
    }
  };
}

export function mount(
  target: string | HTMLElement,
  options: MountOptions
): RuntimeHandle {
  const container = resolveTarget(target);
  const existing = instances.get(container);
  if (existing) {
    existing.update(options);
    return existing.handle;
  }

  const onEvent = options.onEvent;
  const navigationInput = options.navigation;
  const configuration: MountConfiguration = {
    onEvent,
    navigationInput,
    navigation: browserNavigation(navigationInput, window)
  };
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
        initialInput: readInput(options, configuration),
        onEvent: (event: RuntimeEvent) => {
          const { onEvent } = configuration;
          onEvent?.(event);
        }
      }
    }) as EmbedRootExports;
  } catch (cause) {
    host.remove();
    throw cause;
  }

  const handle = createRuntimeHandle({ container, host, root, configuration });
  instances.set(container, {
    handle,
    update(nextOptions) {
      configuration.onEvent = nextOptions.onEvent;
      handle.update(nextOptions);
    }
  });
  return handle;
}

function runtimeInput(input: RuntimeInput, navigation: RuntimeInput['navigation']): RuntimeInput {
  return {
    document: input.document,
    onAuthRequired: input.onAuthRequired,
    ...(input.displayInputs!==undefined?{displayInputs:input.displayInputs}:{}),
    ...(input.execution !== undefined ? {execution:input.execution} : {}),
    ...(input.filterEditing !== undefined ? { filterEditing: input.filterEditing } : {}),
    navigation,
    ...(input.dataGateway !== undefined
      ? { dataGateway: input.dataGateway }
      : {}),
    ...(input.aiSummary !== undefined
      ? { aiSummary: input.aiSummary }
      : {}),
    initialSearch: resolveInitialSearch(input.initialSearch,window.location)
  };
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

export { ExportViewError } from '@metriccanvas/engine';

export type { AiSummaryGenerate, AiSummaryContextInfo, AiSummaryDataSource } from '@metriccanvas/engine/ui';

export {withOperationMapRegion,type OperationMapRegionAdapter} from '@metriccanvas/engine';
