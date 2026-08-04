<script lang="ts">
  import type { AiSummaryProps } from '@metriccanvas/page';
  import type { PageDataSnapshots } from '@metriccanvas/runtime';
  import AiSummaryView from './AiSummaryView.svelte';
  import { assembleAiSummaryRequest } from './assemble-request';
  import { createPanguSseClient, type AiSummaryConfig, type AiSummaryTransport } from './pangu-sse';
  import { createAiSummarySession, type AiSummarySession, type AiSummarySnapshot } from './session';

  let {
    props,
    sourceSnapshots,
    config
  }: {
    props: AiSummaryProps;
    sourceSnapshots: PageDataSnapshots;
    config?: AiSummaryConfig;
  } = $props();

  let data = $state<AiSummarySnapshot>({ status: 'loading' });
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

<AiSummaryView props={{ title: props.title }} {data} onretry={() => componentSession?.retry()} />
