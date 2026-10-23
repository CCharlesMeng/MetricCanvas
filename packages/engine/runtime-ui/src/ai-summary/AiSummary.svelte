<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import { SUMMARY_EXPORT_CAPTURE, type SummaryCapture } from '../export-render-state';
  import { hasAiSummaryBody, type AiSummaryProps } from '@metriccanvas/page/internal';
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
      data = providedContent(props.body ?? '');
      return;
    }
    const context = runtime?.();
    if (!context) { data = { status: 'loading' }; return; }
    const input = assembleGenerationInput(props, componentId, sourceSnapshots, context);
    if (!input) { data = { status: 'loading' }; return; }
    if (!config) {
      data = { status: 'error', error: { message: 'AI 总结未配置 generate(question, contextInfo)' } };
      return;
    }
    const options = config;
    // Session creation and result callbacks must not become reactive input dependencies.
    return untrack(() => aiSummaryTaskSession(options).watch(input, next => { data = next; }, force));
  });

  function providedContent(body: string): AiSummarySnapshot {
    try { return summaryContent(body); }
    catch { return { status: 'empty' }; }
  }
</script>

<AiSummaryView props={{ title: props.title, variant: props.variant }} {data} onretry={() => retry++} />
