<script lang="ts">
  import { getContext } from 'svelte';
  import { SUMMARY_EXPORT_CAPTURE, type SummaryCapture } from '../export-render-state';
  import type { AiSummaryProps } from '@metriccanvas/page/internal';
  import type { PageDataSnapshots } from '../../../runtime/src';
  import AiSummaryView from './AiSummaryView.svelte';
  import { assembleAiSummaryRequest } from './assemble-request';
  import { createPanguSseClient, type AiSummaryConfig, type AiSummaryTransport } from './pangu-sse';
  import { createAiSummarySession, type AiSummarySession, type AiSummarySnapshot } from './session';

  let {
    props,
    componentId,
    sourceSnapshots,
    config
  }: {
    props: AiSummaryProps;
    componentId?: string;
    sourceSnapshots: PageDataSnapshots;
    config?: AiSummaryConfig;
  } = $props();

  let data = $state<AiSummarySnapshot>({ status: 'loading' });
  const capture=getContext<SummaryCapture>(SUMMARY_EXPORT_CAPTURE);
  $effect(()=>{if(!componentId||!capture)return;const id=componentId;capture.set(id,()=>data);return()=>{capture.delete(id);};});
  let componentSession = $state<AiSummarySession | null>(null);

  $effect(() => {
    const conversationBaseUrl = config?.conversationBaseUrl;
    const env = config?.env;
    const transport: AiSummaryTransport = conversationBaseUrl?.trim()
      ? createPanguSseClient({ conversationBaseUrl, ...(env ? { env } : {}) })
      : missingConfigTransport;
    const next = createAiSummarySession(transport);
    const unsubscribe = next.subscribe((snapshot) => {
      data = snapshot;
    });
    componentSession = next;
    return () => {
      unsubscribe();
      next.dispose();
    };
  });

  $effect(() => {
    componentSession?.update(assembleAiSummaryRequest(props, sourceSnapshots));
  });

  const missingConfigTransport: AiSummaryTransport = {
    async *stream() {
      throw new Error('AI 总结未配置 conversationBaseUrl');
    }
  };
</script>

<AiSummaryView
  props={{ title: props.title, variant: props.variant }}
  {data}
  onretry={() => componentSession?.retry()}
/>
