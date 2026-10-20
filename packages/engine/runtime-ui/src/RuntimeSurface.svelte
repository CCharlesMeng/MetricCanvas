<script module lang="ts">
 import {selectTimeQuery} from '@metriccanvas/page/internal';
</script>
<svelte:options css="injected" />
<script lang="ts">
  import { compilePresentation, resolvePresentationRow } from '../../runtime/src/presentation';
  import type { DisplaySnapshot } from '../../runtime/src/display-inputs';
  import { PRESENTATION_CONTEXT } from './presentation-context';
  import { chartOptionPaths, isChartOptionError } from '@metriccanvas/page/internal';
  import { CHART_OPTION_PATHS } from '../../widgets/src/shared/chart-option-extension';
  import {queryFilterIds} from '@metriccanvas/page/internal';
  import {createCandidateGatewaySession} from '@metriccanvas/data-execution/runtime';
  let candidateSession:ReturnType<typeof createCandidateGatewaySession>|undefined;
  import {filterInputIssue} from '../../runtime/src/navigation-inputs';
  import { filterCandidatesRequest } from '../../runtime/src/filter-candidates';
  import { candidateScopeKey } from '../../runtime/src/dimension-values';
  import { createTableController } from './table-controller';
  import { createExportController } from './export-controller';
  import { type TableHeaderFilters, type TableQueryView, hasQueryFieldMapping } from '@metriccanvas/page/internal';
  import { applyTableSearch, remoteTableSearch } from './table-search';
  import { prepareTableExport } from './table-export';
  import { downloadTableWorkbook } from './table-workbook';
  import { tablePagination } from './table-pagination';
  import { tick, untrack, setContext, onDestroy } from 'svelte';
  import { initialSectionGroup, selectedSectionGroup, sectionGroupFor, visibleSections } from './section-navigation';
  import {
    parsePage,
    canonicalizeJson,
    type Page,
    type TypedError
  } from '@metriccanvas/page';
  import {
    declaredNavigationTargets,
    type NavigationTarget,
    chartFilterOptions,
    conditionSourceIds,
    dataSourceMode,
    derivePageCapabilities,
    fieldName,
    filterURLKeys,
    isChartComponent,
    resolveDataSourceFields,
    flattenPageComponents,
    type ChartComponent,
    type Component,
    type ComponentCapabilities,
    type DataSnapshot,
    type FieldReference,
    type FilterDeclaration,
    type OpenDetailAction,
    type PageParamDeclaration,
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
    initializePageParams,
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
  import DetailContent from './DetailContent.svelte';
  import { detailViewInput } from '../../runtime/src/detail-view';
  import type { NestedComponentRender, TableRenderBinding } from './component-render';
  import {
    filterMapRows,
    isHierarchyDeclaration,
    resolveMapBasemap,
    resolveMapClick
  } from './map-hierarchy';
  import { collectDataErrors } from './data-error-events';
  import { runtimeVersionError } from './version-error';
  import { headerPeriod } from './report-date-header';
  import { collectFilterTextValueReferences, formatPeriod, resolveParamTextValues } from '@metriccanvas/page/internal';
  import {projectFieldSelections} from '@metriccanvas/page/internal';
  import {periodFactPage, filterTextPage } from './filter-text';
  import { validateCalendarTimeRange } from '@metriccanvas/page/internal';
  import FilterBar from './filters/FilterBar.svelte';
  import IocHeader from './ioc-header/IocHeader.svelte';
  import {resolvePageHeader,pageFiltersReadOnly} from './ioc-header/page-header';
  import {
    cascadeConstraints,
    cascadeContext,
    clearDependentUpdates,
    dimensionValueOf
  } from './filters/cascade';
  import { hasVisibleFilters } from './filters/filter-bar';
  import { changedFilters, resetFilteredTablePages, sortTableRows, filterTableRowsByHeaders } from './table-state';
  import { applySearchFilters } from './filters/inline-search';
  import { hostRenderSnapshot, renderableDataSnapshot } from './widget-host-state';
  import RuntimeSection from './RuntimeSection.svelte';
  import type { RuntimeSurfaceProps } from './composition-types';
  import {
    configurationError,
    isDataGateway,
    type RuntimeConfigurationError,
    type RuntimeNavigation,
    type RuntimeViewEvent
  } from './types';

  type PageCapabilities = ReturnType<typeof derivePageCapabilities>;
  type ComponentSnapshots = ReadonlyMap<string, DataSnapshot>;
  type PageState =
    | { phase: 'loading' }
    | { phase: 'invalid'; errors: TypedError[] }
    | { phase: 'version-error'; error: Extract<RuntimeViewEvent, { type: 'version-error' }> }
    | { phase: 'configuration-error'; error: RuntimeConfigurationError }
    | {phase:'input-invalid';message:string}
    /** 必需页面参数缺失:页面输入不完整,与查询错误分类区分开(ADR-0047)。 */
    | { phase: 'params-incomplete'; missing: PageParamDeclaration[] }
    | { phase: 'ready'; page: Page; capabilities: PageCapabilities };

  // inline 页面不访问数据网关;候选值能力缺席即不可用,不需要抛错桩。
  const inlineGateway: RuntimeDataGateway = {
    async fetchData() {
      throw new Error('inline 页面不应访问数据网关');
    }
  };

  let {
    document,
    displayInputs,
    sectionsContent,
    dataGateway,
    aiSummary,
    initialSearch = '',
    navigation,
    filterEditing,
    onevent,
    pageRevisionId,
    execution
  }: RuntimeSurfaceProps = $props();

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
  onDestroy(() => { reportExportGeneration++; exportController.reset(); tableController?.dispose(); });
  async function prepareReport<T>(consume:(view:{target:HTMLElement;signal:AbortSignal})=>Promise<T>,scale=2):Promise<T> {
    if(pageState.phase!=='ready'||!stream||!surfaceRoot)throw new ExportViewError('EXPORT_NOT_READY','页面实例尚未就绪');
    // Capture every runtime value before the first await; later interactions stay independent.
    if(declarationPage)projectFieldSelections({...declarationPage,detailViews:undefined},filterValues);
    const page=JSON.parse(JSON.stringify(pageState.page)) as Page;
    const summaries=Object.fromEntries([...summaryCapture].map(([id,get])=>{
      const value=get();
      return [id,value.status==='ready'||value.status==='streaming'?{status:'ready' as const,text:value.text}:{status:'empty' as const}];
    }));
    if (Object.keys(page.dataSources).some(id=>sourceBlocked(page,id))) throw new ExportViewError('EXPORT_NOT_READY','筛选待确认或候选未就绪，暂不能导出页面');
    const state={page,now:new Date(),displaySnapshot:structuredClone(displaySnapshot),filterRevision,currentYear:stream.captureComputeYear(),filters:structuredClone(new Map(filterValues)),snapshots:structuredClone(new Map(snapshots)),tables:JSON.parse(JSON.stringify(tableViews)),headerFilters:JSON.parse(JSON.stringify(appliedTableHeaderFilters)),summaries,sourceViews:stream.captureViews()};
    const queries=stream.captureQueries();
    const program=stream.getSourceProgram();
    return exportController.run(pageExportTask, controller => withReportView({state,queries,gateway:activeGateway,sourceRoot:surfaceRoot,controller,program,scale},consume));
  }
  let declarationPage:Page|undefined;
  let pageState = $state<PageState>({ phase: 'loading' });
  setContext(CHART_OPTION_PATHS, () => pageState.phase === 'ready' ? chartOptionPaths(pageState.page) : new Map<string, string>());
  function visibleValidationErrors(errors: TypedError[]): TypedError[] {
    for (const error of errors) if (isChartOptionError(error)) console.error('[MetricCanvas][CHART_OPTION_INVALID]', error);
    return errors.filter(error => !isChartOptionError(error));
  }
  let navigationMessage=$state('');
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
  let filterValues = $state<FilterValues>(new Map());
  let pageParams = $state<PageParamValues>(new Map());
  let displaySnapshot=$state.raw<DisplaySnapshot|undefined>();
  let filterRevision=$state(0);
  const presentationProgram=$derived(pageState.phase==='ready'?compilePresentation(pageState.page):null);
  const presentation=$derived(presentationProgram?.evaluate({filters:filterValues,filterRevision,displaySnapshot})??null);
  setContext(PRESENTATION_CONTEXT,()=>presentation);
  let refreshPeriodFacts:((snapshot:DisplaySnapshot|undefined)=>void)|undefined;
  function clearDisplaySnapshot(){displaySnapshot=undefined;untrack(()=>refreshPeriodFacts?.(undefined));}
  let permissionRevision:string|undefined;
  let permissionInvalidated=false;
  $effect(()=>{
    const source=displayInputs;
    if(!source){clearDisplaySnapshot();return;}
    let stopped=false;
    const update=(snapshot:DisplaySnapshot)=>{
      if(stopped||permissionInvalidated)return;
      if(!snapshot||typeof snapshot.permissionRevision!=='string'||!snapshot.permissionRevision){clearDisplaySnapshot();return;}
      if(permissionRevision!==undefined&&permissionRevision!==snapshot.permissionRevision){
        stopped=true;permissionInvalidated=true;dispose();snapshots=new Map();displaySnapshot=undefined;
        const error={code:'DISPLAY_PERMISSION_CHANGED' as const,message:'权限会话已变化，请以当前身份重新初始化页面'};
        pageState={phase:'configuration-error',error};onevent?.({type:'configuration-error',...error});return;
      }
      permissionRevision=snapshot.permissionRevision;displaySnapshot=snapshot;untrack(()=>refreshPeriodFacts?.(snapshot));
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

  let declarations = $state<FilterDeclaration[]>([]);
  let candidateClock=$state.raw(new Date());
  const timeContext=$derived({snapshot:displaySnapshot,revision:filterRevision});
  const candidateTimeContext=()=>({displayInputs:displaySnapshot,filterRevision,now:candidateClock});
  let filterState: FilterState | null = null;
  let candidatesLoader: ReturnType<typeof createDimensionValuesLoader> | null = null;
  let stream: PageSnapshotStream | null = null;
  let session = 0;
  let disposers: Array<() => void> = [];

  $effect(() => {
    void run(document, dataGateway, initialSearch, navigation, onevent, pageRevisionId, execution);
    return dispose;
  });

  function dispose() {
    untrack(() => closeDetail(false));
    reportExportGeneration++;
    reportExportMessage = '';
    reportExportError = undefined;
    exportController.reset();
    session += 1;
    for (const fn of disposers) fn();
    disposers = [];
    filterState = null;
    stream = null;
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
    if(permissionInvalidated)return;
    exportController.reset(); tableController?.dispose(); tableController=undefined;
    const mySession = ++session;
    filterRevision=0;
    pageState = { phase: 'loading' };navigationMessage='';
    snapshots = new Map();
    filterValues = new Map();
    dimensionCandidates = new Map();
    tableViews = {};
    untrack(() => closeDetail(false));
    selectedGroup = undefined;
    tablePageSizes = {};
    appliedTableHeaderFilters = {};

    // 保持异步初始化接缝，避免外层 effect 把初始化中的状态读取纳入依赖。
    await Promise.resolve();
    if (session !== mySession || permissionInvalidated) return;
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
    const declared = parsePage(raw);
    if (!declared.ok) {
      pageState = { phase: 'invalid', errors: visibleValidationErrors(declared.errors) };
      emit?.({ type: 'invalid', errors: declared.errors });
      return;
    }
    const paramDeclarations = declared.page.params ?? [];
    initialTabs = initialTabsFromSearch(declared.page, search);
    const params = bootstrap ? {values:bootstrap.params,missing:[]} : resolvePageParams(search, paramDeclarations,{strict:declared.page.strictURLInputs===true});
    pageParams = params.values;
    if (params.missing.length > 0) {
      pageState = {
        phase: 'params-incomplete',
        missing: paramDeclarations.filter((declaration) =>
          params.missing.includes(declaration.id)
        )
      };
      return;
    }
    const parsed =
      paramDeclarations.length === 0
        ? declared
        : parsePage(raw, { textValues: { values: params.values, format: (value, format) => Array.isArray(value) ? value.join('、') : typeof value === 'object' ? formatPeriod(value) : formatValue(value, format) } });
    if (!parsed.ok) {
      pageState = { phase: 'invalid', errors: visibleValidationErrors(parsed.errors) };
      emit?.({ type: 'invalid', errors: parsed.errors });
      return;
    }

    let loaded: typeof parsed.page;
    try {
      loaded = initializePageParams(parsed.page, params.values);
      selectedGroup = initialSectionGroup(loaded, params.values);
    } catch {
      pageState = {phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/params',message:'页面参数无法生成合法查询条件或内容组，请检查输入值与窗口范围'}]};
      emit?.({type:'invalid',errors:pageState.errors});
      return;
    }
    const mode = dataSourceMode(loaded.dataSources);
    const configIssue = configurationIssue(mode, gatewayOverride);
    if (configIssue) {
      pageState = { phase: 'configuration-error', error: configIssue };
      emit?.({ type: 'configuration-error', ...configIssue });
      return;
    }

    const nextCandidateSession=createCandidateGatewaySession(gatewayOverride??inlineGateway);
    candidateSession=nextCandidateSession;activeGateway=nextCandidateSession.gateway;
    disposers.push(()=>{nextCandidateSession.dispose();if(candidateSession===nextCandidateSession)candidateSession=undefined;});

    declarationPage=loaded;
    const capabilities = derivePageCapabilities(loaded);
    const textBindings = collectFilterTextValueReferences(resolveParamTextValues(raw, { values: params.values }));
    declarations = loaded.filters ?? [];

    if(loaded.strictURLInputs===true){const privateIds=new Set((loaded.detailViews??[]).flatMap(view=>view.filters??[])),query=new URLSearchParams(search);const privateInput=declarations.some(f=>privateIds.has(f.id)&&Object.values(filterURLKeys(f)).some(key=>query.has(key)));const message=privateInput?'详情私有筛选不能由页面URL写入':filterInputIssue(search,declarations,candidateClock);if(message){pageState={phase:'input-invalid',message};emit?.({type:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message}]});return;}}
    // 旧数组参数的显式 value 固定本次输入；分组参数仍允许 URL 参数与独立筛选初始化。
    let fromURL:Map<string,FilterValue>;
    try{fromURL = new Map(capabilities.filters && !paramDeclarations.some(p => !p.path && p.value !== undefined)
      ? parseFilterSearch(search,declarations,candidateClock)
      : new Map());}catch{pageState={phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message:'时间模式URL必须为合法完整mode/from/to'}]};emit?.({type:'invalid',errors:pageState.errors});return;}
    const localOptions = chartFilterOptions(loaded);
    for (const [id, options] of localOptions) {
      const value = fromURL.get(id);
      if (value && (value.type !== 'dimension' || value.values.length !== 1 || !options.includes(value.values[0]!))) {if(loaded.strictURLInputs===true){pageState={phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters/'+id,message:'目标筛选取值不在可用候选中'}]};emit?.({type:'invalid',errors:pageState.errors});return;}fromURL.delete(id);}
      const supplied = bootstrap?.filters.get(id);
      if (bootstrap && (!supplied || supplied.type !== 'dimension' || supplied.values.length !== 1 || !options.includes(supplied.values[0]!))) {
        pageState = { phase: 'invalid', errors: [{type:'SCHEMA_ERROR',path:'/filters',message:'执行快照中的图表筛选值不在候选项中'}] };
        emit?.({type:'invalid',errors:pageState.errors});
        return;
      }
    }
    let fromDeclarations:Map<string,FilterValue>;
    try{fromDeclarations=initialFilterValues((loaded.filters??[]).filter(f=>!fromURL.has(f.id)),candidateClock,displaySnapshot,0);}catch{pageState={phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message:'时间默认值或可信初始期间不符合声明精度和边界'}]};emit?.({type:'invalid',errors:pageState.errors});return;}
    let state:ReturnType<typeof createFilterState>;
    try {
      state = createFilterState(bootstrap ? bootstrap.filters : new Map([...fromDeclarations, ...fromURL]), declarations, localOptions, { candidates:true, displayInputs:()=>displaySnapshot,readOnly: () => filterEditing?.readOnly === true || pageFiltersReadOnly(loaded) });
    } catch {
      pageState={phase:'invalid',errors:[{type:'SCHEMA_ERROR',path:'/filters',message:'筛选初始化值不符合声明或日期边界'}]};
      emit?.({type:'invalid',errors:pageState.errors});return;
    }
    filterState = state;

    function receiveCandidates(next:DimensionValuesSnapshots) {
        for (const declaration of declarations) {
          if (declaration.type !== 'dimension' || localOptions.has(declaration.id) || declaration.options) continue;
          const value = filterValues.get(declaration.id);
          const level = value?.type === 'dimension' ? value.level : declaration.defaultLevel ?? declaration.hierarchy?.[0]?.id;
          const dimension = declaration.hierarchy?.find(item => item.id === level)?.dimension ?? declaration.dimension;
          const receipt = next.get(candidateScopeKey(declaration.id,dimension,level,cascadeContext(declaration,declarations,filterValues,candidateTimeContext())));
          if(receipt&&receipt.status!=='idle'){
            const allowed=receipt.status==='ready'?receipt.candidates.filter(item=>!item.disabled&&(declaration.treeSelection!=='level'||item.level===level)).map(item=>item.value):undefined;
            state.candidate(declaration.id,receipt.status==='ready'&&!allowed?.length?'empty':receipt.status,allowed);
          }
        }
    }

    let primed = false;
    disposers.push(
      state.subscribe((values) => {
        const previous = filterValues;
        filterValues = values;filterRevision=state.revision;candidateClock=state.clock();
        blockedFilters = [...state.blocked()];
        if (blockedFilters.length) {
          for (const component of flattenPageComponents(loaded)) if (component.type==='table' && sourceBlocked(loaded,component.data.main)) exportController.cancel(component.id);
          if (Object.keys(loaded.dataSources).some(id=>sourceBlocked(loaded,id))) exportController.cancel(pageExportTask);
        }
        if (candidatesLoader && changedFilters(previous,values).size) {
          for (const declaration of declarations) if (declaration.type === 'dimension' && !localOptions.has(declaration.id) && !declaration.options) loadDimensionCandidates(candidatesLoader,declaration,values);
          receiveCandidates(dimensionCandidates);
        }
        const presentation = periodFactPage(filterTextPage(loaded, textBindings, values),displaySnapshot,state.revision);
        if(candidatesLoader)loadTableCandidates(presentation);
        declarations = presentation.filters ?? [];
        pageState = { phase: 'ready', page: presentation, capabilities };
        if (primed && capabilities.filters && changedFilters(previous,values).size > 0) {
          const nextSearch = mergedSearch(state, search);
          navigationAdapter?.replaceSearch?.(nextSearch);
          emit?.({ type: 'filter-change', search: nextSearch,filterRevision:state.revision });
          try { bootstrap?.recordFilters?.(values); } catch { /* 记录失败不能回滚当前筛选或中止查询 */ }
          if (changedFilters(previous, values).size > 0) closeDetail(false);
          for (const component of flattenPageComponents({sections:loaded.sections})) if(component.type==='table') tableController?.reset(component,previous,values);
        }
        primed = true;
      })
    );

    tableController=createTableController(loaded,()=>stream,()=>syncTableState(loaded));
    syncTableState(loaded);
    pageState = { phase: 'ready', page: periodFactPage(filterTextPage(loaded, textBindings, filterValues),displaySnapshot,state.revision), capabilities };

    const pageStream = orchestrate(
      loaded,
      activeGateway,
      capabilities.filters ? state : undefined,
      revisionId !== undefined ? { pageRevisionId: revisionId } : undefined,
      bootstrap,{displayInputs:()=>displaySnapshot,filterRevision:()=>state.revision,clock:()=>state.clock()}
    );
    stream = pageStream;
    const emittedDataErrors = new Map<string, string>();
    disposers.push(
      pageStream.subscribe((next) => {
        snapshots = next;
        syncTableState(loaded);
        // 结构化查询错误上抛为嵌入事件,宿主按分类决定重试或重登(issue #51)。
        for (const event of collectDataErrors(emittedDataErrors, next)) {
          emit?.(event);
        }
      })
    );
    emit?.({ type: 'ready', pageId: loaded.id });
    const pendingInitial=new Set(declarations.filter(f=>(f.type==='timePoint'||f.type==='timeRange')&&f.availability?.initial&&!filterValues.has(f.id)&&!fromURL.has(f.id)).map(f=>f.id));
    let periodKey=canonicalizeJson([displaySnapshot?.periods??{},displaySnapshot?.timeZone??null]);
    refreshPeriodFacts=next=>{
      if(session!==mySession)return;
      const key=canonicalizeJson([next?.periods??{},next?.timeZone??null]);if(key===periodKey)return;periodKey=key;
      // Invalidate authorizing receipts before publishing a new fact context.
      for(const declaration of declarations)if(declaration.type==='dimension'&&declaration.candidateWindow)state.candidate(declaration.id,'loading');
      let defaults:Map<string,FilterValue>;try{defaults=initialFilterValues(declarations,new Date(),displaySnapshot,state.revision);}catch{defaults=new Map();}
      const seeded=new Map(filterValues);
      for(const id of pendingInitial){if(filterValues.has(id)){pendingInitial.delete(id);continue;}const value=defaults.get(id);if(value){seeded.set(id,value);pendingInitial.delete(id);}}
      if(seeded.size!==filterValues.size)state.commit({type:'initialize',values:seeded});
      state.refreshContext();
      if(candidatesLoader)for(const declaration of declarations)if(declaration.type==='dimension'&&declaration.candidateWindow)loadDimensionCandidates(candidatesLoader,declaration,filterValues);
    };
    disposers.push(()=>{refreshPeriodFacts=undefined;});

    if (!capabilities.filters && !pageComponents(pageState.phase==='ready'?pageState.page:loaded).some(component=>component.type==='table'&&buildTableColumnLayout(component.props.columns).leaves.some(column=>column.filterable?.mode==='select'))) return;

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

    for (const declaration of declarations) {
      if (declaration.type !== 'dimension' || localOptions.has(declaration.id) || declaration.options) continue;
      loadDimensionCandidates(loader, declaration, filterValues);
    }

    loadTableCandidates(pageState.phase==='ready'?pageState.page:loaded);
    function loadTableCandidates(presentation:Page){
    const filterableFields = new Set<string>();
    for (const component of pageComponents(presentation)) {
      if (component.type !== 'table' || !capabilities.components[component.id]?.live) {
        continue;
      }
      if (resolvedTablePagination(component)?.mode === 'query') { Object.values(tableCandidateDimensions(component)).forEach(field=>filterableFields.add(field)); continue; }
      const source = loaded.dataSources[component.data.main];
      for (const column of buildTableColumnLayout(
        component.props.columns,
        source ? resolveDataSourceFields(source) : undefined
      ).leaves) {
        if (column.filterable?.mode === 'select') {
          filterableFields.add(fieldName(column.field));
        }
      }
    }
    for (const field of filterableFields) {
      candidatesLoader?.load(field);
    }
    }
  }

  function configurationIssue(
    mode: ReturnType<typeof dataSourceMode>,
    gatewayValue: unknown
  ): RuntimeConfigurationError | null {
    if (gatewayValue !== undefined && !isDataGateway(gatewayValue)) {
      return configurationError(
        'DATA_GATEWAY_INVALID',
        '数据网关必须实现 fetchData;候选值端口 fetchDimensionValues 可选,声明了必须是函数。'
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
    const tables=flattenPageComponents({sections:loaded.sections}).filter((c): c is TableComponent => c.type==='table');
    tableViews=Object.fromEntries(tables.map(c=>[c.id,tableController!.render(c)]));
    appliedTableHeaderFilters=Object.fromEntries(tables.map(c=>[c.id,tableController!.headers(c)]));
    tablePageSizes=Object.fromEntries(tables.map(c=>[c.id,tableController!.view(c).pageSize]));
    tableRevision+=1;
  }
  function sourceBlocked(page: Page, sourceId: string): boolean {
    return [...conditionSourceIds(page,sourceId)].some(id => {
      const source=page.dataSources[id];
      return source?.source.type==='query' && queryFilterIds(source.source.query).some(id=>blockedFilters.includes(id));
    });
  }
  async function exportTable(component: TableComponent) {
    if(pageState.phase!=='ready'||!stream||!component.props.toolbar?.export||!actionAllowed(component,component.props.toolbar.export))return;
    const frozen=JSON.parse(JSON.stringify(component)) as TableComponent;
    const input={page:pageState.page,component:frozen,queries:stream.captureQueries(),gateway:activeGateway,
      program:stream.getSourceProgram(),views:stream.captureViews(),
      state:{now:new Date(),displaySnapshot:structuredClone(displaySnapshot),filterRevision,currentYear:stream.captureComputeYear(),filters:filterValues,tables:tableViews,headerFilters:appliedTableHeaderFilters}};
    try { await exportController.run(component.id,async controller=>{
      if (sourceBlocked(input.page,component.data.main)) throw new ExportViewError('EXPORT_NOT_READY','筛选待确认或候选未就绪，暂不能导出该表');
      const data=await prepareTableExport({...input,controller}); controller.signal.throwIfAborted();
      await downloadTableWorkbook(frozen,data,controller.signal);
    }); } catch { /* Task feedback is projected by exportController. */ }
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
            const expected =
              'field' in write ? row[fieldName(write.field)] : write.value;
            return (
              current?.type === 'dimension' &&
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
      updates.push([
        filterId,
        {
          type: 'dimension',
          dimension: declaration.dimension,
          values: [String(raw)]
        }
      ]);
    }
    filterState?.writeMany(updates);
  }

  function parseFilterURL(search: string, declared: FilterDeclaration[]): FilterValues {
    return parseFilterSearch(search, declared);
  }

  function mergedSearch(state: FilterState, initial: string): string {
    const params = new URLSearchParams(initial);
    for (const declaration of declarations) {
      for (const key of Object.values(filterURLKeys(declaration))) params.delete(key);
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
    if(declaration.options)return;
    const context=cascadeContext(declaration,declarations,values,candidateTimeContext());
    const levels=declaration.hierarchy?.map(level=>level.id)??[undefined];
    for(const level of levels){
      if(declaration.candidateContext||declaration.treeSelection==='level'||declaration.candidateWindow){
        let request:ReturnType<typeof filterCandidatesRequest>;try{request=filterCandidatesRequest(declaration,declarations,values,level,candidateTimeContext());}catch{const dimension=declaration.hierarchy?.find(item=>item.id===level)?.dimension??declaration.dimension;loader.unavailable(dimension,{filterId:declaration.id,level,context});continue;}
        if(force)candidateSession?.invalidate(request);
        loader.loadFilter(request,context,declaration.treeSelection==='level'?declaration.hierarchy?.map(item=>item.id):undefined,force);
      }else{
        const dimension=declaration.hierarchy?.find(item=>item.id===level)?.dimension??declaration.dimension;
        const scope={filterId:declaration.id,level,context};
        if(force)loader.reload(dimension,cascadeConstraints(declaration,declarations,values),scope);
        else loader.load(dimension,cascadeConstraints(declaration,declarations,values),scope);
      }
    }
  }

  function retryCandidates(id:string) {
    const declaration=declarations.find(item=>item.id===id);
    if(candidatesLoader && declaration?.type==='dimension')loadDimensionCandidates(candidatesLoader,declaration,filterValues,true);
  }

  function actionAllowed(component:Component,action:import('@metriccanvas/page/internal').PolicyNode,row?:Row):boolean {
    return presentation?.gate(action,row,presentation.component(component.id)).enabled===true;
  }
  function componentHref(component: Component, row: Row): string | undefined {
    if (!componentCapability(component)?.actions || !('actions' in component.props)) return undefined;
    const action = component.props.actions?.find(a => 'navigate' in a && actionAllowed(component,a,row) && actionAllowed(component,a.navigate,row));
    return action && 'navigate' in action ? targetHref(action.navigate,row) : undefined;
  }

  function handleTableLink(component: TableComponent, row: Row, event: MouseEvent, column?: TableColumn) {
    if(component.props.rowKey){
      const current=resolvePresentationRow(component,visibleTableRows(component),row);
      if(!current){event.preventDefault();return;}
      row=current;
    }
    if(column&&!tableInteractionGate(component,row,column).enabled){event.preventDefault();return;}
    if (column?.navigate && actionAllowed(component,column.navigate,row)) {
      navigateTarget(column.navigate,row,event);
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
    const action = 'actions' in component.props ? component.props.actions?.find(a=>'navigate' in a) : undefined;
    if(action&&'navigate' in action)navigateTarget(action.navigate,row,event);
    else {
      const detail = componentOpenDetail(component);
      if (detail) { event.preventDefault(); openDetailFor(component, detail, row, event.currentTarget as HTMLElement); }
    }
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

  function closeDetail(restoreFocus = true) {
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
    const root = surfaceRoot.getRootNode() as Document | ShadowRoot;
    const sourceCell = Array.from(surfaceRoot.querySelectorAll<HTMLElement>('[data-component]'))
      .find(element => element.dataset.component?.split('/').at(-1) === component.id);
    if (sourceCell && !sourceCell.hasAttribute('tabindex')) sourceCell.tabIndex = -1;
    detailTrigger = trigger ?? sourceCell ?? (root.activeElement instanceof HTMLElement ? root.activeElement : undefined);
    const detail = action.openDetail;
    openDetail = {
      surface: detail.surface,
      title: detail.titleField
        ? detailValue(row, detail.titleField)
        : componentTitle(component) ?? '详情',
      items: 'fields' in detail ? detail.fields.map((item) => ({
        label: item.label,
        value: detailValue(row, item.field)
      })) : undefined
    };
    if ('view' in detail && pageState.phase === 'ready') {
      const page = declarationPage??pageState.page;
      const view = page.detailViews?.find(candidate => candidate.id === detail.view);
      try {
        const input = detailViewInput(page, action, row, filterValues, pageParams);
        openDetail = { ...openDetail, view:view?{...view,components:input.page.sections[0]!.components}:undefined, page: input.page };
        detailFilters=input.filters;
        if (view?.mode === 'query') {
          const generation = detailGeneration;
          detailDispose = orchestrate(input.page, activeGateway, createFilterState(input.filters, input.page.filters ?? [])).subscribe(value => {
            if (generation === detailGeneration && openDetail) detailSnapshots = value;
          });
        } else detailSnapshots = snapshots;
      } catch {
        openDetail = { ...openDetail, error: '详情参数不完整或无效，请重新选择。' };
      }
    }
    void tick().then(() => surfaceRoot.querySelector<HTMLElement>('[data-detail-close]')?.focus());
  }

  function componentTitle(component: Component): string | undefined {
    const title = (component.props as { title?: unknown }).title;
    return typeof title === 'string' ? title : undefined;
  }

  function handleChartClick(component: Component, row: Row) {
    if (!componentCapability(component)?.actions || presentation?.component(component.id).enabled===false) return;
    if (component.type === 'mapChart' && component.props.hierarchyFilter) {
      const declaration = declarations.find(
        (item) => item.id === component.props.hierarchyFilter
      );
      if (isHierarchyDeclaration(declaration)) {
        const decision = resolveMapClick(
          component.props,
          declaration,
          filterValues.get(declaration.id),
          row
        );
        if (decision.kind === 'ignore') return;
        if (decision.kind === 'drill') {
          writeDimension(declaration, decision.value.values, decision.value.level);
          return;
        }
      }
    }
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
      const clicked = 'field' in action ? row[fieldName(action.field)] : action.value;
      const target = declarations.find((declaration) => declaration.id === action.writeFilter);
      if (clicked == null || target?.type !== 'dimension') continue;
      filterState?.write(action.writeFilter, {
        type: 'dimension',
        dimension: target.dimension,
        ...(target.hierarchy?{level:action.level??dimensionValueOf(filterValues,target.id).level??target.defaultLevel??target.hierarchy[0]?.id}:{}),
        values: [String(clicked)]
      });
    }
  }

  function textLink(link: TextLink) {
    return { label: link.label, href:targetHref(link), onclick: (event: MouseEvent) => navigateTarget(link,{},event) };
  }

  function targetResult(target:NavigationTarget,row:Row={}) {
    if(target.validateTargetInputs&&Object.values(target.query??{}).some(b=>b.source==='filter'&&blockedFilters.includes(b.id)))return {ok:false as const,code:'NAVIGATION_INPUT_INVALID' as const,message:'来源筛选尚未通过当前候选确认'};
    const result=resolveNavigationTarget(target,filterValues,pageParams,row,targetInputs.get(target.href),candidateClock);
    if(!result.ok)return result;
    try{return {ok:true as const,href:navigation?.resolveHref?.(result.href)??result.href};}catch{return {ok:false as const,code:'NAVIGATION_INPUT_UNAVAILABLE' as const,message:'目标页面路由不可用'};}
  }
  function targetHref(target:NavigationTarget,row:Row={}) {const result=targetResult(target,row);return result.ok?result.href:undefined;}
  function navigateTarget(target:NavigationTarget,row:Row={},event?:MouseEvent){
    const result=targetResult(target,row);
    if(!result.ok){event?.preventDefault();navigationMessage=result.message;onevent?.({type:'navigation-error',href:target.href,code:result.code,message:result.message});return;}
    navigationMessage='';navigate(result.href,event);
  }
  function navigate(href: string, event?: MouseEvent) {
    if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    const sourcePageId = pageState.phase === 'ready' ? pageState.page.id : undefined;
    const sourceSearch = filterState ? mergedSearch(filterState, initialSearch) : initialSearch;
    onevent?.({ type: 'navigate', href, sourcePageId, sourceSearch });
    if (navigation?.navigate?.({ href, sourcePageId, sourceSearch }) === true) event?.preventDefault();
    else if (!event) window.location.assign(new URL(href, window.document.baseURI).href);
  }

  function componentSnapshots(component: Component): ComponentSnapshots {
    return new Map(
      Object.entries(component.data ?? {}).map(([slot, sourceId]) => [
        slot,
        snapshots.get(sourceId) ?? ({ status: 'loading' } as DataSnapshot)
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
      const snapshot = snapshotsBySlot.get(slot);
      const source = loaded.dataSources[sourceId];
      if (!source || !snapshot) continue;
      const fields = resolveDataSourceFields(source);
      const renderable = renderableDataSnapshot(snapshot);
      if (!renderable) continue;
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
      data[slot] = { snapshot: visible, fields };
    }
    return data;
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
    if (remoteTableSearch(source)) return { ...snapshot, rows: presentation?.rows(component,snapshot.rows) ?? snapshot.rows };
    const rows=applySearchFilters(presentation?.rows(component,snapshot.rows)??snapshot.rows,filterValues,source?resolveDataSourceFields(source):{});
    return {status:'ready',rows:tableController?.present(component,rows,pagination?.mode!=='local').rows??rows};
  }
  function filteredTableRows(component: TableComponent,snapshot: Extract<DataSnapshot,{status:'ready'}>):Row[] {
    void tableRevision;
    const source=pageState.phase==='ready'?pageState.page.dataSources[component.data.main]:undefined;
    const rows=applySearchFilters(presentation?.rows(component,snapshot.rows)??snapshot.rows,filterValues,source?resolveDataSourceFields(source):{});
    return tableController?.present(component,rows,true).rows??rows;
  }

  /** 表头筛选候选项:只投影 ready 快照的真实候选值;其余状态不给表头假候选。 */
  function remoteHeaderOptions(): Record<string, string[]> {
    const options: Record<string, string[]> = {};
    for (const [dimension, snapshot] of dimensionCandidates) {
      if (snapshot.status === 'ready') {
        options[dimension] = snapshot.candidates.map((candidate) => candidate.value);
      }
    }
    return options;
  }

  function tableCandidateDimensions(component: TableComponent): Record<string,string> {return tableController?.candidateDimensions(component)??{};}
  function tableFilterOptions(component: TableComponent): Record<string, string[]> {
    if (resolvedTablePagination(component)?.mode === 'query') {
      return Object.fromEntries(Object.entries(tableCandidateDimensions(component)).flatMap(([field,dimension])=>{const snapshot=dimensionCandidates.get(dimension);return snapshot?.status==='ready'?[[field,snapshot.candidates.map(c=>c.value)]]:[];}));
    }
    const snapshot = componentSnapshots(component).get('main');
    if (snapshot?.status !== 'ready') return remoteHeaderOptions();
    const fields = buildTableColumnLayout(component.props.columns).leaves
      .filter((column) => column.filterable?.mode === 'select')
      .map((column) => fieldName(column.field));
    const local = Object.fromEntries(
      fields.map((field) => [
        field,
        [...new Set(snapshot.rows.map((row) => row[field]).filter((value) => value != null).map(String))]
      ])
    );
    return { ...local, ...remoteHeaderOptions() };
  }

  function resolvedTablePagination(component: TableComponent, snapshot = componentSnapshots(component).get('main')) {
    return tablePagination(component, snapshot, stream?.getQueryPageSize(component.data.main));
  }

  function tablePaginationState(
    loaded: Page,
    component: TableComponent,
    snapshotsBySlot: ComponentSnapshots
  ): TablePaginationState | undefined {
    const pagination = resolvedTablePagination(component, snapshotsBySlot.get('main'));
    if (!pagination || pagination.mode === 'none') return undefined;
    const snapshot = snapshotsBySlot.get('main');
    if (!snapshot || (snapshot.status !== 'ready' && snapshot.status !== 'empty')) {
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
    if (pageSize === undefined || snapshot.totalCount === undefined) return undefined;
    return { pageSize, totalCount: snapshot.totalCount };
  }

  function queryPageSize(loaded: Page, component: TableComponent): number | undefined {
    const source = loaded.dataSources[component.data.main];
    if (source?.source.type === 'pagedJoin') return source.source.pagination.pageSize;
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
    const node=column.selection??column.navigate??column.openDetail;
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
      onexport: () => { void exportTable(component); },
      oncancelexport: () => exportController.cancel(component.id),
      exporting: tableExportStates[component.id]?.busy,
      exportError: tableExportStates[component.id]?.error,
      selectedCell: tableSelectedCell(component),
      filterOptions: tableFilterOptions(component),
      filterOptionsStatus: tableController?.candidateStates(component,dimensionCandidates),
      pagination: tablePaginationState(loaded, component, slots),
      paginationConfig: resolvedTablePagination(component, slots.get('main')),
      interactionGate:(row,column)=>tableInteractionGate(component,row,column),
      toolbarEnabled:{search:component.props.toolbar?.search?actionAllowed(component,component.props.toolbar.search):true,export:component.props.toolbar?.export?actionAllowed(component,component.props.toolbar.export):true},
      oncellselect: ({ rowIndex, column, row }) =>
        handleTableCellSelect(component, rowIndex, column,row),
      linkHref: (row, column) => column?.navigate && actionAllowed(component,column.navigate,row) ? targetHref(column.navigate,row)
        : column?.openDetail ? undefined : componentHref(component, row),
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
      !component.props.actions?.some((action) => 'navigate' in action || 'openDetail' in action)
    ) {
      return undefined;
    }
    return (row: Row, event: MouseEvent) => handleMetricLink(component, row, event);
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
      map: mapOverride
    };
  }
</script>

<div class="runtime-view" bind:this={surfaceRoot}>
  {#if navigationMessage}<p role="alert" data-navigation-error>{navigationMessage}</p>{/if}
  {#if pageState.phase === 'loading'}
    <p class="muted">加载页面…</p>
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
  {:else if pageState.phase === 'params-incomplete'}
    <div class="error-page">
      <h1>页面输入不完整或无效</h1>
      <p class="muted">以下页面参数缺少有效取值，请检查链接中的参数及日期格式。</p>
      <ul class="errors">
        {#each pageState.missing as declaration (declaration.id)}
          <li>
            <code class="path">{declaration.id}</code>
            <span>{declaration.label ?? '缺少取值'}</span>
          </li>
        {/each}
      </ul>
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
    {@const dashboardToolbar = readyPage.iocHeader ? 'hidden' : readyPage.dashboardToolbar ?? 'visible'}
    <div
      class:layout-dashboard={layoutForm === 'dashboard'}
      class:with-report-date-toolbar={leadingDateToolbar}
      class:dashboard-toolbar-hidden={
        layoutForm === 'dashboard' && dashboardToolbar === 'hidden'
      }
      class="page-content"
      data-page-layout-form={layoutForm}
      data-dashboard-toolbar={typeof dashboardToolbar === 'string'
        ? dashboardToolbar
        : dashboardToolbar.variant}
    >
    {#if header.model}
      <IocHeader model={header.model} filterIds={header.primary.map(filter=>filter.id)} overflowIds={header.overflow.map(filter=>filter.id)}
        returnContext={navigation?.returnContext} onback={navigation?.back} controls={iocHeaderControls}
        readOnly={pageReadOnly} note={blockedFilters.length ? `等待筛选确认或可信候选：${blockedFilters.map(id=>declarations.find(f=>f.id===id)?.label ?? id).join('、')}` : pageReadOnly ? filterEditing?.reason ?? header.note ?? '筛选只读' : header.note}/>
    {/if}
    {#snippet iocHeaderControls(id: string, readOnly: boolean)}
      <FilterBar {timeContext} onretry={retryCandidates} declarations={(presentation?.filters??declarations).filter(filter=>filter.id===id)} values={filterValues} candidates={dimensionCandidates}
        {readOnly} ondimension={writeDimension} ontimerange={writeTimeRange} ontimepoint={writeTimePoint}
        onboolean={writeBoolean} onnumberrange={writeNumberRange} onsearch={writeSearch}/>
    {/snippet}
    {#if pageState.capabilities.filters && hasVisibleFilters(header.content)}
      <div data-dashboard-content-filters={layoutForm==='dashboard'?true:undefined} class:dashboard-content-filters={layoutForm==='dashboard'}>
        <FilterBar {timeContext} onretry={retryCandidates} readOnly={pageReadOnly}
          declarations={header.content} values={filterValues} candidates={dimensionCandidates}
          ondimension={writeDimension} ontimerange={writeTimeRange} ontimepoint={writeTimePoint}
          onboolean={writeBoolean} onnumberrange={writeNumberRange} onsearch={writeSearch}/>
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
      {#snippet headerControls(ids: string[])}
        <FilterBar {timeContext} onretry={retryCandidates} readOnly={filterEditing?.readOnly} declarations={ids.flatMap(id=>presentation?.filters.find(f=>f.id===id)??[])} values={filterValues}
          candidates={dimensionCandidates} ondimension={writeDimension} ontimerange={writeTimeRange}
          ontimepoint={writeTimePoint} onboolean={writeBoolean} onnumberrange={writeNumberRange} onsearch={writeSearch}/>
      {/snippet}
      {#snippet componentContent(component: Component)}
        {@const slots = componentSnapshots(component)}
        <ComponentRenderer
          {component}
          {initialTabs}
          {headerControls}
          chartFilterValue={component => {
            if (!isChartComponent(component) || !component.props.filter) return undefined;
            const value = filterValues.get(component.props.filter.filterId);
            return value?.type === 'dimension' ? value.values[0] : undefined;
          }}
          onchartfilter={(component, value) => {
            if (!isChartComponent(component) || !component.props.filter) return;
            const declaration = declarations.find(item => item.id === component.props.filter!.filterId);
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
      {#if sectionsContent}
        {@render sectionsContent(visibleSections({...readyPage,sections:presentation?.sections??readyPage.sections,sectionGroups:readyPage.sectionGroups?.filter(group=>presentation?.groups.get(group.id)?.eligible!==false)}, selectedGroup), componentContent)}
      {:else}
        {#each presentation?.sections ?? readyPage.sections as section (section.id)}
          <RuntimeSection {section} {componentContent}
            hidden={!visibleSections({...readyPage,sections:presentation?.sections??readyPage.sections,sectionGroups:readyPage.sectionGroups?.filter(group=>presentation?.groups.get(group.id)?.eligible!==false)}, selectedGroup).some(item=>item.id===section.id)} />
        {/each}
      {/if}
    </div>
    </div>
  {/if}
  {#if openDetail}
    <!-- 页内详情浮层（ADR-0087）：不离开当前页，Esc 与背板关闭。 -->
    <div
      class="detail-backdrop"
      data-detail-surface={openDetail.surface}
      role="presentation"
      onclick={(event) => {
        if (event.target === event.currentTarget) closeDetail();
      }}
    >
      <div
        class="detail-panel {openDetail.surface}"
        role="dialog"
        aria-modal="true"
        aria-label={openDetail.title}
        data-detail-panel
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
      </div>
    </div>
  {/if}
</div>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && openDetail) closeDetail();
    if (event.key === 'Tab' && openDetail) {
      const panel = surfaceRoot.querySelector<HTMLElement>('[data-detail-panel]');
      const controls = Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"], input:not([disabled]), select:not([disabled])') ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      const active = (surfaceRoot.getRootNode() as Document | ShadowRoot).activeElement;
      if (first && ((!event.shiftKey && active === last) || (event.shiftKey && active === first) || !panel?.contains(active))) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    }
  }}
/>

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
    --mc-page-content-padding-block-start: 0;
    --mc-page-content-padding-inline: 0;
    --mc-page-sections-margin-top: 16px;
    --mc-section-card-padding: 16px 20px 20px;
    --mc-section-card-title-margin: 0 0 12px;
    --mc-section-card-title-color: var(--mc-color-report-text);
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
    --mc-card-title-color: var(--mc-color-report-text);

    /* 页面标题(字号两档同为 24px,不设量) */
    --mc-page-title-font-weight: 500;
    --mc-page-title-line-height: 36px;
    --mc-page-title-color: var(--mc-color-report-text);

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
  .page-content.layout-dashboard > .page-sections {
    /* 看板内容轨只保留 23/24px 非对称页面内距；实际宽度始终由宿主容器决定。 */
    padding-right: 24px;
    padding-left: 23px;
  }
  .page-content.layout-dashboard[data-dashboard-toolbar='compact'] {
    --mc-page-sections-margin-top: 0;
  }
  .page-content.layout-dashboard[data-dashboard-toolbar='compact'] > .page-sections {
    padding: 16px 24px 24px;
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
  .detail-backdrop {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    background: rgb(15 23 42 / 45%);
  }
  .detail-backdrop[data-detail-surface='modal'] {
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .detail-backdrop[data-detail-surface='drawer'] {
    justify-content: flex-end;
  }
  .detail-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: auto;
    background: #fff;
    box-shadow: 0 12px 32px rgb(15 23 42 / 18%);
  }
  .detail-panel.modal {
    width: min(560px, 100%);
    max-height: 100%;
    padding: 20px 24px;
    border-radius: 12px;
  }
  .detail-panel.drawer {
    width: min(420px, 100%);
    height: 100%;
    padding: 20px 24px;
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
