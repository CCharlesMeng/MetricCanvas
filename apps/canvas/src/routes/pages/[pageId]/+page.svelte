<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import type { CatalogSnapshot } from '@metriccanvas/page';
  import type { DataGateway } from '@metriccanvas/runtime';
  import {
    RuntimeView,
    type RuntimeNavigation
  } from '@metriccanvas/runtime-ui';
  import {
    catalogSnapshot,
    dataGateway,
    pageRepository
  } from '$lib/services';
  import {
    customerRiskCatalog,
    customerRiskGateway
  } from '$lib/customer-risk-preview';

  type PageLoadState =
    | { phase: 'loading' }
    | { phase: 'missing'; message: string }
    | {
        phase: 'ready';
        document: unknown;
        catalog: CatalogSnapshot;
        dataGateway: DataGateway;
      };

  let pageState = $state<PageLoadState>({ phase: 'loading' });
  let initialSearch = $state('');
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
    void loadPage(pageId);
  });

  async function loadPage(pageId: string) {
    const session = ++loadSession;
    pageState = { phase: 'loading' };
    try {
      const document = await pageRepository.load(pageId);
      if (session !== loadSession) return;
      const customerRisk = isCustomerRiskPage(document);
      pageState = {
        phase: 'ready',
        document,
        catalog: customerRisk ? customerRiskCatalog : catalogSnapshot,
        dataGateway: customerRisk ? customerRiskGateway : dataGateway
      };
    } catch (cause) {
      if (session !== loadSession) return;
      pageState = {
        phase: 'missing',
        message: cause instanceof Error ? cause.message : String(cause)
      };
    }
  }

  function isCustomerRiskPage(document: unknown): boolean {
    return (
      typeof document === 'object' &&
      document !== null &&
      'id' in document &&
      document.id === 'customer-activity-risk-briefing'
    );
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
    catalog={pageState.catalog}
    dataGateway={pageState.dataGateway}
    {initialSearch}
    {navigation}
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
