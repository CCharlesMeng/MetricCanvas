<script module lang="ts">
  import { tableColumnNavigation } from '@metriccanvas/page/internal';
 import {selectTimeQuery} from '@metriccanvas/page/internal';
</script>
<svelte:options css="injected" />
<script lang="ts">
  import MetricDefinitionLayer from './metric-definition/MetricDefinitionLayer.svelte';
  import {createAuthRequiredGateway, notifyAuthRequired, type AuthRequiredEvent} from './auth-required';
  import {invalidateAiSummaryPage} from './ai-summary/runtime/session';
  import {debugWarn,createFinalizationPreparation,inheritFinalizationCache,supportsMembershipCandidates} from '@metriccanvas/data-execution/runtime';
  import {preparationBlocksPage,preparationBlocksFilter,discardPreparingData} from './preparation-blocked';
  import { isOfficeNavigationFeedback, officeNavigationInput, officeNavigationTarget, sameNavigationAddress, type OfficeNavigationInput } from './ioc-header/office-navigation';
  import {nativeSourceFilterIds,nativeIocRuntimePage} from '@metriccanvas/page/internal';
  import { hierarchyLevelOf } from '@metriccanvas/page/internal';
  import { projectSnapshotRows, snapshotCellFallbacks, tablePinnedSlots, restoreCellFallbacks, pinnedSnapshotError } from '@metriccanvas/page/internal';
  import { AI_SUMMARY_RUNTIME_CONTEXT, type AiSummaryRuntimeReader } from './ai-summary';
  import { initialTabSelections, tabSearch } from '@metriccanvas/page/internal';
  import { TAB_SELECTION_CONTEXT, type TabSelectionContext } from './tab-selection';
  import { resolvePendingPeriodChoice, visiblePendingPeriodModes, type PendingPeriodChoice } from './filters/pending-period-mode';
  import type { PeriodMode } from '@metriccanvas/page/internal';
  import { TABLE_EXPORT_ALLOWED } from '../../widgets/src/shared/export-context';
  import { withExportPermission } from '../../runtime/src/display-inputs';
  import { compilePresentation, resolvePresentationRow } from '../../runtime/src/presentation';
  import type { DisplaySnapshot } from '../../runtime/src/display-inputs';
  import { PRESENTATION_CONTEXT } from './presentation-context';
  import { chartOptionPaths, isChartOptionError } from '@metriccanvas/page/internal';
  import { CHART_OPTION_PATHS } from '../../widgets/src/shared/chart-option-extension';
  import {createSourceCandidateSession,sourceCandidateWindow,withSourceCandidateSelection} from '@metriccanvas/data-execution/runtime';
  import type {CandidatePageReader} from './filters/candidate-paging';
  let candidateSession:ReturnType<typeof createSourceCandidateSession>|undefined;
  import {initialFilterInputIssue} from './initial-filter-input';
  import {requestsRollingFinalization} from '../../runtime/src/filter-state';
  import { filterCandidatesRequest } from '../../runtime/src/filter-candidates';
  import { candidateScopeKey } from '../../runtime/src/dimension-values';
  import { createIocRegionDefault, pendingIocRegionURL, resolveIocRegionURL } from './ioc-region-default';
  import { createTableController } from './table/controller';
  import { createExportController } from './export-controller';
  import { type TableHeaderFilters, type TableQueryView, hasQueryFieldMapping } from '@metriccanvas/page/internal';
  import { applyTableSearch, remoteTableSearch } from './table/search';
  import { exportVisibleTable } from './table/export/task';
  import { tablePagination } from './table/pagination';
  import { singleExpandableParent } from '../../runtime/src/table/expansion';
  import { tick, untrack, setContext, onDestroy } from 'svelte';
  const rowScopeInstanceId = $props.id();
  import { initialSectionGroup, selectedSectionGroup, sectionGroupFor, visibleSections } from './section-navigation';
  import { initializeRenderablePage } from './page-inputs';
  import {
    canonicalizeJson,
    type Page,
    type TypedError
  } from '@metriccanvas/page';
  import {
    declaredNavigationTargets,
    parseRuntimePage,
    type NavigationTarget,
    filterGroupOptions,
    conditionSourceIds,
    dataSourceMode,
    derivePageCapabilities,
    fieldName,
    filterURLKeys,
    isChartComponent,
    resolveDataSourceFields,
    flattenPageComponents,
    candidateDependencies,
    type ChartComponent,
    type Component,
    type ComponentCapabilities,
    type DataSnapshot,
    type FieldReference,
    type FilterDeclaration,
    type MapChartProps,
    type OpenDetailAction,
    type Row,
    type TableColumn,
    type TableComponent,
    type TextLink,
    type NumberRangeValue,
    type TimeRangeValue
  } from '@metriccanvas/page/internal';
  import {
    createDimensionValuesLoader,
    createFilterState,
    resolveNavigationTarget,
    type NavigationInputContract,
    parseFilterSearch,
    type PageParamValues,
    initialFilterValues,
    orchestrate,
    resolvePageParams,
    type DimensionValuesSnapshots,
    type FilterState,
    type FilterValue,
    type FilterValues,
    type PageDataSnapshots,
    type PageSnapshotStream,
    type RuntimeDataGateway
  } from '../../runtime/src';
  import {
    buildTableColumnLayout,
    formatValue,
    initialTableSort,
    shouldApplyTableHeaderFilter,
    type NamedDataSlots,
    type TableHeaderFilterValue,
    type TablePaginationState,
    type TableSelectedCell,
    type TableViewState
  } from '../../widgets/src';
  import { reportExportScale } from '@metriccanvas/page/internal';
  import { withReportView } from './report-view';
  import { generateReportPng } from './report-png-client';
  import { REPORT_EXPORT_CONTEXT, reportExportFilename, downloadReportBlob, type ReportExportContext } from './report-export-context';
  import { downloadReportPdf } from './report-pdf-client';
  import { SUMMARY_EXPORT_CAPTURE, type SummaryCapture } from './export-render-state';
  import { ExportViewError } from '../../runtime/src/export-snapshots';
  import ComponentRenderer from './ComponentRenderer.svelte';
  import { initialTabsFromSearch } from './initial-tabs';
  import { initializeURLSearch, pageURLSearch, replaceRuntimeSearch } from './url-search';
  import DetailContent from './DetailContent.svelte';
  import { detailViewInput } from '../../runtime/src/detail-view';
  import { detailTitle } from './detail-title';
  import type { NestedComponentRender, TableRenderBinding } from './component-render';
  import {
    filterMapRows,
    isHierarchyDeclaration,
    resolveMapBasemap,
    resolveMapClick
  } from './map-hierarchy';
  import { REGION_MAP_CONTEXT, hasRegionMapRouting, regionMapCandidate, regionMapSelection, type RegionMapContext } from './region-map';
  import { collectDataErrors } from './data-error-events';
  import { runtimeVersionError } from './version-error';
  import { headerPeriod } from './report-date-header';
  import { collectFilterTextValueReferences, formatPeriod, resolveParamTextValues } from '@metriccanvas/page/internal';
  import {projectFieldSelections} from '@metriccanvas/page/internal';
  import {periodFactPage, filterTextPage } from './filter-text';
  import { validateCalendarTimeRange } from '@metriccanvas/page/internal';
  import {SOURCE_FILTER_CONTEXT,sourceFilterSelection,type SourceFilterReader} from './dashboard/source-filter-context';
  import { hierarchyTreeSnapshot } from './filters/hierarchy-tree';
  import FilterBar from './filters/FilterBar.svelte';
  import { compatibilityHeaderSection, leadingHeaderSectionId } from './ioc-header/render-plan';
  import { usesIocRegion } from '@metriccanvas/page/internal';
  import {resolvePageHeader,pageFiltersReadOnly} from './ioc-header/page-header';
  import {
    cascadeConstraints,
    cascadeContext,
    clearDependentUpdates,
    dimensionValueOf
  } from './filters/cascade';
  import { hasVisibleFilters } from './filters/filter-bar';
  import { changedFilters, resetFilteredTablePages, sortTableRows, filterTableRowsByHeaders } from './table/state';
  import { applySearchFilters } from './filters/inline-search';
  import { hostRenderSnapshot, displayDataSnapshot } from './widget-host-state';
  import RuntimeSection from './RuntimeSection.svelte';
  import { createRetainedScreenData, RETAINED_SCREEN_DATA } from './retained-screen-data';
  import { usableTableProgress } from './table/screen-progress';
  import { usableMapProgress } from './map-screen-progress';
  const retainedScreenData = createRetainedScreenData();
  setContext(RETAINED_SCREEN_DATA, retainedScreenData);
  import type { RuntimeSurfaceProps } from './composition-types';
  import {
    configurationError,
    isDataGateway,
    type RuntimeConfigurationError,
    type RuntimeNavigation,
    type RuntimeNavigationTarget,
    type RuntimeViewEvent
  } from './types';

  type PageCapabilities = ReturnType<typeof derivePageCapabilities>;
  type ComponentSnapshots = ReadonlyMap<string, DataSnapshot>;
  type PageState =
    | { phase: 'auth-required' }
    | { phase: 'loading' }
    | { phase: 'invalid'; errors: TypedError[] }
    | { phase: 'version-error'; error: Extract<RuntimeViewEvent, { type: 'version-error' }> }
    | { phase: 'configuration-error'; error: RuntimeConfigurationError }
    | {phase:'input-invalid';message:string}
    | { phase: 'ready'; page: Page; capabilities: PageCapabilities };

  // inline 页面不访问数据网关;候选值能力缺席即不可用,不需要抛错桩。
  const inlineGateway: RuntimeDataGateway = {
    async fetchData() {
      throw new Error('inline 页面不应访问数据网关');
    }
  };

  let {
    document,
    hostCanExport,
    displayInputs,
    sectionsContent,
    dataGateway,
    regionMap,
    aiSummary,
    initialSearch = '',
    navigation,
    filterEditing,
    onevent,
    onAuthRequired,
    pageRevisionId,
    execution
  }: RuntimeSurfaceProps = $props();

  const liveViewports = new Map<string, () => import('./region-map').MapViewport | undefined>();
  setContext<RegionMapContext>(REGION_MAP_CONTEXT, {
    adapter: () => regionMap,
    overrides: () => pageState.phase === 'ready' ? pageState.page.mapOverrides : undefined,
    capture(key,read) {
      liveViewports.set(key,read);
      return () => { if (liveViewports.get(key) === read) liveViewports.delete(key); };
    },
    selection: currentRegionMapSelection
  });

  let tabSelections = $state<Record<string, string>>({});
  let syncTabSearch: (selections: Record<string, string>) => void = () => {};
  let syncedTabSearch: (value: string) => string = value => value;
  setContext<TabSelectionContext>(TAB_SELECTION_CONTEXT, {
    selections: () => tabSelections,
    select: selectTab,
    selectFromMetric: selectTabFromMetric
  });

  function selectTab(componentId: string, tabId: string) {
    if (tabSelections[componentId] === tabId) return;
    tabSelections = { ...tabSelections, [componentId]: tabId };
    stream?.setActiveTabs(tabSelections);
    syncTabSearch(tabSelections);
  }
  const summaryCapture:SummaryCapture=new Map();
  setContext(SUMMARY_EXPORT_CAPTURE,summaryCapture);
  let tableExportStates = $state<Record<string, { busy: boolean; error?: string }>>({});
  const exportController = createExportController(next => tableExportStates = next);
  // ':' cannot occur in a component id; page tasks cannot collide with table exports.
  const pageExportTask = 'page:export';
  let reportExportMessage = $state('');
  let reportExportError = $state<string | undefined>();
  let reportExportActive = $state.raw<ReportExportContext['active']>();
  let reportExportGeneration = 0;
  const reportExport: ReportExportContext = {
    get busy() { return tableExportStates[pageExportTask]?.busy ?? false; },
    get active() { return reportExportActive; },
    get error() { return reportExportError; },
    get message() { return reportExportMessage; },
    async download(props, button) {
      if (reportExport.busy) return;
      const generation = ++reportExportGeneration;
      const filename = reportExportFilename(props, button);
      const scale = reportExportScale(button.format, button.scale);
      reportExportActive = button;
      reportExportError = undefined;
      reportExportMessage = '正在准备报告…';
      try {
        await prepareReport(async ({target, signal}) => {
          if (button.format === 'pdf') {
            await downloadReportPdf(target, signal, filename, (done, total) => {
              if (generation === reportExportGeneration) reportExportMessage = `正在生成 PDF（${done}/${total} 页）…`;
            }, scale);
          } else {
            const file = await generateReportPng(target, signal, reportExportScale('png', button.scale), (done, total) => {
              if (generation === reportExportGeneration) reportExportMessage = `正在生成图片（${Math.floor(done / total * 100)}%）…`;
            });
            signal.throwIfAborted();
            if (generation === reportExportGeneration) downloadReportBlob(surfaceRoot.ownerDocument, file.blob, filename);
          }
        }, scale);
      } catch (cause) {
        if (generation !== reportExportGeneration) return;
        if (!(cause instanceof ExportViewError && cause.code === 'EXPORT_CANCELLED')) {
          if (!(cause instanceof ExportViewError && cause.code === 'EXPORT_CHART_FAILED')) reportExportError = cause instanceof Error ? cause.message : '导出失败';
          console.error('[MetricCanvas][REPORT_EXPORT_FAILED] 报告导出失败', cause);
        }
      } finally {
        if (generation === reportExportGeneration) reportExportMessage = '';
      }
    }
  };
  setContext(REPORT_EXPORT_CONTEXT, reportExport);

  let tableController: ReturnType<typeof createTableController> | undefined;
  let tableRevision = $state(0);
  onDestroy(() => { reportExportGeneration++; exportController.reset(); tableController?.dispose(); closeDetail(false); });
  async function prepareReport<T>(consume:(view:{target:HTMLElement;signal:AbortSignal})=>Promise<T>,scale=2):Promise<T> {
    if(pageState.phase!=='ready'||!stream||!surfaceRoot)throw new ExportViewError('EXPORT_NOT_READY','页面实例尚未就绪');
    // Capture every runtime value before the first await; later interactions stay independent.
    if(declarationPage)projectFieldSelections({...declarationPage,detailViews:undefined},filterValues);
    const page=JSON.parse(JSON.stringify(pageState.page)) as Page;
    const summaries=Object.fromEntries([...summaryCapture].map(([id,get])=>{
      const value=get();
      return [id,value.status==='ready'?{...value}:{status:'empty' as const}];
    }));
    if (Object.keys(page.dataSources).some(id=>sourceBlocked(page,id))) throw new ExportViewError('EXPORT_NOT_READY','筛选待确认或候选未就绪，暂不能导出页面');
    const sourceCandidates=structuredClone(new Map(declarations.flatMap(filter=>filter.type==='dimension'&&filter.candidates?[[filter.id,sourceFilterCandidates(filter)] as const]:[])));
    const state={page,sourceCandidates,regionSelection:currentRegionMapSelection(),
      geography:structuredClone(regionMap?.geography),displayNames:structuredClone(regionMap?.displayNames),
      viewports:new Map(Array.from(liveViewports,([key,read]) => [key,read()] as const)),now:new Date(),displaySnapshot:structuredClone(displaySnapshot),filterRevision,currentYear:stream.captureComputeYear(),filters:structuredClone(new Map(filterValues)),snapshots:structuredClone(new Map(snapshots)),tables:JSON.parse(JSON.stringify(tableViews)),headerFilters:JSON.parse(JSON.stringify(appliedTableHeaderFilters)),summaries,sourceViews:stream.captureViews()};
    const queries=stream.captureQueries();
    const program=stream.getSourceProgram();
    return exportController.run(pageExportTask, controller => withReportView({state,queries,gateway:activeGateway,sourceRoot:surfaceRoot,controller,program,scale},consume));
  }
  let declarationPage:Page|undefined;
  let pageState = $state<PageState>({ phase: 'loading' });
  let initializing=$state(true);
  setContext(CHART_OPTION_PATHS, () => pageState.phase === 'ready' ? chartOptionPaths(pageState.page) : new Map<string, string>());
  function visibleValidationErrors(errors: TypedError[]): TypedError[] {
    for (const error of errors) if (isChartOptionError(error)) console.error('[MetricCanvas][CHART_OPTION_INVALID]', error);
    return errors.filter(error => !isChartOptionError(error));
  }
  let navigationMessage=$state('');
  let regionURLIssue=$state('');
  let targetInputs=$state(new Map<string,NavigationInputContract>());
  const targetInputKey=$derived(pageState.phase==='ready'?JSON.stringify([...new Set(declaredNavigationTargets(pageState.page).filter(t=>t.validateTargetInputs).map(t=>t.href))].sort()):'[]');
  $effect(()=>{
    const hrefs=JSON.parse(targetInputKey) as string[],provider=navigation?.resolveTargetInputs;
    const controller=new AbortController();targetInputs=new Map();
    if(provider)for(const href of hrefs)void Promise.resolve().then(()=>provider(href,{signal:controller.signal})).then(contract=>{
      if(!controller.signal.aborted&&contract)targetInputs=new Map(targetInputs).set(href,structuredClone(contract));
    }).catch(()=>{/* Unavailable target contracts keep guarded links closed. */});
    return()=>controller.abort();
  });

  let snapshots = $state<PageDataSnapshots>(new Map());
  let blockedFilters = $state<string[]>([]);
  let confirmationFilters = $state<string[]>([]);
  let preparingFilters = $state<string[]>([]);
  let initialPeriodModes = $state.raw<ReadonlyMap<string, PeriodMode>>(new Map());
  let chosenPendingPeriods = $state.raw<ReadonlyMap<string, PendingPeriodChoice>>(new Map());
  const pendingPeriodModes = $derived(visiblePendingPeriodModes(preparingFilters, initialPeriodModes, chosenPendingPeriods));
  let filterValues = $state<FilterValues>(new Map());
  let pageParams = $state<PageParamValues>(new Map());
  let sourceSnapshot=$state.raw<DisplaySnapshot|undefined>();
  const displaySnapshot=$derived(withExportPermission(sourceSnapshot, hostCanExport));
  setContext(TABLE_EXPORT_ALLOWED, () => hostCanExport !== false);
  let filterRevision=$state(0);
  const presentationProgram=$derived(pageState.phase==='ready'?compilePresentation(pageState.page):null);
  const presentation=$derived(presentationProgram?.evaluate({filters:filterValues,filterRevision,displaySnapshot},pendingPeriodModes)??null);
  setContext(PRESENTATION_CONTEXT,()=>presentation);
  $effect(()=>{
    void presentation;
    if(pageState.phase==='ready'){const page=pageState.page;untrack(()=>{stream?.syncPresentation?.();syncTableState(page);});}
  });
  let refreshPeriodFacts:((snapshot:DisplaySnapshot|undefined)=>void)|undefined;
  function clearDisplaySnapshot(){retainedScreenData.clear();sourceSnapshot=undefined;untrack(()=>refreshPeriodFacts?.(undefined));}
  let authInvalidated=false;
  let authNotified=false;
  let authPageId='';
  function receiveAuthRequired(event:AuthRequiredEvent){
    if(authInvalidated)return;
    const callback=untrack(()=>onAuthRequired);
    if(callback){
      authInvalidated=true;
      dispose();
      clearAuthData();
      pageState={phase:'auth-required'};
    }
    if(!authNotified){authNotified=true;notifyAuthRequired(untrack(()=>onevent),event);}
    if(callback)notifyAuthRequired(callback,event);
  }
  function clearAuthData(){
    invalidateAiSummaryPage(untrack(()=>aiSummary),authPageId);
    retainedScreenData.clear();summaryCapture.clear();
    snapshots=new Map();dimensionCandidates=new Map();filterValues=new Map();pageParams=new Map();
    tableViews={};appliedTableHeaderFilters={};tablePageSizes={};
    sourceSnapshot=undefined;declarationPage=undefined;declarations=[];
    blockedFilters=[];confirmationFilters=[];tabSelections={};initialTabs=new Map();
    targetInputs=new Map();activeGateway=inlineGateway;
  }
  $effect(()=>{
    const source=displayInputs;
    if(!source){clearDisplaySnapshot();return;}
    let stopped=false;
    const update=(snapshot:DisplaySnapshot)=>{
      if(stopped||authInvalidated)return;
      if(!snapshot||typeof snapshot.permissionRevision!=='string'||!snapshot.permissionRevision){clearDisplaySnapshot();return;}
      sourceSnapshot=snapshot;untrack(()=>refreshPeriodFacts?.(snapshot));
    };
    let unsubscribe=()=>{};
    try {
      unsubscribe=source.subscribe(update);
      update(source.getSnapshot());
    } catch {
      clearDisplaySnapshot();
    }
    return ()=>{stopped=true;unsubscribe();};
  });

  let initialTabs = $state<ReadonlyMap<string, string>>(new Map());
  /** 筛选候选值快照(维度名 → 显式状态):筛选控件与表头筛选共用。 */
  let dimensionCandidates = $state<DimensionValuesSnapshots>(new Map());
  function sourceFilterCandidates(declaration:Extract<FilterDeclaration,{type:'dimension'}>) {
    const context=cascadeContext(declaration,declarations,filterValues,filterCandidateContext());
    const levels=declaration.hierarchy;
    if(levels){
      const receipts=Object.fromEntries(levels.map(({id,dimension})=>[id,dimensionCandidates.get(candidateScopeKey(declaration.id,dimension,id,context)) ?? {status:'loading' as const}]));
      return hierarchyTreeSnapshot(levels,receipts);
    }
    return dimensionCandidates.get(candidateScopeKey(declaration.id,declaration.dimension,undefined,context)) ?? {status:'loading' as const};
  }
  function candidatePreloadScopeReady(declaration:Extract<FilterDeclaration,{type:'dimension'}>) {
    const dependencies = candidateDependencies(declaration);
    return declarations.every(filter => {
      if (!dependencies.includes(filter.id)) return true;
      if (filterValues.has(filter.id)) return true;
      if (filter.id === 'region') {
        const key = filterURLKeys(filter, !!declarationPage && usesIocRegion(declarationPage)).value;
        return key !== undefined && new URLSearchParams(appliedInput?.initialSearch).get(key) === '';
      }
      if (filter.type === 'timePoint' || filter.type === 'timeRange') return false;
      return true;
    });
  }
  function sourceFilterPagination(declaration:Extract<FilterDeclaration,{type:'dimension'}>):CandidatePageReader|undefined {
    const context = filterCandidateContext();
    const window = context.page && sourceCandidateWindow(context.page,declaration);
    if (!window) return;
    const gateway = activeGateway;
    const request = filterCandidatesRequest(declaration,declarations,filterValues,undefined,context);
    const waiting = initializing || preparationBlocksFilter(declaration,declarations,preparingFilters);
    const preload = !!declaration.defaultWhen && !waiting && !!gateway.fetchFilterCandidates && candidatePreloadScopeReady(declaration);
    const key = JSON.stringify([session,window.limit,waiting,context.displayInputs?.permissionRevision,cascadeContext(declaration,declarations,filterValues,context)]);
    return {key,filterId:declaration.id,sourceId:window.sourceId,limit:window.limit,preload,waiting,read:(offset,search,signal)=>{
      if (!gateway.fetchFilterCandidates) return Promise.resolve({kind:'unavailable'});
      return gateway.fetchFilterCandidates({...request,sourceRead:{kind:'page',offset,search}},{signal});
    }};
  }
  setContext<SourceFilterReader>(SOURCE_FILTER_CONTEXT,id=>{
    const declaration=declarations.find(filter=>filter.id===id);
    if(declaration?.type!=='dimension'||!declaration.candidates)return;
    return {declaration,...sourceFilterSelection(filterValues,id),candidates:sourceFilterCandidates(declaration),pagination:sourceFilterPagination(declaration),
      confirmation:confirmationFilters.includes(id),preparing:preparationBlocksFilter(declaration,declarations,preparingFilters),
      onchange:(values,level)=>writeDimension(declaration,values,level),onretry:()=>retryCandidates(id)};
  });
  let tableViews = $state<Record<string, TableViewState>>({});
  let selectedGroup = $state<string | undefined>();
  let surfaceRoot: HTMLDivElement;
  $effect(()=>{
    if(pageState.phase!=='ready'||!pageState.page.sectionGroups)return;
    const groups=pageState.page.sectionGroups.filter(group=>presentation?.groups.get(group.id)?.eligible!==false);
    const next=selectedSectionGroup({...pageState.page,sectionGroups:groups},selectedGroup);
    if(next!==selectedGroup)selectedGroup=next;
  });


  async function locateSection(page: Page, sectionId: string) {
    const currentSession = session;
    const targetGroup = sectionGroupFor(page, sectionId);
    if (targetGroup) selectedGroup = targetGroup;
    await tick();
    if (session !== currentSession) return;
    const target = Array.from(surfaceRoot.querySelectorAll<HTMLElement>('[data-section-id]'))
      .find(element => element.dataset.sectionId === sectionId);
    if (!target) return;
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  }
  let tablePageSizes = $state<Record<string, number>>({});
  let appliedTableHeaderFilters = $state<
    Record<string, TableHeaderFilters>
  >({});
  let activeGateway: RuntimeDataGateway = inlineGateway;
  let fetchMetricDefinitions = $state.raw<RuntimeDataGateway['fetchMetricDefinitions']>();

  let declarations = $state<FilterDeclaration[]>([]);
  let candidateClock=$state.raw(new Date());
  let resolvedFinalizationDates=$state.raw<ReadonlyMap<string,string>>();
  const timeContext=$derived({snapshot:displaySnapshot,revision:filterRevision,pending:preparingFilters,periodModes:pendingPeriodModes,initializing,finalizationDates:resolvedFinalizationDates});
  const candidateTimeContext=()=>({displayInputs:displaySnapshot,filterRevision,now:candidateClock});
  const filterCandidateContext=()=>({...candidateTimeContext(),page:pageState.phase==='ready'?pageState.page:undefined});
  let filterState: ReturnType<typeof createFilterState> | null = null;
  let candidatesLoader: ReturnType<typeof createDimensionValuesLoader> | null = null;
  let stream: PageSnapshotStream | null = null;
  const summaryRuntime: AiSummaryRuntimeReader = () => {
    if (pageState.phase !== 'ready'||initializing) return undefined;
    return { page: { ...pageState.page, sections: presentation?.sections ?? pageState.page.sections },
      pageRevision: pageRevisionId, documentKey: canonicalizeJson(document),
      filters: filterValues, queries: stream?.captureQueries() ?? new Map(), tabs: tabSelections };
  };
  setContext(AI_SUMMARY_RUNTIME_CONTEXT, summaryRuntime);
  let session = 0;
  let disposers: Array<() => void> = [];
  type SessionInput = Pick<RuntimeSurfaceProps, 'document' | 'dataGateway' | 'pageRevisionId' | 'execution'> & { initialSearch: string };
  let appliedInput: SessionInput | undefined;
  let pendingOffice: OfficeNavigationInput | undefined;

  $effect(() => {
    const next = { document, dataGateway, initialSearch, pageRevisionId, execution };
    const adapter = navigation;
    const emit = onevent;
    untrack(() => applySessionInput(next, adapter, emit));
  });
  onDestroy(dispose);

  function applySessionInput(next: SessionInput, adapter: RuntimeNavigation | undefined, emit: RuntimeSurfaceProps['onevent']) {
    // URL feedback can arrive before the destination document. Keep the source session live.
    if (appliedInput && pendingOffice
      && next.dataGateway === appliedInput.dataGateway
      && next.execution === appliedInput.execution
      && next.pageRevisionId === appliedInput.pageRevisionId
      && isOfficeNavigationFeedback(appliedInput.document, next.document, next.initialSearch, pendingOffice)) return;
    if (appliedInput) dispose();
    appliedInput = next;
    void run(next.document, next.dataGateway, next.initialSearch, adapter, emit, next.pageRevisionId, next.execution);
  }

  function dispose() {
    untrack(() => closeDetail(false));
    fetchMetricDefinitions = undefined;
    reportExportGeneration++;
    reportExportMessage = '';
    reportExportError = undefined;
    exportController.reset();
    tableController?.dispose();tableController=undefined;
    session += 1;
    for (const fn of disposers) fn();
    disposers = [];
    filterState = null;
    stream = null;
    pendingOffice = undefined;
  }

  function localFilterInitializationIssue(
    optionsById: ReadonlyMap<string,readonly string[]>, values: Map<string,FilterValue>,
    bootstrap: import('../../runtime/src').ExecutionBootstrap | undefined, strict: boolean
  ): TypedError | undefined {
    for (const [id, options] of optionsById) {
      const value = values.get(id);
      if (value && !singleOptionSelected(value, options)) {
        if (strict) return {type:'SCHEMA_ERROR',path:'/filters/'+id,message:'目标筛选取值不在可用候选中'};
        values.delete(id);
      }
      if (bootstrap && !singleOptionSelected(bootstrap.filters.get(id), options))
        return {type:'SCHEMA_ERROR',path:'/filters',message:'执行快照中的筛选按钮组值不在候选项中'};
    }
  }

  function singleOptionSelected(value: FilterValue | undefined, options: readonly string[]): boolean {
    return value?.type === 'dimension' && value.values.length === 1 && options.includes(value.values[0]!);
  }

  function failTimeInitialization(mySession:number, signal:AbortSignal, emit:((event:RuntimeViewEvent)=>void)|undefined) {
    if(session!==mySession||signal.aborted)return;
    pageState={phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message:'时间默认值或可信初始期间不符合声明精度和边界'}]};
    emit?.({type:'invalid',errors:pageState.errors});
  }

  async function run(
    raw: unknown,
    gatewayOverride: RuntimeDataGateway | undefined,
    search: string,
    navigationAdapter: RuntimeNavigation | undefined,
    emit: ((event: RuntimeViewEvent) => void) | undefined,
    revisionId: string | undefined,
    bootstrap: import('../../runtime/src').ExecutionBootstrap | undefined
  ) {
    if(authInvalidated)return;
    exportController.reset(); tableController?.dispose(); tableController=undefined;
    const mySession = ++session;
    filterRevision=0;
    initializing=true;
    pageState = { phase: 'loading' };navigationMessage='';regionURLIssue='';
    snapshots = new Map();
    filterValues = new Map();
    resolvedFinalizationDates=undefined;
    initialPeriodModes = new Map();
    chosenPendingPeriods = new Map();
    dimensionCandidates = new Map();
    tableViews = {};
    untrack(() => closeDetail(false));
    selectedGroup = undefined;
    tablePageSizes = {};
    appliedTableHeaderFilters = {};

    // 保持异步初始化接缝，避免外层 effect 把初始化中的状态读取纳入依赖。
    await Promise.resolve();
    if (session !== mySession || authInvalidated) return;
    candidateClock=new Date();

    if (bootstrap && canonicalizeJson(raw) !== canonicalizeJson(bootstrap.document)) {
      pageState = {phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/',message:'执行快照与页面文档不匹配'}]};
      emit?.({type:'invalid',errors:pageState.errors});
      return;
    }
    const versionIssue = runtimeVersionError(raw);
    if (versionIssue) {
      pageState = { phase: 'version-error', error: versionIssue };
      emit?.(versionIssue);
      return;
    }

    // 页面参数不可变:先按声明解析一次 URL 输入,再用它们把文本取值引用
    // 整值替换掉。首次解析只为读到 params 声明,替换后的文档才是渲染依据。
    const declared = parseRuntimePage(raw, undefined, diagnostics =>
      debugWarn('[MetricCanvas][PAGE_SCHEMA_CAPABILITY_FLOOR] 页面声明版本低于使用能力的引入版本', diagnostics));
    if (!declared.ok) {
      pageState = { phase: 'invalid', errors: visibleValidationErrors(declared.errors) };
      emit?.({ type: 'invalid', errors: declared.errors });
      return;
    }
    const paramDeclarations = declared.page.params ?? [];
    initialTabs = initialTabsFromSearch(declared.page, search);
    const params = bootstrap ? {values:bootstrap.params,missing:[]} : resolvePageParams(search, paramDeclarations,{strict:declared.page.strictURLInputs===true});
    pageParams = params.values;
    const parsed =
      paramDeclarations.length === 0
        ? declared
        : parseRuntimePage(raw, { textValues: { values: params.values, missingParams: new Set(params.missing), format: (value, format) => Array.isArray(value) ? value.join('、') : typeof value === 'object' ? formatPeriod(value) : formatValue(value, format) } });
    if (!parsed.ok) {
      pageState = { phase: 'invalid', errors: visibleValidationErrors(parsed.errors) };
      emit?.({ type: 'invalid', errors: parsed.errors });
      return;
    }

    let loaded: typeof parsed.page;
    try {
      loaded = nativeIocRuntimePage(initializeRenderablePage(parsed.page, params.values, params.missing),supportsMembershipCandidates(gatewayOverride));
      selectedGroup = initialSectionGroup(loaded, params.values);
    } catch {
      pageState = {phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/params',message:'页面参数无法生成合法查询条件或内容组，请检查输入值与窗口范围'}]};
      emit?.({type:'invalid',errors:pageState.errors});
      return;
    }
    tabSelections = initialTabSelections(loaded, search);
    syncedTabSearch = value => tabSearch(value, tabSelections, loaded);
    syncTabSearch = selections => {
      const nextSearch = tabSearch(search, selections, loaded);
      if (nextSearch === search.replace(/^\?/, '')) return;
      search = nextSearch;
      replaceRuntimeSearch(navigationAdapter, search);
      emit?.({ type: 'tab-change', search });
    };
    const mode = dataSourceMode(loaded.dataSources);
    const configIssue = configurationIssue(mode, gatewayOverride);
    if (configIssue) {
      pageState = { phase: 'configuration-error', error: configIssue };
      emit?.({ type: 'configuration-error', ...configIssue });
      return;
    }

    authPageId=loaded.id;
    const authGateway=createAuthRequiredGateway(gatewayOverride??inlineGateway,receiveAuthRequired);
    disposers.push(()=>authGateway.dispose());
    const nextCandidateSession=createSourceCandidateSession(loaded,authGateway.gateway,{displayInputs:()=>displaySnapshot,filterRevision:()=>filterRevision,clock:()=>candidateClock});
    inheritFinalizationCache(nextCandidateSession.gateway,authGateway.gateway);
    candidateSession=nextCandidateSession;activeGateway=nextCandidateSession.gateway;
    fetchMetricDefinitions = activeGateway.fetchMetricDefinitions;
    disposers.push(()=>{nextCandidateSession.dispose();if(candidateSession===nextCandidateSession)candidateSession=undefined;});

    const finalizationController = new AbortController();
    disposers.push(() => finalizationController.abort());

    retainedScreenData.select(loaded, gatewayOverride, revisionId);
    declarationPage=loaded;
    const capabilities = derivePageCapabilities(loaded);
    const textBindings = collectFilterTextValueReferences(resolveParamTextValues(raw, { values: params.values, missingParams: new Set(params.missing) }));
    declarations = loaded.filters ?? [];

    const message=initialFilterInputIssue(loaded,search,candidateClock);
    if(message){pageState={phase:'input-invalid',message};emit?.({type:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message}]});return;}
    // 旧数组参数的显式 value 固定本次输入；分组参数仍允许 URL 参数与独立筛选初始化。
    let fromURL:Map<string,FilterValue>, rollingInputs:ReadonlySet<string>, pendingRegion:ReturnType<typeof pendingIocRegionURL>;
    try{({fromURL,rollingInputs,pendingRegion}=readInitialFilterURL(loaded,search,candidateClock,
      capabilities.filters && !paramDeclarations.some(p => !p.path && p.value !== undefined),bootstrap));}
    catch{pageState={phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message:'时间模式URL必须为合法完整mode/from/to'}]};emit?.({type:'invalid',errors:pageState.errors});return;}
    const explicit=bootstrap?.filters??fromURL;
    const preparation=createFinalizationPreparation(loaded,activeGateway,explicit,candidateClock,finalizationController.signal,displaySnapshot,rollingInputs);
    const localOptions = filterGroupOptions(loaded);
    const localIssue = localFilterInitializationIssue(localOptions, fromURL, bootstrap, loaded.strictURLInputs === true);
    if (localIssue) {
      pageState = {phase:'invalid', errors:[localIssue]};
      emit?.({type:'invalid', errors:[localIssue]});
      return;
    }
    let fromDeclarations:Map<string,FilterValue>;
    try{fromDeclarations=initialFilterValues((loaded.filters??[]).filter(needsInitialFilterValue),candidateClock,displaySnapshot,0,undefined,explicit);}catch{failTimeInitialization(mySession,finalizationController.signal,emit);return;}
    function needsInitialFilterValue(filter: FilterDeclaration): boolean {
      return !fromURL.has(filter.id) && !preparation.unresolved.has(filter.id) && !(pendingRegion && filter.id === 'region');
    }
    filterValues=new Map([...fromDeclarations,...preparation.immediate]);
    const officeRedirect = officeNavigationTarget(loaded, filterValues.get('region'));
    initialPeriodModes = preparation.periodModes;
    preparingFilters=[...preparation.unresolved];
    tableController=createTableController(loaded,()=>stream,()=>syncTableState(loaded),()=>filterValues,candidateTimeContext,()=>({gateway:activeGateway,filters:filterValues,params:pageParams,blocked:initializing?declarations.map(filter=>filter.id):blockedFilters,displaySnapshot,filterRevision}));
    publishInitialPage(officeRedirect, loaded, textBindings, preparation.unresolved, capabilities);
    let finalizationDates:ReadonlyMap<string,string> | undefined;
    let initialFilters:FilterValues;
    try {
      const prepared = await prepareInitialNavigation(loaded, officeRedirect, preparation, bootstrap ? new Map() : fromDeclarations, mySession);
      if (!prepared) return;
      ({ finalizationDates, initialFilters } = prepared);
      resolvedFinalizationDates = finalizationDates;
    } catch {failTimeInitialization(mySession,finalizationController.signal,emit);return;}
    let state:ReturnType<typeof createFilterState>;
    try {
      state = createFilterState(initialFilters, declarations, localOptions, { schemaVersion:loaded.schemaVersion, iocRegion:usesIocRegion(loaded), candidates:true, displayInputs:()=>displaySnapshot,finalizationDates:()=>resolvedFinalizationDates,readOnly: () => filterEditing?.readOnly === true || pageFiltersReadOnly(loaded) });
    } catch {
      pageState={phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message:'筛选初始化值不符合声明或日期边界'}]};
      emit?.({type:'invalid',errors:pageState.errors});return;
    }
    state.configurePage(loaded);
    primePendingFilters();
    function primePendingFilters() {
      for (const id of preparation.pending) state.preparing(id, true);
      if (pendingRegion) state.preparing('region', true);
    }
    filterState = state;
    initializing=false;
    const regionDefault = createIocRegionDefault(loaded, search, initialFilters, !!bootstrap);
    let redirectingRegion = false;

    function loadCandidates(loader: NonNullable<typeof candidatesLoader>, values: FilterValues) {
      for (const declaration of declarations) {
        if (declaration.type !== 'dimension' || localOptions.has(declaration.id) || declaration.options) continue;
        if (declaration.candidates && regionDefault.waiting() && preparationBlocksFilter(declaration,declarations,['region'])) continue;
        loadDimensionCandidates(loader, declaration, values);
      }
    }

    function receiveCandidates(next:DimensionValuesSnapshots) {
        publishCandidateReceipts(next);
        if (pendingRegion) {
          resolvePendingRegion(pendingRegion, next);
          return;
        }
        const region = declarations.find(declaration => declaration.id === 'region');
        if (region?.type === 'dimension') {
          const waiting = regionDefault.waiting();
          const value = regionDefault.take(next, cascadeContext(region, declarations, filterValues, filterCandidateContext()));
          if (value) state.commit({ type: 'initialize', values: new Map([...filterValues, ['region', value]]) });
          else if (waiting && !regionDefault.waiting() && candidatesLoader) loadCandidates(candidatesLoader,filterValues);
        }
    }

    function publishCandidateReceipts(next: DimensionValuesSnapshots) {
      for (const declaration of declarations) {
        if (declaration.type !== 'dimension' || localOptions.has(declaration.id) || declaration.options) continue;
        const value = filterValues.get(declaration.id);
        const level = value?.type === 'dimension' ? value.level : declaration.defaultLevel ?? declaration.hierarchy?.[0]?.id;
        const dimension = declaration.hierarchy?.find(item => item.id === level)?.dimension ?? declaration.dimension;
        const receipt = next.get(candidateScopeKey(declaration.id,dimension,level,cascadeContext(declaration,declarations,filterValues,filterCandidateContext())));
        if(receipt&&receipt.status!=='idle'){
          const allowed=receipt.status==='ready'?receipt.candidates.filter(item=>!item.disabled&&(declaration.treeSelection!=='level'||item.level===level)).map(item=>item.value):undefined;
          state.candidate(declaration.id,receipt.status==='ready'&&!allowed?.length?'empty':receipt.status,allowed);
        }
      }
    }

    function resolvePendingRegion(input: NonNullable<typeof pendingRegion>, next: DimensionValuesSnapshots) {
      if (!state.preparation().has('region') || redirectingRegion) return;
      const context = cascadeContext(input.declaration, declarations, filterValues, filterCandidateContext());
      const resolved = resolveIocRegionURL(input, next, context);
      regionURLIssue = resolved && 'issue' in resolved ? resolved.issue : '';
      if (!resolved || 'issue' in resolved) return;
      const target = officeNavigationTarget(loaded, resolved.value);
      if (target) {
        if ([...preparation.pending].some(id => state.preparation().has(id))) return;
        redirectingRegion = true;
        navigateOffice(target, new Map([...filterValues, ['region', resolved.value]]), { replace: true, sourcePageId: loaded.id }, true);
        return;
      }
      state.completePreparation(new Map([['region', resolved.value]]));
    }

    let primed = false;
    function reconcileRegionInitialization(previous: FilterValues, values: FilterValues) {
      regionDefault.cancel(primed, changedFilters(previous, values).has('region'));
      if (!state.preparation().has('region')) regionURLIssue = '';
    }
    disposers.push(
      state.subscribe((values) => {
        const previous = filterValues;
        reconcileRegionInitialization(previous, values);
        filterValues = values;filterRevision=state.revision;candidateClock=state.clock();
        blockedFilters = [...state.blocked()];confirmationFilters=[...state.confirmation()];preparingFilters=[...state.preparation()];
        discardPreparingData(loaded,preparingFilters,values,stream?.getSourceProgram(),retainedScreenData);
        cancelBlockedExports(loaded);
        if (candidatesLoader && changedFilters(previous,values).size) {
          loadCandidates(candidatesLoader,values);
          receiveCandidates(dimensionCandidates);
        }
        const presentation = periodFactPage(filterTextPage(loaded, textBindings, values,state.preparation()),displaySnapshot,state.revision);
        declarations = presentation.filters ?? [];
        pageState = { phase: 'ready', page: presentation, capabilities };
        if (primed && capabilities.filters && changedFilters(previous,values).size > 0) {
          const nextSearch = syncedTabSearch(mergedSearch(state, search));
          search = nextSearch;
          replaceRuntimeSearch(navigationAdapter, nextSearch);
          emit?.({ type: 'filter-change', search: nextSearch,filterRevision:state.revision });
          try { bootstrap?.recordFilters?.(values); } catch { /* 记录失败不能回滚当前筛选或中止查询 */ }
          if (changedFilters(previous, values).size > 0) closeDetail(false);
          for (const component of flattenPageComponents({sections:loaded.sections})) if(component.type==='table') tableController?.reset(component,previous,values);
        }
        primed = true;
        syncTableState(loaded);
      })
    );

    search = initialSearchWithFinalization(loaded, state, preparation, search, navigationAdapter);
    syncTableState(loaded);
    pageState = { phase: 'ready', page: periodFactPage(filterTextPage(loaded, textBindings, filterValues,state.preparation()),displaySnapshot,state.revision), capabilities };

    const pageStream = orchestrate(
      loaded,
      activeGateway,
      capabilities.filters ? state : undefined,
      revisionId !== undefined ? { pageRevisionId: revisionId } : undefined,
      bootstrap,{displayInputs:()=>displaySnapshot,filterRevision:()=>state.revision,clock:()=>state.clock(),candidateSession:nextCandidateSession}, tabSelections
    );
    stream = pageStream;
    const emittedDataErrors = new Map<string, string>();
    disposers.push(
      pageStream.subscribe((next) => {
        if(session!==mySession)return;
        snapshots = next;
        syncTableState(loaded);
        // 结构化查询错误上抛为嵌入事件,宿主按分类决定重试或重登(issue #51)。
        for (const event of collectDataErrors(emittedDataErrors, next)) {
          emit?.(event);
        }
      })
    );
    void preparation.resolve().then(dates=>{
      if(session!==mySession||finalizationController.signal.aborted)return;
      finalizationDates=dates;
      resolvedFinalizationDates=dates;
      applyPendingPeriods(state, loaded, dates);
      state.completePreparation(preparation.values(dates, state.preparation()));
      emit?.({type:'ready',pageId:loaded.id});
    }).catch(()=>{
      if(session!==mySession||finalizationController.signal.aborted)return;
      const errors:TypedError[]=[{type:'SCHEMA_ERROR',path:'/filters',message:'定稿日期无法生成合法的时间默认值'}];
      pageState={phase:'invalid',errors};emit?.({type:'invalid',errors});
    });
    const pendingInitial=new Set(declarations.filter(f=>(f.type==='timePoint'||f.type==='timeRange')&&f.availability?.initial&&!filterValues.has(f.id)&&!fromURL.has(f.id)).map(f=>f.id));
    let periodKey=canonicalizeJson([displaySnapshot?.periods??{},displaySnapshot?.timeZone??null]);
    refreshPeriodFacts=next=>{
      if(session!==mySession)return;
      const key=canonicalizeJson([next?.periods??{},next?.timeZone??null]);if(key===periodKey)return;periodKey=key;
      // Invalidate authorizing receipts before publishing a new fact context.
      for(const declaration of declarations)if(declaration.type==='dimension'&&declaration.candidateWindow)state.candidate(declaration.id,'loading');
      let defaults:Map<string,FilterValue>;try{defaults=initialFilterValues(declarations,new Date(),displaySnapshot,state.revision,finalizationDates);}catch{defaults=new Map();}
      const seeded=new Map(filterValues);
      for(const id of pendingInitial){if(filterValues.has(id)){pendingInitial.delete(id);continue;}const value=defaults.get(id);if(value){seeded.set(id,value);pendingInitial.delete(id);}}
      if(seeded.size!==filterValues.size)state.commit({type:'initialize',values:seeded});
      state.refreshContext();
      if(candidatesLoader)for(const declaration of declarations)if(declaration.type==='dimension'&&declaration.candidateWindow)loadDimensionCandidates(candidatesLoader,declaration,filterValues);
    };
    disposers.push(()=>{refreshPeriodFacts=undefined;});

    if (!capabilities.filters) return;

    // 筛选候选值:显式状态经加载器发布,dispose 时取消在途请求,
    // 过期结果不会覆盖新会话的筛选状态(issue #54)。
    candidatesLoader = createDimensionValuesLoader(activeGateway);
    const loader = candidatesLoader;
    disposers.push(() => {
      loader.dispose();
      if (candidatesLoader === loader) candidatesLoader = null;
    });
    disposers.push(
      loader.subscribe((next) => {
        if (session !== mySession) return;
        dimensionCandidates = next;
        receiveCandidates(next);
      })
    );

    loadCandidates(loader,filterValues);


  }

  function publishInitialPage(redirect: NavigationTarget | undefined, page: Page, bindings: Parameters<typeof filterTextPage>[1], pending: ReadonlySet<string>, capabilities: PageCapabilities) {
    if (redirect) return;
    pageState = { phase: 'ready', page: periodFactPage(filterTextPage(page, bindings, filterValues, pending), displaySnapshot, 0), capabilities };
  }

  async function prepareInitialNavigation(page: Page, redirect: NavigationTarget | undefined, preparation: ReturnType<typeof createFinalizationPreparation>, defaults: Map<string, FilterValue>, mySession: number) {
    const finalizationDates = await (redirect && preparation.unresolved.size ? preparation.resolve() : preparation.initialDates());
    if (mySession !== session || authInvalidated) return;
    const restored = finalizationDates ? preparation.values(finalizationDates) : [];
    const initialFilters = new Map([...defaults, ...restored, ...preparation.immediate]);
    if (redirect) {
      navigateOffice(redirect, initialFilters, { replace: true, sourcePageId: page.id });
      return;
    }
    return { finalizationDates, initialFilters };
  }

  function initialSearchWithFinalization(page: Page, state: FilterState, preparation: ReturnType<typeof createFinalizationPreparation>, search: string, navigationAdapter?: RuntimeNavigation): string {
    const initial = initializeURLSearch(page, search, navigationAdapter);
    if (!preparation.deferred.size || preparation.pending.size) return initial;
    const next = mergedSearch(state, initial);
    if (next !== initial) replaceRuntimeSearch(navigationAdapter, next);
    return next;
  }

  function configurationIssue(
    mode: ReturnType<typeof dataSourceMode>,
    gatewayValue: unknown
  ): RuntimeConfigurationError | null {
    if (gatewayValue !== undefined && !isDataGateway(gatewayValue)) {
      return configurationError(
        'DATA_GATEWAY_INVALID',
        '数据网关必须实现 fetchData；候选值和指标定义端口可选，声明时必须为函数。'
      );
    }
    if (mode === 'inline') return null;
    if (gatewayValue === undefined) {
      return configurationError(
        'DATA_GATEWAY_REQUIRED',
        `${mode} 页面必须提供数据网关。`
      );
    }
    return null;
  }

  function pageComponents(loaded: Page): Component[] {
    return flattenPageComponents(loaded);
  }

  function componentCapability(component: Component): ComponentCapabilities | undefined {
    return pageState.phase === 'ready'
      ? pageState.capabilities.components[component.id]
      : undefined;
  }

  function syncTableState(loaded: Page) {
    if (!tableController) return;
    const captured=tableController.captureTables(loaded.sections);
    tableViews=captured.views;appliedTableHeaderFilters=captured.headers;tablePageSizes=captured.pageSizes;
    tableRevision+=1;
  }
  function cancelBlockedExports(page:Page):void {
    if(!blockedFilters.length)return;
    for(const component of flattenPageComponents(page))if(component.type==='table'&&sourceBlocked(page,component.data.main))exportController.cancel(component.id);
    if(Object.keys(page.dataSources).some(id=>sourceBlocked(page,id)))exportController.cancel(pageExportTask);
  }
  function sourceBlocked(page: Page, sourceId: string): boolean {
    if(stream?.getSourceProgram()?.preparing(sourceId,filterValues))return true;
    return [...conditionSourceIds(page,sourceId)].some(id => {
      return nativeSourceFilterIds(page,id,supportsMembershipCandidates(activeGateway)).some(id=>blockedFilters.includes(id));
    });
  }
  async function exportTable(component: TableComponent) {
    if(initializing || hostCanExport === false)return;
    if(pageState.phase!=='ready'||!stream||!component.props.toolbar?.export||!actionAllowed(component,component.props.toolbar.export))return;
    tableController?.syncColumns(component);
    const projected=tableController?.project(component)??component;
    if(!projected.props.columns.length)return;
    await exportVisibleTable({page:pageState.page,component:projected,stream,gateway:activeGateway,controller:exportController,params:pageParams,
      blocked:sourceBlocked(pageState.page,component.data.main)||!!(component.props.rowExpansion?.selection&&blockedFilters.includes(component.props.rowExpansion.selection.filter)),
      state:{now:new Date(),displaySnapshot,filterRevision,currentYear:stream.captureComputeYear(),filters:filterValues,tables:tableViews,headerFilters:appliedTableHeaderFilters}});
  }

  function tableSelectedCell(component: TableComponent): TableSelectedCell | undefined {
    const columns = buildTableColumnLayout(component.props.columns).leaves;
    const rows = visibleTableRows(component);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]!;
      for (const column of columns) {
        if (!column.selection) continue;
        const matches = Object.entries(column.selection.writes).every(
          ([filterId, write]) => {
            const current = filterValues.get(filterId);
            const declaration = declarations.find(item => item.id === filterId);
            const level = declaration?.type === 'dimension' ? hierarchyLevelOf(declaration, write.level)?.id : undefined;
            const expected =
              'field' in write ? row[fieldName(write.field)] : write.value;
            return (
              current?.type === 'dimension' &&
              (level === undefined || current.level === level) &&
              expected != null &&
              current.values.length === 1 &&
              current.values[0] === String(expected)
            );
          }
        );
        if (matches) return { rowIndex, columnField: fieldName(column.field) };
      }
    }
    return undefined;
  }

  function handleTableCellSelect(
    component: TableComponent,
    rowIndex: number,
    column: TableColumn,
    clickedRow?:Row
  ) {
    if (!column.selection || !componentCapability(component)?.actions) return;
    const currentRows=visibleTableRows(component);
    const row=clickedRow?resolvePresentationRow(component,currentRows,clickedRow):currentRows[rowIndex];
    if (!row || !actionAllowed(component,column.selection,row)) return;

    const updates: Array<readonly [string, FilterValue | null]> = [];
    for (const [filterId, write] of Object.entries(column.selection.writes)) {
      const declaration = declarations.find((candidate) => candidate.id === filterId);
      const raw = 'field' in write ? row[fieldName(write.field)] : write.value;
      if (declaration?.type !== 'dimension' || raw == null) return;
      const level = hierarchyLevelOf(declaration, write.level);
      updates.push([
        filterId,
        {
          type: 'dimension',
          dimension: level?.dimension ?? declaration.dimension,
          ...(level ? { level: level.id } : {}),
          values: [String(raw)]
        }
      ]);
    }
    filterState?.writeMany(updates);
  }

  function readInitialFilterURL(page:Page,search:string,clock:Date,enabled:boolean,bootstrap:import('../../runtime/src').ExecutionBootstrap|undefined) {
    if(!enabled)return {fromURL:new Map<string,FilterValue>(),rollingInputs:new Set<string>()};
    const rollingInputs=new Set<string>(), query=new URLSearchParams(search);
    const pendingRegion = bootstrap ? undefined : pendingIocRegionURL(page, search);
    const filters=(page.filters??[]).filter(filter=>{
      if (pendingRegion && filter.id === 'region') return false;
      if(bootstrap||!requestsRollingFinalization(filter,query))return true;
      rollingInputs.add(filter.id);
      return false;
    });
    const fromURL = new Map(parseFilterSearch(search, filters, clock, usesIocRegion(page)));
    return { fromURL, rollingInputs, pendingRegion };
  }

  function mergedSearch(state: FilterState, initial: string): string {
    const params = new URLSearchParams(pageURLSearch(declarationPage!, initial, navigation?.preserveSearchParams));
    for (const declaration of declarations) {
      if (preparingFilters.includes(declaration.id)) continue;
      for (const key of Object.values(filterURLKeys(declaration,!!declarationPage&&usesIocRegion(declarationPage)))) params.delete(key);
    }
    for (const [key, value] of new URLSearchParams(state.toURL(declarations))) params.append(key, value);
    return params.toString();
  }

  function writeDimension(
    declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
    values: string[],
    level?: string
  ) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    const dimension =
      declaration.hierarchy && level
        ? (declaration.hierarchy.find((item) => item.id === level)?.dimension ??
          declaration.dimension)
        : declaration.dimension;
    filterState?.write(declaration.id, values.length || declaration.treeSelection==='level' || declaration.hierarchy&&level ? {type:'dimension',dimension,values,...(level ? {level} : {})} : null);
  }

  function selectHeaderDimension(declaration: Extract<FilterDeclaration, { type: 'dimension' }>, values: string[], level?: string) {
    if (pageState.phase === 'ready' && declaration.id === 'region') {
      const region: FilterValue = { type: 'dimension', dimension: declaration.dimension, values, level };
      const target = officeNavigationTarget(pageState.page, region);
      if (target) {
        navigateOffice(target, new Map([...filterValues, ['region', region]]));
        return;
      }
    }
    writeDimension(declaration, values, level);
  }

  function choosePendingPeriod(filterId: string, choice: PendingPeriodChoice) {
    if (resolvedFinalizationDates || !filterState) return;
    chosenPendingPeriods = new Map(chosenPendingPeriods).set(filterId, choice);
    filterState.preparing(filterId, true);
  }

  function applyPendingPeriods(state: ReturnType<typeof createFilterState>, page: Page, dates: ReadonlyMap<string, string>) {
    const pending = state.preparation();
    const now = state.clock();
    const chosen = (page.filters ?? []).flatMap(filter => {
      const choice = chosenPendingPeriods.get(filter.id);
      return filter.type === 'timeRange' && choice && pending.has(filter.id)
        ? [[filter.id, resolvePendingPeriodChoice(filter, choice, dates, now)] as const] : [];
    });
    chosenPendingPeriods = new Map();
    if (!chosen.length) return;
    const result = state.commit({ type: 'applyDraft', changes: chosen });
    if (!result.ok) for (const [id] of chosen) {
      if (!initialPeriodModes.has(id)) state.preparing(id, false);
    }
  }

  function writeTimeRange(filterId: string, range: TimeRangeValue | null) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    const declaration = declarations.find(f=>f.id===filterId);
    if (declaration?.type !== 'timeRange' || (!range && declaration.required) || (range && validateCalendarTimeRange(range,range.mode==='month'?'month':declaration.precision ?? 'date').length)) return;
    filterState?.write(filterId, range ? { type: 'timeRange', ...range } : null);
  }

  function writeTimePoint(
    filterId: string,
    granularity: 'month' | 'date',
    value: string | null
  ) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    const declaration = declarations.find(f=>f.id===filterId);
    if (!value && declaration?.type === 'timePoint' && declaration.required) return;
    filterState?.write(filterId, value ? { type: 'timePoint', granularity, value } : null);
  }

  function writeBoolean(filterId: string, checked: boolean) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    const declaration=declarations.find(item=>item.id===filterId);
    if(declaration?.type!=='boolean' || !presentation?.gate(declaration).enabled) return;
    filterState?.write(filterId, { type: 'boolean', value: checked });
  }

  function writeNumberRange(filterId: string, range: NumberRangeValue | null) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, range ? { type: 'numberRange', ...range } : null);
  }

  function writeSearch(filterId: string, query: string) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, query.trim() === '' ? null : { type: 'search', query });
  }

  function loadDimensionCandidates(
    loader: NonNullable<typeof candidatesLoader>,
    declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
    values: FilterValues,
    force=false
  ) {
    const input = filterCandidateContext();
    if (!needsDimensionCandidates(declaration, input.page)) return;
    const context=cascadeContext(declaration,declarations,values,input);
    const levels=declaration.hierarchy?.map(level=>level.id)??[undefined];
    for(const level of levels){
      if(declaration.candidates||declaration.candidateContext||declaration.treeSelection==='level'||declaration.candidateWindow){
        let request:ReturnType<typeof filterCandidatesRequest>;
        try {
          request = withSourceCandidateSelection(input.page,declaration,values,filterCandidatesRequest(declaration,declarations,values,level,input));
        } catch {
          const dimension = declaration.hierarchy?.find(item=>item.id===level)?.dimension ?? declaration.dimension;
          loader.unavailable(dimension,{filterId:declaration.id,level,context});
          continue;
        }
        if(force)candidateSession?.invalidate(request);
        loader.loadFilter(request,context,declaration.treeSelection==='level'?declaration.hierarchy?.map(item=>item.id):undefined,force);
      }else{
        const dimension=declaration.hierarchy?.find(item=>item.id===level)?.dimension??declaration.dimension;
        const scope={filterId:declaration.id,level,context};
        const constraints = cascadeConstraints(declaration,declarations,values,input.page);
        if(force)loader.reload(dimension,constraints,scope);
        else loader.load(dimension,constraints,scope);
      }
    }
  }

  function needsDimensionCandidates(declaration: Extract<FilterDeclaration, {type:'dimension'}>, page: Page | undefined): boolean {
    if (declaration.options || preparationBlocksFilter(declaration,declarations,preparingFilters)) return false;
    // Paged exclusions have display labels and require no selection membership receipt.
    return !(declaration.defaultWhen && page && sourceCandidateWindow(page, declaration));
  }

  function retryCandidates(id:string) {
    const declaration=declarations.find(item=>item.id===id);
    if(candidatesLoader && declaration?.type==='dimension')loadDimensionCandidates(candidatesLoader,declaration,filterValues,true);
  }

  function actionAllowed(component:Component,action:import('@metriccanvas/page/internal').PolicyNode,row?:Row):boolean {
    return !initializing&&presentation?.gate(action,row,presentation.component(component.id)).enabled===true;
  }
  function componentNavigation(component: Component, row: Row): NavigationTarget | undefined {
    if (!componentCapability(component)?.actions || !('actions' in component.props)) return undefined;
    const action = component.props.actions?.find(candidate =>
      'navigate' in candidate && actionAllowed(component, candidate, row) && actionAllowed(component, candidate.navigate, row)
    );
    return action && 'navigate' in action ? action.navigate : undefined;
  }
  function componentHref(component: Component, row: Row): string | undefined {
    const target = componentNavigation(component, row);
    return target ? targetHref(target, row) : undefined;
  }

  function handleTableLink(component: TableComponent, row: Row, event: MouseEvent, column?: TableColumn) {
    if(component.props.rowKey){
      const current=resolvePresentationRow(component,visibleTableRows(component),row);
      if(!current){event.preventDefault();return;}
      row=current;
    }
    if(column&&!tableInteractionGate(component,row,column).enabled){event.preventDefault();return;}
    const target = tableColumnNavigation(column, row);
    if (target && actionAllowed(component,target,row)) {
      navigateTarget(target,row,event);
      return;
    }
    if (column?.openDetail && actionAllowed(component,column.openDetail,row)) {
      event.preventDefault();
      openDetailFor(component, { on: 'click', openDetail: column.openDetail }, row, event.currentTarget as HTMLElement);
      return;
    }
    const action = 'actions' in component.props ? component.props.actions?.find(a=>'navigate' in a) : undefined;
    if(action&&'navigate' in action){navigateTarget(action.navigate,row,event);return;}
    // 没有 navigate 的链接列：点击进入页内详情（ADR-0087），不跳走。
    const detail = componentOpenDetail(component);
    if (detail) {
      event.preventDefault();
      openDetailFor(component, detail, row, event.currentTarget as HTMLElement);
    }
  }

  function handleMetricLink(component: Component, row: Row, event: MouseEvent) {
    const target = componentNavigation(component, row);
    if (target) {
      navigateTarget(target, row, event);
      return;
    }
    event.preventDefault();
    const detail = componentOpenDetail(component);
    if (detail) openDetailFor(component, detail, row, event.currentTarget as HTMLElement);
  }

  function componentOpenDetail(component: Component): OpenDetailAction | undefined {
    if (!componentCapability(component)?.actions || !('actions' in component.props)) {
      return undefined;
    }
    return component.props.actions?.find(
      (action): action is OpenDetailAction => 'openDetail' in action
    );
  }

  /**
   * 页内详情浮层（ADR-0087）：读被点那一行，不离开当前页。同时只存在一个，
   * 因此是单个状态而不是按组件归集。
   */
  let openDetail = $state<
    | {
        surface: 'modal' | 'drawer';
        title: string;
        items?: Array<{ label: string; value: string }>;
        view?: NonNullable<Page['detailViews']>[number];
        page?: Page;
        error?: string;
      }
    | undefined
  >(undefined);
  let detailHasTable = $derived(openDetail?.view?.components.some(component => component.type === 'table') ?? false);
  let detailSnapshots = $state<PageDataSnapshots>(new Map());
  let detailFilters=$state<FilterValues>(new Map());
  let detailOrigin=$state.raw<{component:Component;row:Row;action:OpenDetailAction}|undefined>();
  $effect(()=>{
    const origin=detailOrigin;
    if(!origin||!openDetail||!presentation)return;
    if(!actionAllowed(origin.component,origin.action,origin.row)||!actionAllowed(origin.component,origin.action.openDetail,origin.row)) {closeDetail(false);return;}
    if(origin.component.type==='table'&&origin.component.props.rowKey){
      if(!resolvePresentationRow(origin.component,visibleTableRows(origin.component),origin.row))closeDetail(false);
    }
  });
  let detailGeneration = $state(0);
  let detailDispose: (() => void) | undefined;
  let detailTrigger: HTMLElement | undefined;
  let detailDialog: HTMLDialogElement | undefined;

  function mountDetailDialog(dialog: HTMLDialogElement) {
    detailDialog = dialog;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-detail-close]')?.focus();
    return { destroy() {
      dialog.close();
      if (detailDialog === dialog) detailDialog = undefined;
    } };
  }

  function cancelDetail(event: Event) {
    event.preventDefault();
    closeDetail();
  }

  function dismissDetailBackdrop(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    const panel = (event.currentTarget as HTMLDialogElement).getBoundingClientRect();
    if (event.clientX < panel.left || event.clientX > panel.right ||
        event.clientY < panel.top || event.clientY > panel.bottom) closeDetail();
  }

  function trapDetailFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const panel = event.currentTarget as HTMLDialogElement;
    const controls = Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex="0"], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )).filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    const active = (panel.getRootNode() as Document | ShadowRoot).activeElement;
    if (first && ((!event.shiftKey && active === last) || (event.shiftKey && active === first) || !panel.contains(active))) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }

  function resolveDetailTrigger(component: Component, trigger?: HTMLElement): HTMLElement | undefined {
    const root = surfaceRoot.getRootNode() as Document | ShadowRoot;
    const sourceCell = Array.from(surfaceRoot.querySelectorAll<HTMLElement>('[data-component]'))
      .find(element => element.dataset.component?.split('/').at(-1) === component.id);
    if (sourceCell && !sourceCell.hasAttribute('tabindex')) sourceCell.tabIndex = -1;
    return trigger ?? sourceCell ?? (root.activeElement instanceof HTMLElement ? root.activeElement : undefined);
  }

  function closeDetail(restoreFocus = true) {
    detailDialog?.close();
    detailGeneration += 1;
    detailDispose?.();
    detailDispose = undefined;
    openDetail = undefined;
    detailOrigin=undefined;
    detailSnapshots = new Map();
    if (restoreFocus && detailTrigger?.isConnected) detailTrigger.focus();
    detailTrigger = undefined;
  }

  function detailValue(row: Row, reference: FieldReference): string {
    return formatValue(row[fieldName(reference)]);
  }

  function openDetailFor(component: Component, action: OpenDetailAction, row: Row, trigger?: HTMLElement) {
    if(!actionAllowed(component,action,row)||!actionAllowed(component,action.openDetail,row))return;
    untrack(() => closeDetail(false));
    detailOrigin={component,row,action};
    detailTrigger = resolveDetailTrigger(component, trigger);
    const detail = action.openDetail;
    openDetail = {
      surface: detail.surface,
      title: detailTitle(detail, row, componentTitle(component) ?? '详情'),
      items: 'fields' in detail ? detail.fields.map((item) => ({
        label: item.label,
        value: detailValue(row, item.field)
      })) : undefined
    };
    if ('view' in detail && pageState.phase === 'ready') {
      const page = declarationPage??pageState.page;
      const view = page.detailViews?.find(candidate => candidate.id === detail.view);
      openDetail = { ...openDetail, view };
      try {
        const input = detailViewInput(page, action, row, filterValues, pageParams);
        if(preparationBlocksPage(input.page,preparingFilters))throw new Error('详情依赖的统计期间尚未就绪');
        openDetail = { ...openDetail, view:view?{...view,components:input.page.sections[0]!.components}:undefined, page: input.page };
        detailFilters=input.filters;
        if (view?.mode === 'query') {
          const generation = detailGeneration;
          detailDispose = orchestrate(input.page, activeGateway, createFilterState(input.filters, input.page.filters ?? [], new Map(), {schemaVersion:input.page.schemaVersion})).subscribe(value => {
            if (generation === detailGeneration && openDetail) detailSnapshots = value;
          });
        } else detailSnapshots = snapshots;
      } catch {
        openDetail = { ...openDetail, error: '详情参数不完整或无效，请重新选择。' };
      }
    }
  }

  function componentTitle(component: Component): string | undefined {
    const title = (component.props as { title?: unknown }).title;
    return typeof title === 'string' ? title : undefined;
  }

  function handleChartClick(component: Component, row: Row) {
    if (!componentCapability(component)?.actions || presentation?.component(component.id).enabled===false) return;
    if (component.type === 'mapChart' && handleMapHierarchyClick(component, row)) return;
    const actions=component.type==='button'?[component.props.action]:('actions' in component.props?component.props.actions??[]:[]);
    for (const action of actions) {
      if(!actionAllowed(component,action,row))continue;
      if ('navigate' in action) {
        if(!actionAllowed(component,action.navigate,row))continue;
        navigateTarget(action.navigate,row);
        return;
      }
      if ('openDetail' in action) {
        if(!actionAllowed(component,action.openDetail,row))continue;
        openDetailFor(component, action, row);
        return;
      }
      writeChartFilter(component, action, row);
    }
  }

  function regionMapActive() {
    return pageState.phase === 'ready' && (hasRegionMapRouting(regionMap) || !!pageState.page.mapOverrides) && usesIocRegion(pageState.page);
  }

  function currentRegionMapSelection() {
    if (pageState.phase !== 'ready' || !usesIocRegion(pageState.page)) return;
    const selected = regionMapSelection(filterValues.get('region'));
    if (!selected) return;
    const declaration = declarations.find(item => item.id === 'region');
    if (!isHierarchyDeclaration(declaration)) return;
    if (regionMapCandidate(sourceFilterCandidates(declaration), selected.level, selected.value)) return selected;
  }

  function selectRegionFromMap(
    declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
    level: 'region-dept' | 'office',
    value: unknown,
    parent?: { value: unknown }
  ) {
    if (initializing || pageState.phase !== 'ready' || filterEditing?.readOnly || pageFiltersReadOnly(pageState.page)) return;
    const node = regionMapCandidate(sourceFilterCandidates(declaration), level, value, parent);
    if (node) selectHeaderDimension(declaration, [node.value], level);
  }

  function handleMapHierarchyClick(component: Extract<Component, { type: 'mapChart' }>, row: Row): boolean {
    const props = component.props;
    if (!props.hierarchyFilter) return false;
    const declaration = declarations.find(item => item.id === props.hierarchyFilter);
    if (!isHierarchyDeclaration(declaration)) return false;
    const value = filterValues.get(declaration.id);
    if (declaration.id === 'region' && regionMapActive() && props.parentField && props.codeField &&
        value?.type === 'dimension' && (value.level === 'region-dept' || value.level === 'office')) {
      selectRegionFromMap(declaration, 'office', row[fieldName(props.codeField)], { value: row[fieldName(props.parentField)] });
      return true;
    }
    const decision = resolveMapClick(props, declaration, value, row);
    if (decision.kind === 'drill') writeDimension(declaration, decision.value.values, decision.value.level);
    return decision.kind !== 'navigate';
  }

  function writeChartFilter(
    component: Component,
    action: Extract<NonNullable<MapChartProps['actions']>[number], { writeFilter: string }>,
    row: Row
  ) {
    const clicked = 'field' in action ? row[fieldName(action.field)] : action.value;
    const target = declarations.find(declaration => declaration.id === action.writeFilter);
    if (clicked == null || target?.type !== 'dimension') return;
    const level = action.level;
    if (component.type === 'mapChart' && target.id === 'region' && regionMapActive() &&
        (level === 'region-dept' || level === 'office')) {
      selectRegionFromMap(target, level, clicked);
      return;
    }
    filterState?.write(action.writeFilter, {
      type: 'dimension',
      dimension: target.dimension,
      ...(target.hierarchy ? { level: level ?? dimensionValueOf(filterValues,target.id).level ?? target.defaultLevel ?? target.hierarchy[0]?.id } : {}),
      values: [String(clicked)]
    });
  }

  function headerTitleLink(model:import('./ioc-header/model').ResolvedIocHeader) {
    const target=model.titleNavigate;
    if(!target || presentation?.gate(target).eligible===false)return;
    return {...textLink({...target,label:model.title??''}),disabled:presentation?.gate(target).enabled===false};
  }

  function textLink(link: TextLink) {
    return { label: link.label, href:targetHref(link), onclick: (event: MouseEvent) => navigateTarget(link,{},event) };
  }

  function targetResult(target:NavigationTarget,row:Row={},filters=filterValues,verifiedRegion=false) {
    if(target.validateTargetInputs&&Object.values(target.query??{}).some(b=>b.source==='filter'&&blockedFilters.includes(b.id)&&!(verifiedRegion&&b.id==='region')))return {ok:false as const,code:'NAVIGATION_INPUT_INVALID' as const,message:'来源筛选尚未通过当前候选确认'};
    const result=resolveNavigationTarget(target,filters,pageParams,row,targetInputs.get(target.href),candidateClock);
    if(!result.ok)return result;
    try{return {ok:true as const,href:navigation?.resolveHref?.(result.href)??result.href};}catch{return {ok:false as const,code:'NAVIGATION_INPUT_UNAVAILABLE' as const,message:'目标页面路由不可用'};}
  }
  function targetHref(target:NavigationTarget,row:Row={}) {const result=targetResult(target,row);return result.ok?result.href:undefined;}
  function navigateTarget(target:NavigationTarget,row:Row={},event?:MouseEvent){
    const result=targetResult(target,row);
    if(!result.ok){event?.preventDefault();navigationMessage=result.message;onevent?.({type:'navigation-error',href:target.href,code:result.code,message:result.message});return;}
    navigationMessage='';navigate(result.href,event);
  }

  function navigateOffice(target: NavigationTarget, filters: FilterValues, entry?: Pick<RuntimeNavigationTarget, 'replace' | 'sourcePageId'>, verifiedRegion = false) {
    const result = targetResult(target, {}, filters, verifiedRegion);
    if (!result.ok) {
      navigationMessage = result.message;
      onevent?.({ type: 'navigation-error', href: target.href, code: result.code, message: result.message });
      return;
    }
    if (sameNavigationAddress(result.href, window.location.href, window.document.baseURI)) {
      navigationMessage = '代表处下钻地址必须指向另一个页面';
      onevent?.({ type: 'navigation-error', href: target.href, code: 'NAVIGATION_INPUT_INVALID', message: navigationMessage });
      return;
    }
    navigationMessage = '';
    const office = entry ? undefined : dimensionValueOf(filters, 'region').values[0];
    navigate(result.href, undefined, entry, office ? officeNavigationInput(target, office) : undefined);
  }

  function navigate(href: string, event?: MouseEvent, entry?: Pick<RuntimeNavigationTarget, 'replace' | 'sourcePageId'>, office?: OfficeNavigationInput) {
    if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    const sourcePageId = pageState.phase === 'ready' ? pageState.page.id : undefined;
    pendingOffice = office;
    const search = appliedInput!.initialSearch;
    const sourceSearch = filterState ? mergedSearch(filterState, search) : search;
    const target = { href, sourcePageId, sourceSearch, ...entry };
    onevent?.({ type: 'navigate', ...target });
    if (navigation?.navigate?.(target) === true) event?.preventDefault();
    else if (!event) window.location[entry?.replace ? 'replace' : 'assign'](new URL(href, window.document.baseURI).href);
  }

  function componentSnapshots(component: Component): ComponentSnapshots {
    if (component.type === 'table') void tableRevision;
    return new Map(
      Object.entries(component.data ?? {}).map(([slot, sourceId]) => [
        slot,
        component.type==='table'&&slot==='main' ? tableController?.hierarchySnapshot(component,snapshots.get(sourceId)??{status:'loading'})??{status:'loading'} : snapshots.get(sourceId) ?? ({ status: 'loading' } as DataSnapshot)
      ])
    );
  }

  function componentData(
    loaded: Page,
    component: Component,
    snapshotsBySlot: ComponentSnapshots
  ): NamedDataSlots {
    const data: NamedDataSlots = {};
    for (const [slot, sourceId] of Object.entries(component.data ?? {})) {
      const snapshot = prepareSlotSnapshot(component, slot, sourceId, snapshotsBySlot.get(slot));
      const source = loaded.dataSources[sourceId];
      if (!source || !snapshot) continue;
      const fields = resolveDataSourceFields(source);
      const progress = slot === 'main' ? componentScreenProgress(component, sourceId, snapshot) : undefined;
      const renderable = progress?.snapshot ?? displayDataSnapshot(snapshot);
      let visible =
        component.type === 'table' && slot === 'main'
          ? tableSnapshot(component, renderable)
          : renderable;
      if (
        component.type === 'mapChart' &&
        slot === 'main' &&
        component.props.hierarchyFilter
      ) {
        const declaration = declarations.find(
          (item) => item.id === component.props.hierarchyFilter
        );
        if (isHierarchyDeclaration(declaration)) {
          visible = {
            ...visible,
            rows: filterMapRows(
              visible.rows,
              component.props,
              declaration,
              filterValues.get(declaration.id)
            )
          };
        }
      }
      data[slot] = { snapshot: visible, fields, sourceStatus: snapshot.status, ...(progress ? {progress:{pendingFields:progress.pendingFields}} : {}), diagnostics: { componentId: component.id, sourceId, snapshot } };
    }
    return data;
  }

  function componentScreenProgress(component: Component, sourceId: string, snapshot: DataSnapshot) {
    const progress = stream?.getScreenProgress?.(sourceId);
    if (component.type === 'table') return usableTableProgress(component, progress, tableController?.render(component));
    if (component.type === 'mapChart' && snapshot.status === 'loading') return usableMapProgress(component.props, progress);
  }

  function prepareSlotSnapshot(component: Component, slot: string, sourceId: string, snapshot: DataSnapshot | undefined): DataSnapshot | undefined {
    if (!snapshot) return;
    if (component.type === 'table' && tablePinnedSlots(component.props).includes(slot) && pinnedSnapshotError(snapshot)) {
      reportPinnedIssue(component, sourceId, snapshot);
      return;
    }
    if (snapshot.status === 'ready') restoreCellFallbacks(snapshot.rows, snapshot.cellFallbacks);
    return snapshot;
  }
  const reportedPinned = new WeakSet<object>();
  function reportPinnedIssue(component: TableComponent, sourceId: string, snapshot: DataSnapshot): void {
    if (reportedPinned.has(snapshot)) return;
    reportedPinned.add(snapshot);
    debugWarn('[MetricCanvas][TABLE_PINNED_RESULT_INVALID] 置顶结果不可用', { componentId: component.id, dataSourceIds: [sourceId], reason: pinnedSnapshotError(snapshot) });
  }

  function visibleTableRows(component: TableComponent): Row[] {
    const snapshot = componentSnapshots(component).get('main');
    return snapshot?.status === 'ready'
      ? tableSnapshot(component, snapshot).rows
      : [];
  }

  function tableSnapshot(
    component: TableComponent,
    snapshot: Extract<DataSnapshot, { status: 'ready' }>
  ): Extract<DataSnapshot, { status: 'ready' }> {
    void tableRevision;
    if (resolvedTablePagination(component)?.mode === 'query') return snapshot;
    const pagination = resolvedTablePagination(component,snapshot);
    const source=pageState.phase==='ready'?pageState.page.dataSources[component.data.main]:undefined;
    if (remoteTableSearch(source)) return projectSnapshotRows(snapshot, presentation?.rows(component,snapshot.rows) ?? snapshot.rows);
    const rows=applySearchFilters(presentation?.rows(component,tableController?.hierarchyRows(component,snapshot.rows)??snapshot.rows)??snapshot.rows,filterValues,source?resolveDataSourceFields(source):{});
    const presented = tableController?.present(component,rows,pagination?.mode!=='local').rows??rows;
    return {status:'ready',rows:presented,...snapshotCellFallbacks(presented)};
  }
  function filteredTableRows(component: TableComponent,snapshot: Extract<DataSnapshot,{status:'ready'}>):Row[] {
    void tableRevision;
    const source=pageState.phase==='ready'?pageState.page.dataSources[component.data.main]:undefined;
    const rows=applySearchFilters(presentation?.rows(component,tableController?.hierarchyRows(component,snapshot.rows)??snapshot.rows)??snapshot.rows,filterValues,source?resolveDataSourceFields(source):{});
    return tableController?.present(component,rows,true).rows??rows;
  }

  function resolvedTablePagination(component: TableComponent, snapshot = componentSnapshots(component).get('main')) {
    return tablePagination(component, snapshot, stream?.getQueryPageSize(component.data.main));
  }

  function tableDefaultExpansion(loaded: Page, table: TableComponent, snapshot: DataSnapshot | undefined) {
    if (snapshot?.status !== 'ready') return;
    const pagination = resolvedTablePagination(table, snapshot);
    const remote = remoteTableSearch(loaded.dataSources[table.data.main]);
    if ((remote || pagination?.mode === 'query') && snapshot.totalCount !== snapshot.rows.length) return;
    const rows = pagination?.mode === 'query' ? snapshot.rows : remote
      ? presentation?.rows(table, snapshot.rows) ?? snapshot.rows
      : filteredTableRows(table, snapshot);
    const row = singleExpandableParent(table, rows);
    if (row) return { row, snapshot };
  }

  function tablePaginationState(
    loaded: Page,
    component: TableComponent,
    snapshotsBySlot: ComponentSnapshots
  ): TablePaginationState | undefined {
    const pagination = resolvedTablePagination(component, snapshotsBySlot.get('main'));
    if (!pagination || pagination.mode === 'none') return undefined;
    const snapshot = usableTableProgress(component,stream?.getScreenProgress?.(component.data.main),tableController?.render(component))?.snapshot ?? snapshotsBySlot.get('main');
    if (!snapshot || snapshot.status === 'loading') {
      return undefined;
    }
    if (pagination.mode === 'local') {
      const totalCount = snapshot.status === 'ready' ? filteredTableRows(component, snapshot).length : 0;
      return {
        pageSize: tablePageSizes[component.id] ?? pagination.pageSize,
        totalCount
      };
    }
    const pageSize = effectiveTablePageSize(loaded, component);
    const totalCount = snapshot.status === 'error' ? 0 : snapshot.totalCount;
    if (pageSize === undefined || totalCount === undefined) return undefined;
    return { pageSize, totalCount };
  }

  function queryPageSize(loaded: Page, component: TableComponent): number | undefined {
    const source = loaded.dataSources[component.data.main];
    if ((source?.source.type === 'pagedJoin' || source?.source.type === 'pagedUnion')) return source.source.pagination.pageSize;
    if (source?.source.type !== 'query') return undefined;
    const order = selectTimeQuery(source.source.query,filterValues).body.dsl_list[0].order;
    if (typeof order !== 'object' || order === null || Array.isArray(order)) return undefined;
    return typeof order.limit === 'number' && Number.isInteger(order.limit) && order.limit > 0
      ? order.limit
      : undefined;
  }

  function effectiveTablePageSize(
    loaded: Page,
    component: TableComponent
  ): number | undefined {
    return tablePageSizes[component.id] ?? stream?.getQueryPageSize(component.data.main) ?? queryPageSize(loaded, component);
  }

  function tableInteractionGate(component:TableComponent,row:Row,column:TableColumn){
    if(component.props.rowExpansion?.selection&&!visibleTableRows(component).includes(row))return {eligible:false,enabled:false};
    if(tableController?.columnEligible(component,column)===false)return {eligible:false,enabled:false};
    const target = tableColumnNavigation(column, row);
    if (column.navigateBySource && !target) return { eligible: false, enabled: false };
    const node=column.selection??target??column.openDetail;
    if(node)return presentation?.gate(node,row,presentation.component(component.id))??{eligible:true,enabled:true};
    const actions=component.props.actions??[];
    const gates=actions.map(action=>presentation?.gate(action,row,presentation.component(component.id))??{eligible:true,enabled:true});
    return {eligible:gates.some(g=>g.eligible),enabled:gates.some(g=>g.enabled)};
  }
  function tableBinding(
    loaded: Page,
    component: Component,
    slots: ComponentSnapshots
  ): TableRenderBinding | undefined {
    if (component.type !== 'table') return undefined;
    void tableRevision;
    return tableController?.binding(component,{
      expansion: component.props.rowExpansion ? { page: loaded, gateway: activeGateway, filters: filterValues, params: pageParams, displaySnapshot, filterRevision, instanceId: rowScopeInstanceId, selection: tableController?.hierarchy(component), defaultExpansion: tableDefaultExpansion(loaded, component, slots.get('main')) } : undefined,
      onexport: () => { void exportTable(component); },
      oncancelexport: () => exportController.cancel(component.id),
      exporting: tableExportStates[component.id]?.busy,
      exportError: tableExportStates[component.id]?.error,
      selectedCell: tableSelectedCell(component),
      filterOptions: {},
      ...tableController.candidateBinding(component),
      pagination: tablePaginationState(loaded, component, slots),
      paginationConfig: resolvedTablePagination(component, slots.get('main')),
      interactionGate:(row,column)=>tableInteractionGate(component,row,column),
      toolbarEnabled:{search:component.props.toolbar?.search?actionAllowed(component,component.props.toolbar.search):true,export:component.props.toolbar?.export?actionAllowed(component,component.props.toolbar.export):true},
      oncellselect: ({ rowIndex, column, row }) =>
        handleTableCellSelect(component, rowIndex, column,row),
      linkHref: (row, column) => {
        const target = tableColumnNavigation(column, row);
        if (target && actionAllowed(component, target, row)) return targetHref(target, row);
        return column?.openDetail || column?.navigateBySource ? undefined : componentHref(component, row);
      },
      onlink: ({ row, column }, event) => handleTableLink(component, row, event, column)
    });
  }

  function chartClickHandler(component: Component): ((row: Row) => void) | undefined {
    if (!componentCapability(component)?.actions ||
      !(isChartComponent(component) || component.type === 'gauge' || component.type === 'rankingCard' || component.type==='button')) {
      return undefined;
    }
    return (row: Row) => handleChartClick(component, row);
  }

  function metricLinkHandler(component: Component): ((row: Row, event: MouseEvent) => void) | undefined {
    if (
      component.type !== 'metricCard' ||
      !componentCapability(component)?.actions ||
      !component.props.actions?.some(action => 'navigate' in action || 'openDetail' in action)
    ) return undefined;
    return (row, event) => handleMetricLink(component, row, event);
  }

  function selectTabFromMetric(sourceId: string, componentId: string, tabId: string) {
    if (initializing || pageState.phase !== 'ready' || !presentation?.component(sourceId).enabled) return;
    if (!presentation.component(componentId).enabled) return;
    const sections = activePageSections(pageState.page, presentation.sections);
    const target = sections.flatMap(section => section.components).find(component => component.id === componentId);
    if (target?.type === 'tabContainer' && target.props.tabs.some(tab => tab.id === tabId)) selectTab(componentId, tabId);
  }

  function activePageSections(page: Page, sections: Page['sections']) {
    const sectionGroups = page.sectionGroups?.filter(group => presentation?.groups.get(group.id)?.eligible !== false);
    return visibleSections({ ...page, sections, sectionGroups }, selectedGroup);
  }

  function mapOverride(component: Component): 'china' | 'world' | undefined {
    if (component.type !== 'mapChart' || !component.props.hierarchyFilter) return undefined;
    const declaration = declarations.find((item) => item.id === component.props.hierarchyFilter);
    if (!isHierarchyDeclaration(declaration)) return undefined;
    return resolveMapBasemap(
      component.props,
      declaration,
      filterValues.get(declaration.id)
    );
  }

  function nestedRender(loaded: Page): NestedComponentRender {
    return {
      data: (child) => componentData(loaded, child, componentSnapshots(child)),
      snapshot: (child) => hostRenderSnapshot(child, componentSnapshots(child)),
      table: (child) => tableBinding(loaded, child, componentSnapshots(child)),
      onchartclick: chartClickHandler,
      onmetriclink: metricLinkHandler,
      metricHref: (child) => (row) => componentHref(child, row),
      map: mapOverride,
      textLinks: child => child.type === 'text' ? (child.props.links ?? []).map(textLink) : []
    };
  }
