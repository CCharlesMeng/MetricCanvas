<script lang="ts">
  import {createIocHeaderControlsPreview} from "../../../../../fixtures/ioc-header-controls";
  import {createSourceCandidatesPreview} from '../../../../../fixtures/source-candidates';
  import {createRegionURLGateway} from '../../../../../fixtures/region-url';
  import {createGlobalBenchmarkPreview} from '../../../../../fixtures/global-benchmark';
  import {createRowCachePreview} from '../../../../../fixtures/row-expansion-cache';
  import { createPagedJoinPreview } from '../../../../../fixtures/query-join-gateway';
  import {createPeriodComparisonPreview} from "../../../../../fixtures/period-comparison";
  import {createQueryComparisonPreview} from "../../../../../fixtures/query-comparison-gateway";
  const queryComparisonPreview = $derived(createQueryComparisonPreview(page.url.searchParams.get("state") ?? "ready"));
  const activeDisplayInputs = $derived.by(()=>{
    switch(pageExternalInputs(page.params.pageId)){
      case 'query-comparison': return queryComparisonPreview.displayInputs;
      case 'period-comparison': return comparisonPreview.displayInputs;
      case 'ioc-business': return businessPreview.displayInputs;
      case 'visibility': return visibilityDemo.source;
      case 'ioc-header': return headerPreview.displayInputs;
      default:return undefined;
    }
  });
  const comparisonPreview = $derived(createPeriodComparisonPreview(page.url.searchParams.get("state") ?? "ready"));
  import { createFullQueryCandidatesPreview } from '../../../../../fixtures/full-query-candidates';
  import {createTableRecoveryPreview} from '../../../../../fixtures/table-recovery';
  import {withIocRegionCandidates} from '$lib/ioc-region-preview';
  import {createKeyOfficeGateway,createKeyOfficePriorityGateway} from '../../../../../fixtures/key-office-filter/gateway';
  import {sharedKeyOfficeFilters} from '$lib/key-office-shared';
  import {prepareKeyOfficePreview} from '$lib/key-office-priority-preview';
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
  import { createPlaygroundNavigation } from '$lib/playground-navigation';
  import { page } from '$app/state';
  import PageDocument from '$lib/PageDocument.svelte';
  import { documentLayoutForm, documentUsesRuntimeBackToolbar } from '@metriccanvas/page/internal';
  import {projectNavigationInputs,type DataGateway} from '@metriccanvas/engine';
  import {
    RuntimeView,
    type RuntimeNavigation, type RuntimeViewEvent
  } from '@metriccanvas/engine/ui';
  import { pageReturnHref } from '$lib/page-return';
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
      preserveSearchParams: ['revision', 'state', 'supplementKey', 'sourceFailure', 'rowFailure', 'recoveryState'],
      ...createPlaygroundNavigation(pageRepository, {
        baseURL: () => location.href,
        visit: (href) => void goto(href),
        rememberSource: true
      }),
      replaceSearch(search) {
        const url = new URL(location.href);
        url.search = search;
        activeURL = url.href;
        replaceState(url, {});
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
    if(input==='header-controls')return createIocHeaderControlsPreview().dataGateway;
    if(input==='source-candidates')return createSourceCandidatesPreview(page.url.searchParams.get('state') ?? 'ready').dataGateway;
    if(input==='global-benchmark')return createGlobalBenchmarkPreview(page.url.searchParams.get('state') ?? 'ready').dataGateway;
    if(input==='region-url')return createRegionURLGateway();
    if(input==='row-cache')return createRowCachePreview().dataGateway;
    if(input==='ioc-region'||input==='ioc-region-dept')return withIocRegionCandidates(dataGateway,input==='ioc-region');
    if(input==='query-join')return createPagedJoinPreview(80,page.url.searchParams.get('supplementKey')??'ready').dataGateway;
    if(input==='full-query-candidates')return createFullQueryCandidatesPreview(page.url.searchParams.get('state') ?? 'ready').dataGateway;
  }

  function previewDataGateway(pageId: string): DataGateway {
    const tableGateway=queryTableGateway(pageExternalInputs(pageId));
    if(tableGateway)return tableGateway;
    switch (pageExternalInputs(pageId)) {
      case 'key-office': return createKeyOfficeGateway();
      case 'key-office-priority': return createKeyOfficePriorityGateway();
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
    if(event.type!=='filter-change'||pageState.phase!=='ready'||!['key-office','key-office-priority'].includes(pageExternalInputs(page.params.pageId)??''))return;
    sharedKeyOfficeFilters.recordSearch(projectNavigationInputs(pageState.document),event.search,sharedBindings);
  }

  async function loadPage(pageId: string) {
    const session = ++loadSession;
    pageState = { phase: 'loading' };
    try {
      const document = await prepareKeyOfficePreview(await pageRepository.load(pageId),pageExternalInputs(pageId),page.url.searchParams.get('state')??'ready');
      if (session !== loadSession) return;
      if(['key-office','key-office-priority'].includes(pageExternalInputs(pageId)??'')) {
        const inputs=projectNavigationInputs(document);
        initialSearch=sharedKeyOfficeFilters.initialSearch(inputs,initialSearch,sharedBindings);
        sharedKeyOfficeFilters.recordSearch(inputs,initialSearch,sharedBindings);
      }
      pageState = {
        phase: 'ready',
        document,
        dataGateway: zeroTotalPreviewGateway(pageId, previewDataGateway(pageId))
      };
      if(pageExternalInputs(pageId)==='period-comparison')pageState.dataGateway=comparisonPreview.dataGateway;
      if(pageExternalInputs(pageId)==='query-comparison')pageState.dataGateway=queryComparisonPreview.dataGateway;
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
      displayInputs={activeDisplayInputs}
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
