<script lang="ts">
  import { createPagedJoinPreview } from '../../../../../fixtures/paged-join-on-demand';
  import {createPeriodComparisonPreview} from "../../../../../fixtures/period-comparison";
  const comparisonPreview = $derived(createPeriodComparisonPreview(page.url.searchParams.get("state") ?? "ready"));
  import { createFullQueryCandidatesPreview } from '../../../../../fixtures/full-query-candidates';
  import {createTableRecoveryPreview} from '../../../../../fixtures/table-recovery';
  import {withIocRegionCandidates} from '$lib/ioc-region-preview';
  import {createKeyOfficeGateway} from '../../../../../fixtures/key-office-filter/gateway';
  import {sharedKeyOfficeFilters} from '$lib/key-office-shared';
  const sharedBindings={'key-office':'key-office',region:'region',mtime:'mtime'};
  import {zeroTotalPreviewGateway} from "../../../../../fixtures/zero-total-gateway";
  import {partnerHealthUnionGateway} from '../../../../../fixtures/organization-union/gateway';
  import {createHierarchyGateway} from '../../../../../fixtures/hierarchy-gateway';
  import {createRejectionPreview} from '../../../../../fixtures/rejection-details/gateway';
  import { createUnionPreview } from '../../../../../fixtures/decision-opinion/union-gateway';
  import {createDecisionOpinionPreview} from '../../../../../fixtures/decision-opinion/preview';
  import {iocSelectionGateway} from '../../../../../fixtures/selection-gateway';
  import {pageExternalInputs,rejectionPreviewRowCount,rejectionPreviewDelay} from '../../../../../fixtures/preview-inputs';
  import {browser} from '$app/environment';
  const framed = browser && window.self !== window.top;
  import {createVisibilityDemoInputs} from '$lib/visibility-inputs';
  import {createIocHeaderPreview} from '$lib/ioc-header-preview-inputs';
  import {createIocBusinessPreview} from '$lib/ioc-business-preview';
  const businessPreview=$derived(createIocBusinessPreview(page.params.pageId??''));
  const headerPreview = createIocHeaderPreview();
  const visibilityDemo=createVisibilityDemoInputs();
  let visibilityInstance=$state(0);
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import PageDocument from '$lib/PageDocument.svelte';
  import { documentLayoutForm, documentUsesRuntimeBackToolbar } from '@metriccanvas/page/internal';
  import {projectNavigationInputs,type DataGateway} from '@metriccanvas/engine';
  import {
    RuntimeView,
    type RuntimeNavigation, type RuntimeViewEvent
  } from '@metriccanvas/engine/ui';
  import {
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
  let activeURL = '';
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
      async resolveTargetInputs(href,{signal}) {
        const target=new URL(href,document.baseURI),match=/^\/pages\/([^/]+)$/.exec(target.pathname);
        if(target.origin!==location.origin||!match)return undefined;
        const documentValue=await pageRepository.load(decodeURIComponent(match[1]!));
        if(signal.aborted)return undefined;
        return projectNavigationInputs(documentValue);
      },
      replaceSearch(search) {
        const url = new URL(location.href);
        url.search = search;
        activeURL = url.href;
        replaceState(url, {});
      },
      navigate({ href, sourcePageId, sourceSearch }) {
        const url = new URL(href, document.baseURI);
        const match = /^\/pages\/([^/]+)$/.exec(url.pathname);
        if (url.origin !== location.origin || !match) return false;
        rememberPageReturn(decodeURIComponent(match[1]!), { pageId: sourcePageId, search: sourceSearch });
        void goto(url.href);
        return true;
      }
    };
    const href = returnHref;
    return href ? { ...base, returnContext: {entryId:href,label:'返回来源页'}, back: () => void goto(href) } : base;
  });

  $effect(() => {
    const pageId = page.params.pageId!;
    if (page.url.href === activeURL) return;
    activeURL = page.url.href;
    initialSearch = page.url.searchParams.toString();
    pageRevisionId = page.url.searchParams.get('revision') ?? undefined;
    returnHref = pageReturnHref(pageId);
    void loadPage(pageId);
  });

  function queryTableGateway(input: ReturnType<typeof pageExternalInputs>): DataGateway | undefined {
    if(input==='paged-join-on-demand')return createPagedJoinPreview().dataGateway;
    if(input==='full-query-candidates')return createFullQueryCandidatesPreview(page.url.searchParams.get('state') ?? 'ready').dataGateway;
  }

  function previewDataGateway(pageId: string): DataGateway {
    const tableGateway=queryTableGateway(pageExternalInputs(pageId));
    if(tableGateway)return tableGateway;
    switch (pageExternalInputs(pageId)) {
      case 'key-office': return createKeyOfficeGateway();
      case 'ioc-region': return withIocRegionCandidates(dataGateway);
      case 'table-recovery': return createTableRecoveryPreview(page.url.searchParams.get('recoveryState') ?? 'mixed').dataGateway;
      case 'record-join': return createRejectionPreview({rows:rejectionPreviewRowCount(pageId),delayMs:rejectionPreviewDelay(pageId,page.url.searchParams),failure:page.url.searchParams.get('sourceFailure') === 'true'}).dataGateway;
      case 'paged-union': return createUnionPreview({failMember:page.url.searchParams.get('sourceFailure') === 'commercial' ? 'commercial' : undefined,rowFailure:page.url.searchParams.get('rowFailure')}).dataGateway;
      case 'decision-opinion': return createDecisionOpinionPreview({failMember:page.url.searchParams.get('sourceFailure')}).dataGateway;
      case 'ioc-business': return businessPreview.dataGateway;
      case 'selection': return iocSelectionGateway;
      case 'ioc-header': return headerPreview.dataGateway;
      case 'hierarchy': return createHierarchyGateway();
      default: return dataGateway;
    }
  }

  function recordSharedFilters(event:RuntimeViewEvent) {
    if(event.type!=='filter-change'||pageState.phase!=='ready'||pageExternalInputs(page.params.pageId)!=='key-office')return;
    sharedKeyOfficeFilters.recordSearch(projectNavigationInputs(pageState.document).filters,event.search,sharedBindings);
  }

  async function loadPage(pageId: string) {
    const session = ++loadSession;
    pageState = { phase: 'loading' };
    try {
      const document = await pageRepository.load(pageId);
      if (session !== loadSession) return;
      if(pageExternalInputs(pageId)==='key-office') {
        const filters=projectNavigationInputs(document).filters;
        initialSearch=sharedKeyOfficeFilters.initialSearch(filters,initialSearch,sharedBindings);
        sharedKeyOfficeFilters.recordSearch(filters,initialSearch,sharedBindings);
      }
      pageState = {
        phase: 'ready',
        document,
        dataGateway: zeroTotalPreviewGateway(pageId, previewDataGateway(pageId))
      };
      if(pageId==='period-comparison-demo')pageState.dataGateway=comparisonPreview.dataGateway;
      pageState.dataGateway = partnerHealthUnionGateway(pageId, pageState.dataGateway, page.url.searchParams.get('state') ?? 'ready');
    } catch (cause) {
      if (session !== loadSession) return;
      pageState = {
        phase: 'missing',
        message: cause instanceof Error ? cause.message : String(cause)
      };
    }
  }
