<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import type { DataGateway } from '@metriccanvas/runtime';
  import {
    RuntimeView,
    type RuntimeNavigation
  } from '@metriccanvas/runtime-ui';
  import {
    aiSummary,
    dataGateway,
    pageRepository
  } from '$lib/services';

  type PageLoadState =
    | { phase: 'loading' }
    | { phase: 'missing'; message: string }
    | {
        phase: 'ready';
        document: unknown;
        dataGateway: DataGateway;
      };

  let pageState = $state<PageLoadState>({ phase: 'loading' });
  let initialSearch = $state('');
  /** 精确修订预览的修订标识,仅用于查询诊断定位。 */
  let pageRevisionId = $state<string | undefined>(undefined);
  let activePageId = '';
  let loadSession = 0;

  const navigation: RuntimeNavigation = {
    href(pageId, search) {
      return `/pages/${pageId}${search ? `?${search}` : ''}`;
    },
    replaceSearch(search) {
      replaceState(`${location.pathname}${search ? `?${search}` : ''}`, {});
    },
    navigate({ href }) {
      void goto(href);
    }
  };

  $effect(() => {
    const pageId = page.params.pageId!;
    if (pageId === activePageId) return;
    activePageId = pageId;
    initialSearch = page.url.searchParams.toString();
    pageRevisionId = page.url.searchParams.get('revision') ?? undefined;
    void loadPage(pageId);
  });

  async function loadPage(pageId: string) {
    const session = ++loadSession;
    pageState = { phase: 'loading' };
    try {
      const document = await pageRepository.load(pageId);
      if (session !== loadSession) return;
      pageState = {
        phase: 'ready',
        document,
        dataGateway
      };
    } catch (cause) {
      if (session !== loadSession) return;
      pageState = {
        phase: 'missing',
        message: cause instanceof Error ? cause.message : String(cause)
      };
    }
  }
</script>

{#if pageState.phase === 'loading'}
  <p class="muted">加载页面…</p>
{:else if pageState.phase === 'missing'}
  <div class="error-page">
    <h1>页面加载失败</h1>
    <p>{pageState.message}</p>
  </div>
{:else}
  <RuntimeView
    document={pageState.document}
    dataGateway={pageState.dataGateway}
    {aiSummary}
    {initialSearch}
    {navigation}
    {pageRevisionId}
  />
{/if}

<style>
  .muted {
    color: #71717a;
  }
  .error-page h1 {
    font-size: 20px;
  }
</style>
