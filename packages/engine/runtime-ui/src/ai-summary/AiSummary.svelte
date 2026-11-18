<script lang="ts">
  import { getContext, onDestroy, untrack } from 'svelte';
  import { SUMMARY_EXPORT_CAPTURE, type SummaryCapture } from '../export-render-state';
  import { activePageComponents, hasAiSummaryBody, type AiSummaryProps } from '@metriccanvas/page/internal';
  import type { PageDataSnapshots } from '../../../runtime/src';
  import AiSummaryView from './view/AiSummaryView.svelte';
  import { AI_SUMMARY_RUNTIME_CONTEXT, assembleGenerationInput, type AiSummaryRuntimeReader } from './runtime/input';
  import { aiSummaryTaskSession } from './runtime/session';
  import { summaryContent } from './view/content';
  import type { AiSummaryConfig, AiSummarySnapshot } from './types';

  let { props, componentId = '', sourceSnapshots, config }: {
    props: AiSummaryProps; componentId?: string;
    sourceSnapshots: PageDataSnapshots; config?: AiSummaryConfig;
  } = $props();
  const runtime = getContext<AiSummaryRuntimeReader | undefined>(AI_SUMMARY_RUNTIME_CONTEXT);
  const capture = getContext<SummaryCapture | undefined>(SUMMARY_EXPORT_CAPTURE);
  let data = $state<AiSummarySnapshot>({ status: 'loading' });
  let retry = $state(0);
  let lastRetry = 0;
  let unsubscribe: (() => void) | undefined;

  function stopWatching() {
    unsubscribe?.();
    unsubscribe = undefined;
  }
  onDestroy(stopWatching);

  $effect(() => {
    if (!componentId || !capture) return;
    const id = componentId;
    capture.set(id, () => data);
    return () => { capture.delete(id); };
  });

  $effect(() => {
    const force = retry !== lastRetry;
    lastRetry = retry;
    if (hasAiSummaryBody(props)) {
      stopWatching();
      data = providedContent(props.body ?? '');
      return;
    }
    const context = runtime?.();
    const input = context && assembleGenerationInput(props, componentId, sourceSnapshots, context);
    if (!context || !input) {
      stopWatching();
      data = { status: 'loading' };
      return;
    }
    // A retained tab still receives its in-flight result. Its current projection can omit the query.
    if (!activePageComponents(context.page, context.tabs).some(component => component.id === componentId)) return;
    stopWatching();
    if (!config) {
      data = { status: 'error', error: { message: 'AI 总结未配置 generate(question, contextInfo)' } };
      return;
    }
    const options = config;
    // Session creation and result callbacks must not become reactive input dependencies.
    unsubscribe = untrack(() => aiSummaryTaskSession(options).watch(input, next => { data = next; }, force));
  });

  function providedContent(body: string): AiSummarySnapshot {
    try { return summaryContent(body); }
    catch { return { status: 'empty' }; }
  }
</script>

<AiSummaryView props={{ title: props.title, variant: props.variant }} {data} onretry={() => retry++} />