</script>

{#if pageState.phase === 'ready' && !framed}
  <PageDocument pageId={page.params.pageId!} document={pageState.document} />
{/if}

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
    {#if pageExternalInputs(page.params.pageId)==='visibility'}
      <div data-sim-facts aria-label="Sim事实控制">
        <strong>Sim 事实输入</strong>
        <button onclick={()=>visibilityDemo.publish('allow')}>允许</button>
        <button onclick={()=>visibilityDemo.publish('deny')}>拒绝</button>
        <button onclick={()=>visibilityDemo.publish('pending')}>等待</button>
        <button onclick={()=>visibilityDemo.publish('error')}>输入错误</button>
        <button onclick={()=>visibilityDemo.publish('revoke')}>更换权限会话</button>
        <button onclick={()=>visibilityInstance++}>重新初始化</button>
      </div>
    {/if}
    {#key visibilityInstance}
    <RuntimeView
      displayInputs={pageExternalInputs(page.params.pageId)==='period-comparison'?comparisonPreview.displayInputs:pageExternalInputs(page.params.pageId)==='ioc-business'?businessPreview.displayInputs:pageExternalInputs(page.params.pageId)==='visibility'?visibilityDemo.source:pageExternalInputs(page.params.pageId)==='ioc-header'?headerPreview.displayInputs:undefined}
      document={pageState.document}
      dataGateway={pageState.dataGateway}
      {aiSummary}
      onevent={recordSharedFilters}
      {initialSearch}
      {navigation}
      {pageRevisionId}
    />
    {/key}
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
