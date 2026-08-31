<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import {
    documentLayoutForm,
    documentUsesRuntimeBackToolbar
  } from '@metriccanvas/page';
  import type { DataGateway } from '@metriccanvas/runtime';
  import {
    RuntimeView,
    type RuntimeNavigation
  } from '@metriccanvas/runtime-ui';
  import {
    pageHref,
    pageReturnHref,
    rememberPageReturn
  } from '$lib/page-return';
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
  let returnHref = $state<string | undefined>(undefined);
  /** 页面外框在校验之前就要定下来,因此按原始文档结构读布局形态。 */
  const layoutForm = $derived(
    pageState.phase === 'ready' ? documentLayoutForm(pageState.document) : 'report'
  );
  const compactRuntimeToolbar = $derived(
    pageState.phase === 'ready' && documentUsesRuntimeBackToolbar(pageState.document)
  );

  const navigation = $derived.by<RuntimeNavigation>(() => {
    const base: RuntimeNavigation = {
      href(pageId, search) {
        return pageHref(pageId, search);
      },
      replaceSearch(search) {
        replaceState(`${location.pathname}${search ? `?${search}` : ''}`, {});
      },
      navigate({ href, pageId, sourcePageId, sourceSearch }) {
        rememberPageReturn(pageId, { pageId: sourcePageId, search: sourceSearch });
        void goto(href);
      }
    };
    const href = returnHref;
    return href ? { ...base, back: () => void goto(href) } : base;
  });

  $effect(() => {
    const pageId = page.params.pageId!;
    if (pageId === activePageId) return;
    activePageId = pageId;
    initialSearch = page.url.searchParams.toString();
    pageRevisionId = page.url.searchParams.get('revision') ?? undefined;
    returnHref = pageReturnHref(pageId);
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

<div class="page-frame" class:frame-dashboard={layoutForm === 'dashboard'}>
  {#if returnHref && !compactRuntimeToolbar}
    <nav class="page-breadcrumb" aria-label="页面回退">
      <a href={returnHref}>返回</a>
    </nav>
  {/if}

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
</div>

<style>
  /* 报表形态沿用宿主的定宽居中外框;看板形态始终使用宿主的
     全部可用宽度,页面画布与内边距由统一运行时决定。 */
  .page-frame {
    max-width: 1440px;
    box-sizing: content-box;
    padding: 24px;
    margin: 0 auto;
  }
  .page-frame.frame-dashboard {
    width: 100%;
    max-width: none;
    padding: 0;
    margin: 0;
  }
  .muted {
    color: #71717a;
  }
  .error-page h1 {
    font-size: 20px;
  }
  .page-breadcrumb {
    margin: 0 0 12px;
  }
  .page-breadcrumb a {
    color: #08359e;
    font-size: 13px;
    text-decoration: none;
  }
  .page-breadcrumb a:hover {
    text-decoration: underline;
  }
</style>
