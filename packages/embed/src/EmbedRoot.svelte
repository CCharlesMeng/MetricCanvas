<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { untrack } from 'svelte';
  import type {
    RuntimeInput,
    RuntimeEvent
  } from './types';

  let {
    initialInput,
    onEvent
  }: {
    initialInput: RuntimeInput;
    onEvent?: (event: RuntimeEvent) => void;
  } = $props();

  let input = $state(untrack(() => initialInput));
  // Injected application session identity must survive Svelte's per-root deep proxies.
  let summaryConfig = $state.raw(untrack(() => initialInput.aiSummary));
  let gateway = $state.raw(untrack(() => initialInput.dataGateway));
  let regionMap = $state.raw(untrack(() => initialInput.regionMap));
  let facts = $state.raw(untrack(() => initialInput.displayInputs));
  let authHandler = $state.raw(untrack(() => initialInput.onAuthRequired));
  function readExportPermission(value: RuntimeInput['permissions']) {
    return value === undefined ? undefined : value?.canExport === true;
  }
  let hostCanExport = $state(untrack(() => readExportPermission(initialInput.permissions)));
  let previousInput = untrack(() => initialInput);

  function sameRenderInput(next: RuntimeInput, previous: RuntimeInput): boolean {
    return Object.keys({...previous,...next}).filter(key=>key!=='onAuthRequired' && key!=='permissions')
      .every(key=>next[key as keyof RuntimeInput]===previous[key as keyof RuntimeInput]);
  }

  export function update(next: RuntimeInput) {
    hostCanExport = readExportPermission(next.permissions);
    authHandler = next.onAuthRequired;
    // Permissions and auth handlers have independent reactive state. Updating only these
    // must preserve the mounted session, open dialogs, filters and in-flight reads.
    const hasHostUpdate = next.permissions !== undefined || previousInput.permissions !== undefined ||
      next.onAuthRequired !== previousInput.onAuthRequired;
    const keepSession = hasHostUpdate && sameRenderInput(next, previousInput);
    previousInput = next;
    if (keepSession) return;
    summaryConfig = next.aiSummary;
    gateway = next.dataGateway;
    regionMap = next.regionMap;
    facts = next.displayInputs;
    input = next;
  }
</script>

<RuntimeView
  {hostCanExport}
  displayInputs={facts}
  document={input.document}
  execution={input.execution}
  dataGateway={gateway}
  {regionMap}
  aiSummary={summaryConfig}
  initialSearch={input.initialSearch}
  navigation={input.navigation}
  filterEditing={input.filterEditing}
  onevent={onEvent}
  onAuthRequired={authHandler}
/>