</script>

<div class="runtime-view" data-initializing={initializing&&pageState.phase==='ready'?'':undefined} data-runtime-navigation={navigation?.navigate ? true : undefined} bind:this={surfaceRoot}>
<MetricDefinitionLayer fetchDefinitions={fetchMetricDefinitions} tabs={tabSelections}>
  {#if navigationMessage}<p role="alert" data-navigation-error>{navigationMessage}</p>{/if}
  {#if regionURLIssue}<p role="alert">{regionURLIssue}</p>{/if}
  {#if pageState.phase === 'loading'}
    <!-- Local validation finishes before the first real page structure is mounted. -->
  {:else if pageState.phase === 'auth-required'}
    <!-- The application owns login; terminated page data must no longer be shown. -->
  {:else if pageState.phase === 'version-error'}
    <div class="error-page">
      <h1>引擎不支持页面协议版本</h1>
      <p>{pageState.error.message}</p>
    </div>
  {:else if pageState.phase === 'configuration-error'}
    <div class="error-page">
      <h1>统一运行时接入配置不完整</h1>
      <p><code class="badge">{pageState.error.code}</code></p>
      <p>{pageState.error.message}</p>
    </div>
  {:else if pageState.phase === 'input-invalid'}
    <div class="error-page"><h1>页面输入不完整或无效</h1><p>{pageState.message}</p><p>请检查链接中的筛选值、日期粒度及必需输入。</p></div>
  {:else if pageState.phase === 'invalid'}
    {#if pageState.errors.length > 0}
    <div class="error-page">
      <h1>页面文档未通过校验</h1>
      <p class="muted">修复以下错误后保存，页面会自动刷新。</p>
      <ul class="errors">
        {#each pageState.errors as error}
          <li>
            <code class="badge">{error.type}</code>
            <code class="path">{error.path}</code>
            <span>{error.message}</span>
          </li>
        {/each}
      </ul>
    </div>
    {/if}
  {:else}
    {@const readyPage = pageState.page}
    {@const header = resolvePageHeader(readyPage,presentation?.filters??declarations)}
    {@const pageReadOnly = filterEditing?.readOnly || header.readOnly}
    {@const layoutForm = readyPage.layout ?? 'report'}
    {@const firstComponent = readyPage.sections[0]?.components[0]}
    {@const leadingDateToolbar = layoutForm === 'report' && !readyPage.sections[0]?.title && firstComponent?.type === 'reportHeader' && firstComponent.layout.span === 12 && (!!firstComponent.props.filterIds?.length || !!firstComponent.props.exportButtons?.length || !!firstComponent.props.pdfExport || !!firstComponent.props.pngExport)}
    {@const dashboardToolbar = usesIocRegion(readyPage)?'hidden':readyPage.dashboardToolbar??(header.model?'visible':'hidden')}
    {@const compatibleHeader = compatibilityHeaderSection(readyPage)}
    {@const leadingId = leadingHeaderSectionId(readyPage)}
    {@const projectedSections = presentation?.sections ?? readyPage.sections}
    {@const activeSections = activePageSections(readyPage, projectedSections)}
    <div
      class:layout-dashboard={layoutForm === 'dashboard'}
      class:with-report-date-toolbar={leadingDateToolbar}
      class:dashboard-toolbar-hidden={
        layoutForm === 'dashboard' && dashboardToolbar === 'hidden'
      }
      class="page-content"
      data-page-layout-form={layoutForm}
      data-dashboard-toolbar={typeof dashboardToolbar==='string'?dashboardToolbar:dashboardToolbar.variant}
    >
      {#snippet headerControls(ids: string[])}
        <FilterBar confirmationIds={confirmationFilters} {timeContext} onretry={retryCandidates} readOnly={filterEditing?.readOnly} declarations={ids.flatMap(id=>presentation?.filters.find(f=>f.id===id)??[])} values={filterValues}
          candidates={dimensionCandidates} ondimension={writeDimension} ontimerange={writeTimeRange} onpendingperiod={choosePendingPeriod}
          ontimepoint={writeTimePoint} onboolean={writeBoolean} onnumberrange={writeNumberRange} onsearch={writeSearch}/>
      {/snippet}
      {#snippet componentContent(component: Component)}
        {@const slots = componentSnapshots(component)}
        <ComponentRenderer
          {component}
          iocHeader={header.model?{model:header.model,titleLink:headerTitleLink(header.model),filterIds:header.primary.map(filter=>filter.id),overflowIds:header.overflow.map(filter=>filter.id),filterRows:header.filterRows,controls:iocHeaderControls,
            returnContext:navigation?.returnContext,onback:navigation?.back,readOnly:pageReadOnly,
            note:blockedFilters.length?`等待筛选确认或可信候选：${blockedFilters.map(id=>declarations.find(f=>f.id===id)?.label??id).join('、')}`:pageReadOnly?filterEditing?.reason??header.note??'筛选只读':header.note}:undefined}
          {initialTabs}
          filterGroupReadOnly={pageReadOnly}
          {headerControls}
          filterGroupValue={component => {
            if (component.type !== 'filterGroup') return undefined;
            const value = filterValues.get(component.props.filterId);
            return value?.type === 'dimension' ? value.values[0] : undefined;
          }}
          onfiltergroup={(component, value) => {
            if (component.type !== 'filterGroup') return;
            if (presentation?.component(component.id).enabled !== true) return;
            const declaration = declarations.find(item => item.id === component.props.filterId);
            if (declaration?.type === 'dimension') writeDimension(declaration, [value]);
          }}
          headerPeriod={(header)=>headerPeriod(header.props,declarations,filterValues,readyPage.schemaVersion)}
          data={componentData(readyPage, component, slots)}
          snapshot={hostRenderSnapshot(component, slots)}
          pageSnapshots={snapshots}
          {aiSummary}
          textLinks={component.type === 'text'
            ? (component.props.links ?? []).filter(link=>presentation?.gate(link).eligible!==false).map(link=>({...textLink(link),disabled:presentation?.gate(link).enabled===false}))
            : []}
          onchartclick={chartClickHandler(component)}
          onmetriclink={metricLinkHandler(component)}
          metricHref={(row) => componentHref(component, row)}
          onback={navigation?.back}
          table={tableBinding(readyPage, component, slots)}
          map={mapOverride(component)}
          nested={nestedRender(readyPage)}
        />
      {/snippet}
    {#if compatibleHeader}
      <RuntimeSection section={compatibleHeader} {componentContent}/>
    {/if}
    {#snippet iocHeaderControls(id: string, readOnly: boolean)}
      <FilterBar iocHeader confirmationIds={confirmationFilters} {timeContext} onretry={retryCandidates} declarations={(presentation?.filters??declarations).filter(filter=>filter.id===id)} values={filterValues} candidates={dimensionCandidates}
        {readOnly} ondimension={selectHeaderDimension} ontimerange={writeTimeRange} onpendingperiod={choosePendingPeriod} ontimepoint={writeTimePoint}
        onboolean={writeBoolean} onnumberrange={writeNumberRange} onsearch={writeSearch}/>
    {/snippet}
    {#if pageState.capabilities.filters && hasVisibleFilters(header.content)}
      <div data-dashboard-content-filters={layoutForm==='dashboard'?true:undefined} class:dashboard-content-filters={layoutForm==='dashboard'}>
        <FilterBar confirmationIds={confirmationFilters} {timeContext} onretry={retryCandidates} readOnly={pageReadOnly}
          declarations={header.content} values={filterValues} candidates={dimensionCandidates}
          ondimension={writeDimension} ontimerange={writeTimeRange} onpendingperiod={choosePendingPeriod} ontimepoint={writeTimePoint}
          onboolean={writeBoolean} onnumberrange={writeNumberRange} onsearch={writeSearch}/>
      </div>
    {/if}

    {#if !sectionsContent&&leadingId}
      <div class="page-sections" data-leading-header-section data-ioc-dedicated-header={readyPage.sections[0]?.components.length === 1 && !readyPage.sections[0]?.title ? true : undefined}>
      {#each projectedSections.filter(section=>section.id===leadingId) as section (section.id)}
        <RuntimeSection {section} {componentContent} hidden={!activeSections.some(item=>item.id===section.id)}/>
      {/each}
      </div>
    {/if}
    {#if readyPage.sectionGroups || readyPage.sectionAnchors}
      <nav class="section-navigation" aria-label="内容导航">
        {#each (readyPage.sectionGroups ?? []).filter(group=>presentation?.groups.get(group.id)?.eligible!==false) as group (group.id)}
          <button type="button" data-section-group={group.id}
            aria-pressed={selectedSectionGroup(readyPage, selectedGroup) === group.id}
            onclick={() => (selectedGroup = group.id)}>{group.label}</button>
        {/each}
        {#each (readyPage.sectionAnchors ?? []).filter(anchor=>presentation?.sectionGates.get(anchor.sectionId)?.eligible!==false) as anchor (anchor.sectionId)}
          <button type="button" data-section-anchor={anchor.sectionId}
            onclick={() => locateSection(readyPage, anchor.sectionId)}>{anchor.label}</button>
        {/each}
      </nav>
    {/if}
    <div class="page-sections">
      {#if sectionsContent}
        {@render sectionsContent(activeSections, componentContent)}
      {:else}
        {#each projectedSections.filter(section=>section.id!==leadingId) as section (section.id)}
          <RuntimeSection {section} {componentContent}
            hidden={!activeSections.some(item=>item.id===section.id)} />
        {/each}
      {/if}
    </div>
    </div>
  {/if}
  {#if openDetail}
    <!-- 页内详情浮层（ADR-0087）：不离开当前页，Esc 与背板关闭。 -->
    <dialog
      class="detail-panel {openDetail.surface}"
      class:has-table={detailHasTable}
      data-detail-surface={openDetail.surface}
      aria-label={openDetail.title}
      data-detail-panel
      use:mountDetailDialog
      oncancel={cancelDetail}
      onclick={dismissDetailBackdrop}
      onkeydown={trapDetailFocus}
    >
        <header>
          <h2 data-detail-title>{openDetail.title}</h2>
          <button type="button" data-detail-close aria-label="关闭" onclick={() => closeDetail()}>
            ×
          </button>
        </header>
        {#if openDetail.error}
          <p role="alert">{openDetail.error}</p>
        {:else if openDetail.view && openDetail.page}
          {#key detailGeneration}
            <DetailContent page={openDetail.page} components={openDetail.view.components} snapshots={detailSnapshots} filters={detailFilters} {displaySnapshot} {filterRevision} />
          {/key}
        {:else}
        <dl>
          {#each openDetail.items ?? [] as item (item.label)}
            <div class="detail-item" data-detail-item>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          {/each}
        </dl>
        {/if}
    </dialog>
  {/if}
</MetricDefinitionLayer>
</div>



<style>
  .section-navigation {
    display: flex;
    flex-wrap: wrap;
    gap: var(--mc-space-sm, 0.5rem);
    padding: var(--mc-space-sm, 0.5rem) var(--mc-page-content-padding-inline);
  }
  .section-navigation button {
    font: inherit;
    color: var(--mc-color-text);
    background: var(--mc-color-surface);
    border: thin solid var(--mc-color-border);
    border-radius: var(--mc-radius-cell);
    padding: var(--mc-space-sm, 0.5rem);
    overflow-wrap: anywhere;
    max-width: 100%;
    cursor: pointer;
  }
  .section-navigation button[aria-pressed='true'] {
    color: var(--mc-color-surface);
    background: var(--mc-color-primary);
  }
  .section-navigation button:focus-visible {
    outline: auto;
  }
  .runtime-view {
    position: relative;
    container: mc-runtime / inline-size;

    --mc-color-canvas: #daeaff;
    /* 看板形态画布:中性灰,让白色分区自己成为模块边界。 */
    --mc-color-dashboard-canvas: #f8f8f8;
    --mc-color-surface: #fff;
    --mc-color-surface-subtle: #f1f4ff;
    --mc-color-text: #18181b;
    --mc-color-text-strong: #0f1a4d;
    --mc-color-muted: #71717a;
    --mc-color-primary: #08359e;
    --mc-color-accent: #4f46e5;
    --mc-color-border: #e4e4e7;
    --mc-color-danger: #b91c1c;
    --mc-color-positive: #52c41a;
    --mc-color-negative: #f5222d;
    --mc-color-report-positive: #5cb300;
    --mc-color-report-negative: #f21e1e;
    --mc-color-report-heading: #121e3b;
    --mc-color-report-text: #191919;
    --mc-color-report-rank-muted: #697386;
    --mc-color-report-description: #595959;
    --mc-color-report-badge: #1476ff;
    --mc-color-report-badge-surface: #e8f1ff;
    --mc-color-report-header-accent: #2098ff;
    --mc-color-report-content-frame: #d4d5ff;
    --mc-color-report-content-surface: #fcfcff;
    --mc-font-size-report-level-3: 20px;
    --mc-font-size-report-level-4: 18px;
    --mc-radius-cell: 10px;
    --mc-radius-report-content: 12px;
    --mc-radius-section: 16px;
    /* 分区面板外观真源:RuntimeSection(container-panel)、ReportHeader 摘要区
       与 MetricCard 渐变变体共用。角度与色标位置换算自 Pixso SVG 的线性渐变向量。 */
    --mc-section-gradient: linear-gradient(
      204deg,
      rgb(218 214 255) 4%,
      rgb(189 213 255) 45%
    );
    --mc-section-panel-padding: 15px 28px 29px;
    --mc-section-panel-background: var(--mc-section-gradient);
    --mc-section-panel-radius: 20px;

    /* 分区居中图标标题真源:RuntimeSection、ReportHeader 摘要标题、TextBlock(heading) 共用。 */
    --mc-section-title-gap: 12px;
    --mc-section-title-font-size: 32px;
    --mc-section-title-font-weight: 600;
    --mc-section-title-line-height: 50px;
    --mc-section-title-icon-size: 20px;

    /* 摘要块(insight)外观真源:TextBlock(insight) 与 AI 总结 View 共用。 */
    --mc-insight-padding: 15px 18px 15px 15px;
    --mc-insight-radius: 16px;
    --mc-insight-heading-margin: 0 0 15px 5px;
    --mc-insight-heading-font-size: 20px;
    --mc-insight-heading-line-height: 25px;
    --mc-insight-body-padding: 9px 27px 12px 12px;
    --mc-insight-body-radius: 8px;
    --mc-insight-body-font-size: 18px;
    --mc-insight-body-line-height: 30px;

    width: 100%;
    min-width: 0;
    color: var(--mc-color-text);
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', sans-serif;
  }
  .runtime-view :global(*) {
    box-sizing: border-box;
  }
  .muted {
    color: var(--mc-color-muted);
  }
  .page-content {
    --mc-page-content-padding-block-start: 28px;
    --mc-page-content-padding-inline: 18px;

    width: 100%;
    max-width: 75rem;
    box-sizing: border-box;
    margin: 0 auto;
    min-height: 100vh;
    padding: var(--mc-page-content-padding-block-start)
      var(--mc-page-content-padding-inline) 54px;
    background: var(--mc-color-canvas);
  }
  .page-content.with-report-date-toolbar {
    --mc-page-content-padding-block-start: 0px;
    --mc-report-date-toolbar-margin-inline: calc(-1 * var(--mc-page-content-padding-inline));
  }
  /* 看板形态:占满宿主给出的全部宽度,中性画布,分区之间只靠间距分隔。
     报表形态的定宽居中与浅蓝画布留在 `.page-content` 缺省规则里不动,
     两档的差别全部落在这一处,分区内部的 12 列网格两档共用。

     ==== 这一处就是「按页面布局形态生效的 token 通道」的唯一定义点 ====
     规则只有两条,新增量之前先对着它判一次:
     ① 只有「两档形态取值不同」和「跨文件下发」两类量走 --mc-,其余保持字面量;
     ② 报表形态的取值一律留在**消费点的 var() 缺省值**里,不在这里也不在
        `.runtime-view` 根部重复一遍。因此这个块只增不改:块里出现的每一行
        都是看板档,把某一行删掉就退回报表档,报表形态因此不可能被这里改到。
     消费点跨包时(色板、卡片标题、筛选控件铬)名字仍以这里为真源,
     不允许任一消费方改自己的缺省字面量来「就地调档」。 */
  .page-content.layout-dashboard {
    /* 白色内容容器里的指标卡，复用指标文字连接卡的外框。 */
    --mc-white-card-border: 1px solid rgb(0 0 0 / 0.1);
    --mc-white-card-padding: 20px;
    --mc-white-card-radius: 16px;
    --mc-white-card-border-color: rgb(0 0 0 / 0.1);
    --mc-white-metric-panel-border-width: 1px;
    --mc-page-content-padding-block-start: 0;
    --mc-page-content-padding-inline: 0;
    --mc-page-sections-margin-top: 0;
    --mc-section-card-padding: 16px 20px 20px;
    --mc-section-card-title-margin: 0 0 12px;
    --mc-section-card-title-color: #191919;
    --mc-section-card-title-font-size: 16px;
    --mc-section-card-title-font-weight: 500;
    --mc-section-card-title-line-height: 24px;
    --mc-section-card-grid-gap: 16px;
    --mc-section-card-grid-column-gap: 16px;
    --mc-section-plain-grid-gap: 16px;
    --mc-section-plain-grid-column-gap: 16px;
    --mc-metric-panel-surface: var(--mc-color-surface);
    --mc-metric-panel-radius: var(--mc-radius-section);
    --mc-metric-panel-padding: 16px 20px;
    --mc-gauge-surface: var(--mc-color-surface);
    --mc-gauge-radius: var(--mc-radius-section);
    --mc-gauge-padding: 16px 12px;
    --mc-section-default-padding: 0;
    --mc-section-default-surface: transparent;
    --mc-section-default-shadow: none;
    --mc-cell-padding: 16px 20px 20px;
    --mc-cell-radius: var(--mc-radius-section);
    --mc-cell-shadow: none;
    --mc-field-text-body-surface: rgb(0 0 0 / 0.03);
    --mc-field-text-body-radius: 8px;
    --mc-field-text-body-padding: 14px 17px;

    /* 图表色板。不是 CSS 声明而是要塞进 ECharts option 的数据,由图表组件从
       自己的绘图容器读计算样式(见 widgets/src/shared/chart-palette.ts)。
       报表形态不定义这两个名字,图表因此沿用图表库内置色板与连续渐变。 */
    --mc-chart-categorical-colors: #5b72ea, #3cc6c1, #fec72a, #4ba0f7;
    /* 分档色从**高档到低档**;档数由色列长度决定。 */
    --mc-chart-map-scale-colors: #7184e7, #acb9f0, #d9dff6, rgba(0, 0, 0, 0.05);

    /* 卡面无边框:宽度归零而不是把颜色改透明,否则留下 1px 占位。 */
    --mc-cell-border-width: 0;
    --mc-metric-panel-border-width: 0;
    --mc-gauge-border: 0;

    /* 卡内分隔线 */
    --mc-cell-divider-color: #dcdbdb;

    /* 组件卡片标题:报表形态下这一族在十个文件里各有一套字号字重,
       看板形态收敛成同一档。 */
    --mc-card-title-font-size: 16px;
    --mc-card-title-font-weight: 500;
    --mc-card-title-line-height: 24px;
    --mc-card-title-color: #191919;

    /* 页面标题(字号两档同为 24px,不设量) */
    --mc-page-title-font-weight: 500;
    --mc-page-title-line-height: 36px;
    --mc-page-title-color: #191919;

    /* 指标行:标签、大数字、数值单位 */
    --mc-metric-label-font-size: 14px;
    --mc-metric-label-line-height: 20px;
    --mc-metric-label-color: var(--mc-color-report-text);
    --mc-metric-value-font-size: 28px;
    --mc-metric-value-font-weight: 400;
    --mc-metric-value-line-height: 34px;
    --mc-metric-value-color: var(--mc-color-report-text);
    --mc-metric-unit-font-size: 14px;
    --mc-metric-unit-font-weight: 400;
    --mc-metric-unit-line-height: 20px;
    --mc-metric-unit-color: var(--mc-color-report-text);

    /* 表格:表头高度与底色、行高、横竖分隔线同色 */
    --mc-table-header-row-height: 64px;
    --mc-table-header-surface: rgb(0 0 0 / 0.05);
    --mc-table-header-border: rgb(0 0 0 / 0.15);
    --mc-table-row-height: 48px;
    --mc-table-cell-border: rgb(0 0 0 / 0.15);

    /* Tab:整条底边着色的下划线页签换成短指示条,轨保留 1px */
    --mc-tab-font-size: 16px;
    --mc-tab-active-font-weight: 500;
    --mc-tab-active-color: var(--mc-color-report-text);
    --mc-tab-active-underline-color: transparent;
    --mc-tab-indicator: linear-gradient(currentcolor, currentcolor) bottom center /
      32px 2px no-repeat border-box;
    --mc-tab-track-color: rgb(25 25 25 / 0.1);

    /* 筛选控件:字段名不再外置,当前值自己就是控件的所指 */
    --mc-filter-font-size: 14px;
    --mc-filter-control-min-width: 220px;
    --mc-filter-control-height: 34px;
    --mc-filter-control-radius: 6px;
    --mc-filter-control-border-color: #c2c2c2;
    --mc-filter-label-display: none;

    /* 长文本正文行高(冻结基线 R3-3) */
    --mc-field-text-body-line-height: 28px;

    max-width: none;
    padding: var(--mc-page-content-padding-block-start)
      var(--mc-page-content-padding-inline);
    color: var(--mc-color-report-text);
    background: var(--mc-color-dashboard-canvas);
  }
  .page-content.layout-dashboard :global(h3.mc-data-heading) {
    font-family: 'PingFang SC', sans-serif;
    font-style: normal;
    font-weight: 600;
    letter-spacing: 0;
    text-align: left;
  }
  .page-content.layout-dashboard.dashboard-toolbar-hidden {
    --mc-page-sections-margin-top: 0;
  }
  .dashboard-content-filters {
    --mc-filter-bar-flex: 1;
    --mc-filter-bar-padding: 0;
    --mc-filter-bar-margin: 0;
    --mc-filter-bar-background: transparent;
    --mc-filter-bar-border: 0;
    --mc-filter-bar-radius: 0;

    display: flex;
    padding: 16px 24px 0 23px;
  }
  .page-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: var(--mc-page-sections-margin-top, 0);
  }
  .page-sections:global([data-ioc-native-sticky]) {
    position: sticky;
    top: 0;
    z-index: 66;
  }
  /* 报表页头及包含正文组件的看板首分区与后续正文之间保留分区间距。 */
  .page-content[data-page-layout-form='report']
    > .page-sections[data-leading-header-section]:has(> :global([data-section-id]:not([hidden])))
    + .page-sections:has(> :global([data-section-id]:not([hidden]))),
  .page-content.layout-dashboard
    > .page-sections[data-leading-header-section]:has(
      > :global([data-section-id]:not([hidden]) > .section-grid [data-component-type]:not([data-component-type='iocHeader']))
    )
    + .page-sections:has(> :global([data-section-id]:not([hidden]))) {
    margin-top: 16px;
  }
  .page-content.layout-dashboard > .page-sections {
    --mc-page-sections-padding-left: 23px;
    --mc-page-sections-padding-right: 24px;

    /* 看板内容轨只保留 23/24px 非对称页面内距；实际宽度始终由宿主容器决定。 */
    padding-right: var(--mc-page-sections-padding-right);
    padding-left: var(--mc-page-sections-padding-left);
  }
  .page-content.layout-dashboard[data-dashboard-toolbar='compact'] {
    --mc-page-sections-margin-top: 0;
  }
  .page-content.layout-dashboard[data-dashboard-toolbar='compact'] > .page-sections {
    --mc-page-sections-padding-left: 24px;

    padding-bottom: 24px;
  }
  @container mc-runtime (max-width: 1050px) {
    .page-content {
      --mc-page-content-padding-inline: 12px;
    }
  }
  .error-page h1 {
    font-size: 20px;
  }
  .errors {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    list-style: none;
  }
  .errors li {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 14px;
  }
  .badge {
    color: var(--mc-color-danger);
    font-size: 12px;
    font-weight: 700;
  }
  .path {
    color: var(--mc-color-muted);
    font-size: 13px;
  }
  .detail-panel {
    position: fixed;
    inset: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: auto;
    border: 0;
    color: var(--mc-color-text);
    background: #fff;
    box-shadow: 0 12px 32px rgb(15 23 42 / 18%);
    overscroll-behavior: contain;
  }
  .detail-panel::backdrop {
    background: rgb(15 23 42 / 45%);
  }
  .detail-panel.modal {
    width: min(560px, calc(100vw - 48px));
    max-width: none;
    max-height: calc(100dvh - 48px);
    margin: auto;
    padding: 20px 24px;
    border-radius: 12px;
  }
  .detail-panel.drawer {
    width: min(420px, 100vw);
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0 0 0 auto;
    padding: 20px 24px;
  }
  .detail-panel.has-table {
    width: min(90vw, 1440px, calc(100vw - 32px));
  }
  .detail-panel.has-table.modal {
    max-height: calc(100dvh - 32px);
  }
  .detail-panel header {
    display: flex;
    gap: 12px;
    align-items: baseline;
    justify-content: space-between;
  }
  .detail-panel h2 {
    margin: 0;
    font-size: 16px;
  }
  .detail-panel header button {
    padding: 0 6px;
    color: var(--mc-color-muted);
    font-size: 20px;
    line-height: 1;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .detail-panel dl {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
  }
  .detail-item {
    display: flex;
    gap: 16px;
    justify-content: space-between;
    font-size: 13px;
  }
  .detail-item dt {
    color: var(--mc-color-muted);
    white-space: nowrap;
  }
  .detail-item dd {
    margin: 0;
    text-align: right;
  }
</style>
