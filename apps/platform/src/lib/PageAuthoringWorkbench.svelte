<script lang="ts">
  import {createHref} from './integration/routes';
  import PrimaryAction from './PrimaryAction.svelte';

  import {Input,Select} from '@metriccanvas/ui';
  import ReadingHeader from './ReadingHeader.svelte';
  import ToolAction from './ToolAction.svelte';
  import PageAssetInfo from './workbench/PageAssetInfo.svelte';
  import {createAssetManagement} from './page-assets/management';
  import { createAuthoringLanguageRecovery, type TrustedLanguageRecoveryPort } from './workbench/authoring-language-recovery';
  import { createAuthoringLanguage, type LanguagePort } from './workbench/authoring-language';
  import PublicationReview from './workbench/PublicationReview.svelte';
  import InlineParameterReview from './workbench/InlineParameterReview.svelte';
  import {canonicalizeJson} from '@metriccanvas/page';
  import {parsePage,pageListEntry} from '@metriccanvas/page/internal';
  import {createInlineParameterPublication,type ParameterSourcePort} from './workbench/inline-parameter-publication';
  import {previewParameterPage} from './workbench/preview-parameter-page';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import {createParameterInstanceSession,type ParameterInstancePort} from './workbench/parameter-instance';
  import { createAuthoringPublication, unavailablePublicationPort, unavailableHumanConfirmation, type PublicationPort, type HumanConfirmationPort } from './workbench/authoring-publication';
  import AuthoringHistory from './workbench/AuthoringHistory.svelte';
  import { onMount, tick, untrack } from 'svelte';
  import {usePlatformServices} from './integration/services';
  const services = usePlatformServices();
  const {pageAuthoringPort, pageSavePort} = services;
  const {resolve} = services.navigation;
  const readRuntimeConfig = services.session.readConfig;
  import { createAuthoringCoordinator, type AuthoringPort, type DraftRef } from './workbench/authoring-coordinator';
  import { MetricCanvas, type AuthoringIntent } from '@metriccanvas/metric-canvas';

  import { workbenchPageViewModel } from './workbench/transient-page';
  import {
    changeComponentType, componentCandidatesFor,
    deleteComponent, editComponent, editPageTitle, locatorOfComponent, moveComponent,
    type ComponentLocator, type DocumentEditResult
  } from './workbench/document-edit';
  import { editReportDate } from './workbench/report-date-edit';
  import { propertyControls, editProperty } from './workbench/property-edit';
  import Inspector from './workbench/Inspector.svelte';
  import MetadataJsonDrawer from './workbench/MetadataJsonDrawer.svelte';
  import RevisionPreview from './RevisionPreview.svelte';
  import PanguDialogue from './dialogue/PanguDialogue.svelte';
  import { listenForSavedDrafts, unavailableDraftReader, type ReadSavedDraft, type DialogueAdapter } from './dialogue/port';

  import { listenForApplyPage } from './workbench/apply-page';
  import { createIndexedAuthoringStorage } from './workbench/authoring-storage';
  import { unavailableStableSave, type StableSavePort, type DurableAuthoringState } from './workbench/authoring-sync';
  let { taskUrl, active=true, showPageInfo=false, parameterInstancePort, parameterContextRef, onParameterInstanceReady, parameterSourcePort, dialogueAdapter = services.dialogueAdapter, readSavedDraft, authoringPort = pageAuthoringPort, stableSavePort = authoringPort === pageAuthoringPort ? pageSavePort : unavailableStableSave, languagePort = services.authoring?.language, onLanguageReady, languageRecoveryPort, onLanguageRecoveryReady, publicationPort = unavailablePublicationPort, humanConfirmation = unavailableHumanConfirmation }: {
    taskUrl?:URL;active?:boolean;showPageInfo?:boolean;
    parameterInstancePort?: ParameterInstancePort;
    parameterContextRef?: () => string;
    onParameterInstanceReady?: (api: ReturnType<typeof createParameterInstanceSession>) => void;
    parameterSourcePort?: ParameterSourcePort;
    publicationPort?: PublicationPort; humanConfirmation?: HumanConfirmationPort;
    languageRecoveryPort?: TrustedLanguageRecoveryPort; onLanguageRecoveryReady?: (api: ReturnType<typeof createAuthoringLanguageRecovery>) => void;
    languagePort?: LanguagePort; onLanguageReady?: (api: ReturnType<typeof createAuthoringLanguage>) => void;
    dialogueAdapter?: DialogueAdapter; readSavedDraft?: ReadSavedDraft; authoringPort?: AuthoringPort; stableSavePort?: StableSavePort;
  } = $props();
  const coordinator = untrack(() => createAuthoringCoordinator({
    manualSave:true,
    localTaskId: taskUrl?.searchParams.get('task')??undefined,
    storageTarget: () => { const config=readRuntimeConfig(); return JSON.stringify([config?.pageMetadataBaseUrl,config?.dqeEndpoint]); },
    port: {
      ...authoringPort,
      capabilities: { ...authoringPort.capabilities, exactDraftRead: !!readSavedDraft || authoringPort.capabilities.exactDraftRead },
      readSavedDraft: readSavedDraft ?? authoringPort.readSavedDraft ?? unavailableDraftReader
    },
    identity: () => {
      const config = readRuntimeConfig();
      return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' };
    }
  }));
  let activateTask=$state<(()=>void)|null>(null);
  let activated=false;
  let publication = $state<ReturnType<typeof createAuthoringPublication> | null>(null);
  let publicationOpen = $state(false);
  let parameterReview = $state<ReturnType<typeof createInlineParameterPublication>|null>(null);
  let parameterReviewOpen = $state(false);
  let parameterInstance = $state<ReturnType<typeof createParameterInstanceSession> | null>(null);
  let instanceState = $state<{document: import('@metriccanvas/page').PageDocument | null; error: string; loading: boolean}>({document:null,error:'',loading:false});
  let publicationBusy = $state(false);
  let language = $state<ReturnType<typeof createAuthoringLanguage> | null>(null);
  let languageState = $state<ReturnType<ReturnType<typeof createAuthoringLanguage>['snapshot']> | null>(null);
  let languageRecovery = $state<ReturnType<typeof createAuthoringLanguageRecovery> | null>(null);
  let recoveryState = $state<ReturnType<ReturnType<typeof createAuthoringLanguageRecovery>['snapshot']> | null>(null);
  let authoring = $state(coordinator.snapshot());
  const currentDraft = $derived(authoring.draft);
  const baseRevisionId = $derived(authoring.ref?.revisionId ?? null);
  const savePending = $derived(authoring.save?.status === 'pending' || authoring.languageLocked || publicationBusy);
  const saveBlocked = $derived(authoring.sync?.phase==='unknown' || authoring.sync?.phase==='identity-changed' || savePending || authoring.save?.status === 'unknown' ||
    (authoring.save?.status === 'rejected' && authoring.save.code === 'REVISION_CONFLICT'));
  const loading = $derived(authoring.loading);
  const saveNotice = $derived(authoring.save?.status === 'saved' ? `已保存修订 R${authoring.save.revision.revisionNumber}` : '');
  let saveError = $state('');
  let editError = $state('');
  let retainDimensionValues = $state(true);
  let replaceBoundTitle=$state(false);
  const titleIsBound=$derived.by(()=>{const meta=authoring.draft?.pageDocument.meta;return !!meta&&typeof meta==='object'&&'title' in meta&&typeof meta.title==='object'&&meta.title!==null;});
  let metadataOpen = $state(false);
  let previewOpen = $state(false);
  let historyOpen = $state(false);
  let settingsOpen=$state(untrack(()=>taskUrl?.searchParams.get('info')==='1'));
  const settingsId='page-settings-'+crypto.randomUUID();
  const recordManager=createAssetManagement(services.pageAssets,undefined,undefined,services.session.readConfig,services.workSession.canMutate);
  let previewRef = $state<DraftRef | null>(null);
  let savedPreviewTitle=$state('');
  let savedPreviewNumber=$state<number|undefined>();
  let savedPreviewStatus=$state<'草稿'|'已发布'|'状态待核实'|undefined>();
  $effect(()=>{void previewRef;savedPreviewTitle='';savedPreviewNumber=undefined;savedPreviewStatus=undefined;});
  async function readSavedPreview(pageId:string,revisionId:string,signal?:AbortSignal){
    const ref=previewRef;
    if(!ref||ref.pageId!==pageId||ref.revisionId!==revisionId)throw Error('预览目标已变化。');
    const revision=await coordinator.preview(ref,signal);
    if(!signal?.aborted&&previewRef===ref){const parsed=parsePage(revision.document);savedPreviewTitle=parsed.ok?pageListEntry(parsed.page).title:pageId;savedPreviewNumber=revision.revisionNumber;savedPreviewStatus=revision.isDraft===false?'已发布':revision.isDraft===true?'草稿':'状态待核实';}
    return revision;
  }
  let metadataEntryEl: HTMLButtonElement | null = $state(null);
  let flushingInput = false;
  let workbenchElement: HTMLDivElement;
  let selectedComponent = $state<ComponentLocator | null>(null);
  const dataGateway = services.workbenchGateway;

  // Coordinator owns the working copy; UI only projects snapshots and forwards intents.
  onMount(() => {
    const stopWork=services.workSession.register(taskUrl?.href??crypto.randomUUID(),()=>{const value=coordinator.snapshot();return {pageId:value.ref?.pageId??(String(value.draft?.pageDocument.id??taskUrl?.searchParams.get('page')??'')||null),resourceId:value.ref?.resourceId??taskUrl?.searchParams.get('resource')??null,busy:value.loading||value.dirty||value.languageLocked||(value.sync?.pending??0)>0};});
    const stopInvalidation = services.session.onInvalidate(() => coordinator.dispose());
    const hasUnsavedWork = () => {
      const current = coordinator.snapshot();
      return current.dirty || (current.sync?.pending ?? 0) > 0 || current.save?.status === 'pending' || current.save?.status === 'unknown' || current.languageLocked;
    };
    const stopGuard = services.navigation.registerGuard(destination => {
      if(!destination)return !hasUnsavedWork()||window.confirm('当前工作尚未确认保存，仍要离开？原恢复记录将保留。');
      return (async()=>{
        const input=document.activeElement;
        if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement){if(workbenchElement?.contains(input)){input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();}}
        const protectedWork=await coordinator.protect();
        if(!protectedWork){editError='浏览器保护尚未成功，不能离开当前工作。';return false;}
        return true;
      })();
    }, ()=>hasUnsavedWork()&&coordinator.snapshot().sync?.protection!=='protected');
    const pageId = (taskUrl??services.navigation.current()).searchParams.get('page');
    let syncEnabled = false;
    const enableSync = () => {
      if (syncEnabled) return;
      syncEnabled = true;
      coordinator.enableAutoSync({ storage: createIndexedAuthoringStorage<DurableAuthoringState>(), port: stableSavePort });
    };
    const resume = async (targetPageId: string | null) => { enableSync(); if (targetPageId) await coordinator.load(targetPageId, {resourceId:(taskUrl??services.navigation.current()).searchParams.get('resource') ?? undefined,localOnly:!active}); };
    if (languageRecoveryPort) {
      languageRecovery = createAuthoringLanguageRecovery({ coordinator, port: languageRecoveryPort,
        identity: () => { const config = readRuntimeConfig(); return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' }; },
        currentPageId: () => (taskUrl??services.navigation.current()).searchParams.get('page'), resume, protectSaved: enableSync });
      languageRecovery.subscribe(value => { recoveryState = value; });
      void languageRecovery.check(pageId);
      onLanguageRecoveryReady?.(languageRecovery);
    } else {const resumed=resume(pageId);activated=active;activateTask=()=>{if(activated)return;activated=true;void resumed.then(()=>{const snapshot=coordinator.snapshot();const currentPageId=snapshot.ref?.pageId??String(snapshot.draft?.pageDocument.id??taskUrl?.searchParams.get('page')??'');if(currentPageId&&!snapshot.dirty&&!snapshot.languageLocked&&!snapshot.sync?.pending)void coordinator.load(currentPageId,{refreshCurrent:!!snapshot.draft,resourceId:snapshot.ref?.resourceId??taskUrl?.searchParams.get('resource')??undefined});});};}
    coordinator.setOnline(navigator.onLine);
    if (parameterInstancePort && parameterContextRef) {
      parameterInstance = createParameterInstanceSession({port: parameterInstancePort, scope: () => {
        const config=readRuntimeConfig(); const snapshot=coordinator.snapshot();
        const instancePageId=snapshot.ref?.pageId??snapshot.draft?.pageDocument.id;
        return {contextRef:parameterContextRef!(),actorId:config?.operatorId??'',workspaceId:config?.workspaceId??'',
          pageId:typeof instancePageId==='string'?instancePageId:'',sourceKey:canonicalizeJson({scope:coordinator.scope(),ref:snapshot.ref,draft:snapshot.draft?.pageDocument})};
      }});
      parameterInstance.subscribe(value => {instanceState=value;});
      onParameterInstanceReady?.(parameterInstance);
    }
    const online = () => coordinator.setOnline(true);
    const offline = () => coordinator.setOnline(false);
    window.addEventListener('online', online); window.addEventListener('offline', offline);
    if (publicationPort.available) publication = createAuthoringPublication({ port: publicationPort, human: humanConfirmation, scope: coordinator.scope, synchronizedRef: coordinator.requireSynchronizedRef, identity: () => { const config = readRuntimeConfig(); return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' }; } });
    if(parameterSourcePort) parameterReview=createInlineParameterPublication({
      readVerifiedSource:baseline=>parameterSourcePort!.readVerifiedSource(baseline),
      sourceKey:()=>canonicalizeJson({ref:coordinator.requireSynchronizedRef(),scope:coordinator.scope()}),
      preview:(document,signal)=>{if(!dataGateway)throw Error('查询网关尚未接入');return previewParameterPage(document,dataGateway,signal);},
      save:async(document,key,selected)=>{await coordinator.publishTemplate(document,key,selected);return {status:'queued'};}
    });
    publication?.subscribe(value => { publicationBusy = value.phase === 'busy' || value.phase === 'unknown'; });
    const unsubscribe = coordinator.subscribe((snapshot) => { authoring = snapshot; publication?.invalidate(); parameterReview?.invalidate(); parameterInstance?.invalidate(); });

    if (languagePort) {
      language = createAuthoringLanguage({ coordinator, port: languagePort, target: window,
        selection: () => currentDocument && selectedComponent ? { pageId: String(currentDocument.id), componentId: selectedComponent.componentId } : null,
        flushPendingInput: () => {
          const input = document.activeElement;
          if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || !workbenchElement?.contains(input)) return;
          flushingInput = true;
          try { input.dispatchEvent(new Event('change', { bubbles: true })); input.blur(); } finally { flushingInput = false; }
        },
        identity: () => { const config = readRuntimeConfig(); return { actorId: config?.operatorId ?? '', workspaceId: config?.workspaceId ?? '' }; } });
      language.subscribe((value) => { languageState = value; });
      onLanguageReady?.(language);
      // The active view connects below; background leases remain owned by this task.
    }
    const stop = languagePort ? () => {} : listenForSavedDrafts({
      target: window, read: coordinator.readSavedDraft,
      captureIdentity: () => {
        const identity = readRuntimeConfig();
        return JSON.stringify([identity?.operatorId, identity?.workspaceId]);
      },
      captureScope: coordinator.scope,
      onpage: (draft) => {
        const accepted = coordinator.acceptSavedDraft(draft);
        if (accepted) { previewOpen = false; saveError = ''; relocateSelection(); }
        return accepted;
      },
      onerror: (message) => { saveError = message; }
    });
    const stopApplyPage = listenForApplyPage({
      target: window,
      captureIdentity: () => {
        const config = readRuntimeConfig();
        return JSON.stringify([config?.operatorId, config?.workspaceId]);
      },
      onpreview: (previewJson) => {
        if(!active)return;
        if (languagePort || publicationBusy || languageRecoveryPort) {
          saveError = '当前受控操作尚未完成，暂不能应用页面通知。'; return;
        }
        if (coordinator.applyPreview(previewJson)) {
          previewOpen = false; saveError = ''; editError = ''; relocateSelection();
        }
      },
      onapply: async (pageId) => {
        if(!active)return;
        if (languagePort || publicationBusy || languageRecoveryPort) {
          saveError = '当前受控操作尚未完成，暂不能应用页面通知。'; return;
        }
        saveError = '';
        await coordinator.load(pageId, { refreshCurrent: true });
        if (!coordinator.snapshot().error) { previewOpen = false; relocateSelection(); }
      },
      onerror: (message) => { saveError = message; }
    });
    return () => { stopWork();stopGuard(); stopInvalidation(); window.removeEventListener('online', online); window.removeEventListener('offline', offline); stopApplyPage(); stop(); language?.dispose(); languageRecovery?.dispose(); publication?.dispose(); parameterReview?.dispose(); parameterInstance?.dispose(); unsubscribe(); coordinator.dispose(); };
  });

  $effect(()=>{if(!active)activated=false;else if(activateTask)activateTask();});
  $effect(()=>{if(active&&showPageInfo)settingsOpen=true;});
  $effect(()=>{if(active&&language)return services.authoring?.connect?.(language);});
  const displayTitle=$derived.by(()=>{const meta=authoring.draft?.pageDocument.meta;return meta&&typeof meta==='object'&&'title' in meta&&typeof meta.title==='string'?meta.title:String(authoring.draft?.pageDocument.id??'新建页面');});
  $effect(()=>{if(taskUrl&&authoring.draft)void services.workSession.bind(taskUrl,String(authoring.draft.pageDocument.id),authoring.ref?.resourceId).catch(error=>{editError=String(error);});});
  const currentDocument = $derived(currentDraft?.pageDocument ?? null);
  const canvasDocument = $derived(currentDraft?.canvasDocument ?? null);
  const pageModel = $derived(
    currentDocument ? workbenchPageViewModel(currentDocument) : null
  );
  const selectedView = $derived(
    selectedComponent === null
      ? null
      : (pageModel?.components.find(
          (component) => component.componentId === selectedComponent?.componentId
        ) ?? null)
  );
  const typeCandidates = $derived(
    currentDocument && selectedView?.dataSourceId
      ? componentCandidatesFor(currentDocument, selectedView.dataSourceId)
      : []
  );
  const selectedSpan = $derived.by(() => {
    if (!canvasDocument || !selectedComponent) return null;
    const sections = Array.isArray(canvasDocument.sections)
      ? (canvasDocument.sections as Array<Record<string, unknown>>)
      : [];
    for (const section of sections) {
      if (section.id !== selectedComponent.sectionId) continue;
      const components = Array.isArray(section.components)
        ? (section.components as Array<Record<string, unknown>>)
        : [];
      const component = components.find(
        (candidate) => candidate.id === selectedComponent?.componentId
      );
      const layout = component?.layout;
      if (typeof layout === 'object' && layout !== null) {
        const span = (layout as { span?: unknown }).span;
        return typeof span === 'number' ? span : null;
      }
    }
    return null;
  });
  const selectedColumnCount = $derived.by(() => {
    if (!canvasDocument || !selectedComponent) return 12;
    const sections = Array.isArray(canvasDocument.sections)
      ? (canvasDocument.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections.find((candidate) => candidate.id === selectedComponent?.sectionId);
    return Array.isArray(section?.columnTracks) ? section.columnTracks.length : 12;
  });
  const selectedFieldRows = $derived.by(() => {
    if (!currentDocument || !selectedView?.dataSourceId) return [];
    const dataSources = currentDocument.dataSources;
    if (typeof dataSources !== 'object' || dataSources === null) return [];
    const dataSource = (dataSources as Record<string, unknown>)[selectedView.dataSourceId];
    if (typeof dataSource !== 'object' || dataSource === null) return [];
    const fields = (dataSource as { fields?: unknown }).fields;
    if (typeof fields !== 'object' || fields === null) return [];
    return Object.entries(fields as Record<string, Record<string, unknown>>).map(
      ([fieldId, field]) => ({
        fieldId,
        label: typeof field.label === 'string' ? field.label : fieldId,
        role: typeof field.role === 'string' ? field.role : '',
        type: typeof field.type === 'string' ? field.type : ''
      })
    );
  });

  async function saveRevision() {
    if (!currentDocument || !pageModel || saveBlocked) return;
    const input=document.activeElement;if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement){if(workbenchElement?.contains(input))input.dispatchEvent(new Event('change',{bubbles:true}));}
    saveError = '';
    await coordinator.save();
  }

  function relocateSelection() {
    if (selectedComponent && currentDraft) selectedComponent = locatorOfComponent(currentDraft.canvasDocument, selectedComponent.componentId);
  }

  function applyDocumentEdit(result: DocumentEditResult) {
    if (result.ok) {
      if (coordinator.replaceDraft(result.draft)) { relocateSelection(); editError = ''; }
    } else editError = result.message;
  }

  /** 画布创作意图分发:选中进检查器,重排与标题/宽度编辑走本地文档改写。 */
  function handleAuthoringIntent(intent: AuthoringIntent) {
    if (intent.type === 'select_component') {
      selectedComponent = intent.locator;
      return;
    }
    if ((savePending && !flushingInput) || !currentDraft) return;
    if (intent.type === 'move_component') {
      const result = moveComponent(currentDraft, intent.locator, intent.destination);
      applyDocumentEdit(result);
      if (result.ok) {
        selectedComponent = locatorOfComponent(
          result.draft.canvasDocument,
          intent.locator.componentId
        );
      }
    } else if (intent.type === 'delete_component') {
      applyDocumentEdit(deleteComponent(currentDraft, intent.locator));
    } else if (intent.type === 'edit_component') {
      applyDocumentEdit(editComponent(currentDraft, intent.locator, intent.edit));
    }
  }

  /** 组件形态切换通过浏览器局部构造即时改写工作副本。 */
  function selectComponentType(type: string) {
    if (savePending || !currentDraft || !selectedComponent || !selectedView?.dataSourceId) return;
    const result = changeComponentType(
      currentDraft,
      selectedComponent,
      type as Parameters<typeof changeComponentType>[2]
    );
    applyDocumentEdit(result);
  }

  function selectComponentFromList(componentId: string) {
    if (!canvasDocument) return;
    selectedComponent = locatorOfComponent(canvasDocument, componentId);
  }

  async function managePageRecord(action:'remove'|'restore',version?:number){
    const ref=coordinator.requireSynchronizedRef();
    const result=action==='remove'?recordManager.remove(ref):recordManager.restore(ref,version!);
    const preparation=coordinator.beginPreparation();
    let outcome;
    try{outcome=await result;}finally{preparation.release();}
    if(outcome.status!=='confirmed')throw Error(outcome.message);
    if(action==='remove'){
      await services.workSession.forgetAsset(ref);
      await services.navigation.navigate(services.workSession.snapshot().directory);
    }else await coordinator.load(ref.pageId,{resourceId:ref.resourceId,refreshCurrent:true});
  }

  function closeMetadataDrawer() {
    metadataOpen = false;
    void tick().then(() => metadataEntryEl?.focus());
  }
</script>
<svelte:head>
  <title>MetricCanvas 页面搭建工作台</title>
</svelte:head>

<div bind:this={workbenchElement} class="workbench" class:reading={previewOpen} data-testid="workbench">
  {#if previewOpen}
    <div class="reading-toolbar">
      <ReadingHeader title={previewRef?(savedPreviewTitle||previewRef.pageId):displayTitle} revision={previewRef?savedPreviewNumber:undefined} status={previewRef?savedPreviewStatus:undefined} source={previewRef?'已保存内容':'工作副本'} backLabel="继续编辑" onback={()=>{previewOpen=false;previewRef=null;}}>
        {#if authoring.ref}<Select label="预览内容" value={previewRef?'saved':'working'} options={[{value:'working',label:'工作副本'},{value:'saved',label:'已保存内容'}]} onchange={value=>{previewRef=value==='saved'&&authoring.ref?{...authoring.ref}:null;}}/>{/if}
      </ReadingHeader>
    </div>
  {:else}
  <div class="docbar" data-testid="workbench-contextbar" data-contract-critical>
    <div class="l">
      <ToolAction icon="back" iconOnly ariaLabel="返回页面管理" onclick={()=>services.navigation.navigate(services.workSession.snapshot().directory)}/>
      {#if currentDraft&&!previewOpen}<div class="page-title-editor"><Input label="页面标题" value={typeof currentDraft.pageDocument.meta==='object'&&currentDraft.pageDocument.meta&&'title' in currentDraft.pageDocument.meta&&typeof currentDraft.pageDocument.meta.title==='string'?currentDraft.pageDocument.meta.title:''} placeholder={displayTitle} disabled={savePending||loading||(titleIsBound&&!replaceBoundTitle)} oncommit={value=>{if(currentDraft)applyDocumentEdit(editPageTitle(currentDraft,value));}}/>{#if titleIsBound&&!replaceBoundTitle}<ToolAction onclick={()=>replaceBoundTitle=true}>改为固定标题</ToolAction>{/if}</div>{:else}<strong class="canvas-title">{displayTitle}</strong>{/if}
      {#if pageModel&&!previewOpen}
        <span class="badge" class:transient={pageModel.transient}>
          {pageModel.transient ? '临时页面态' : authoring.dirty ? '未保存工作副本' : '已保存页面修订'}
        </span>
        {#if pageModel.adHocFormulas.length > 0}
          <!-- 临时指标与已定义指标视觉可区分(ADR-0036、#67):文档含现场
               生成的 formula 口径时,结果区常驻警示徽标。 -->
          <span class="badge adhoc" title={pageModel.adHocFormulas.join(';')}>
            临时指标 ×{pageModel.adHocFormulas.length}
          </span>
        {/if}
      {:else if !pageModel}
        <span class="badge idle">尚无页面文档</span>
      {/if}
    </div>
    <div class="r" data-testid="document-actions">
      <ToolAction icon="eye" disabled={!currentDocument} ariaLabel={previewOpen?'继续编辑':'预览当前页面'} onclick={()=>{previewRef=null;previewOpen=!previewOpen;}}>{previewOpen?'继续编辑':'预览'}</ToolAction>
      {#if !previewOpen}
        <ToolAction icon="undo" iconOnly ariaLabel="撤销上一步" disabled={!authoring.sync?.canUndo||loading||savePending} onclick={async()=>{try{await coordinator.undo();editError='';}catch(error){editError=String(error);}}}/>
        <ToolAction icon="code" iconOnly bind:element={metadataEntryEl} testId="metadata-json-entry" ariaLabel="查看元数据" disabled={!currentDocument} onclick={()=>metadataOpen=true}/>
        <ToolAction icon="settings" expanded={settingsOpen} controls={settingsId} onclick={()=>settingsOpen=!settingsOpen}>页面设置</ToolAction>
        {#if pageModel}<PrimaryAction disabled={saveBlocked||!authoring.dirty||authoring.sync?.phase==='saving'} onclick={saveRevision}>{(authoring.sync?authoring.sync.phase==='saving':savePending)?'保存中…':authoring.sync?'保存草稿':baseRevisionId?'保存新修订':'保存首个修订'}</PrimaryAction>{/if}
      {/if}
    </div>
  </div>

  {/if}

  <aside class="chat" aria-label="分析会话" data-testid="workbench-track">
    {#if active}<PanguDialogue adapter={dialogueAdapter} />{/if}

  </aside>

  <main class="canvas" aria-label="页面画布" data-testid="workbench-track">
    {#if settingsOpen&&!previewOpen}
      <section class="settings-panel" id={settingsId} aria-label="页面设置">
        <h2 class="settings-heading">创作与发布</h2>
        <div class="settings-actions">
          <ToolAction onclick={()=>services.navigation.navigate(createHref(services.navigation.base,{newTask:true}))}>新建页面</ToolAction>
          {#if parameterReview}<ToolAction disabled={saveBlocked||authoring.dirty} onclick={()=>parameterReviewOpen=!parameterReviewOpen}>参数模板评审</ToolAction>{/if}
          {#if publicationPort.available}<ToolAction disabled={!authoring.ref||authoring.languageLocked} onclick={()=>publicationOpen=!publicationOpen}>发布评审</ToolAction>
          {:else}<ToolAction disabled={!authoring.ref||authoring.dirty||saveBlocked||authoring.sync?.phase==='saving'} onclick={async()=>{if(!window.confirm('发布当前页面？后续保存编辑会将当前记录改为草稿。'))return;try{await coordinator.publish();}catch(error){saveError=String(error);}}}>发布当前记录</ToolAction>{/if}
          {#if !authoringPort.assets}<ToolAction disabled={!authoring.ref} onclick={()=>historyOpen=!historyOpen}>页面历史</ToolAction>{/if}
        </div>
        {#if pageModel}<p class="document-summary">{pageModel.components.length} 个组件 · {pageModel.dataSourceCount} 个页面数据源</p>{/if}
        {#if authoring.sync&&stableSavePort.delivery!=='single'}<label class="stat"><input type="checkbox" bind:checked={retainDimensionValues} disabled={savePending} onchange={event=>coordinator.setRetainDimensionValues(event.currentTarget.checked)}/>保存时保留维度取值</label>{#if authoring.sync.pending>0}<ToolAction disabled={authoring.sync.phase==='saving'} onclick={()=>coordinator.retrySync()}>核实并重试同步</ToolAction>{/if}{/if}
        {#if authoringPort.assets&&authoring.ref}{#key authoring.ref.revisionId}<PageAssetInfo asset={authoring.ref} disabled={authoring.dirty||saveBlocked||loading} onaction={managePageRecord}/>{/key}{/if}
      </section>
    {/if}
    {#if historyOpen}{#key authoring.ref?.resourceId}<AuthoringHistory list={coordinator.listHistory} restore={coordinator.restoreRevision} />{/key}{/if}
    {#if recoveryState}
      <p class="notice" role="status" data-testid="language-recovery-status">{recoveryState.message || '正在检查未决操作…'}</p>
      {#if !recoveryState.summary}
        <button class="btn" disabled={recoveryState.busy} onclick={() => languageRecovery?.check((taskUrl??services.navigation.current()).searchParams.get('page'))}>再次检查恢复</button>
      {:else}
        <button class="btn" disabled={recoveryState.busy || recoveryState.phase === 'opened'} onclick={() => languageRecovery?.recover()}>查询原操作</button>
        <button class="btn" disabled={recoveryState.busy || recoveryState.summary.cancelRequested || !recoveryState.locked} onclick={() => languageRecovery?.cancel()}>取消未完成操作</button>
        {#if recoveryState.summary.status === 'not-applied' && !recoveryState.summary.cancelRequested}<button class="btn" disabled={recoveryState.busy} onclick={() => languageRecovery?.retryOriginal()}>重试原操作</button>{/if}
        {#if recoveryState.summary.status === 'saved'}<button class="btn" disabled={recoveryState.busy || !recoveryState.locked} onclick={() => languageRecovery?.openSaved()}>打开已保存修订</button>{/if}
      {/if}
    {/if}
    {#if languageState}
      <p class="notice" role="status" data-testid="language-status">{languageState.message}</p>
      {#if languageState.operations.length}<ul aria-label="本轮操作结果">{#each languageState.operations as operation}<li>{operation.id}：{operation.status}</li>{/each}</ul>{/if}
      {#if ['synchronizing', 'running', 'reading', 'unknown'].includes(languageState.phase)}<button class="btn" onclick={() => language?.cancel()}>停止接收本轮结果</button>{/if}
      {#if ['unknown', 'cancelled', 'recovered'].includes(languageState.phase) && authoring.languageLocked}<button class="btn" onclick={() => language?.lookup()}>查询本轮保存结果</button>{/if}
      {#if languageState.recovery}<button class="btn" onclick={() => { previewRef = languageState!.recovery; previewOpen = true; }}>查看取消后已保存修订</button><a class="linkish" href={resolve('/manage')}>返回页面目录重新打开</a>{/if}
    {/if}
    {#if saveNotice}<p class="notice">{saveNotice}</p>{/if}
    {#if authoring.sync?.lastSaved?.revision?.isDraft === false}<p role="status">当前页面已发布。</p>{/if}
    {#if authoring.sync}
      {#if authoring.sync.protection === 'failed'}
        <p class="error" role="alert">浏览器保护失败，请勿关闭页面。{authoring.sync.message}</p>
      {:else if authoring.sync.phase==='unknown'}
        <p class="notice" role="status" data-testid="authoring-save-state">保存结果未确认，已停止重复发送。工作副本与原操作记录仍在此浏览器保护。</p>
      {:else if authoring.sync.pending > 0}
        <p class="notice" role="status">{authoring.sync.protection === 'protected' ? '已在浏览器保护' : '正在保护到浏览器'}，待同步 {authoring.sync.pending} 个操作。{authoring.sync.message}</p>
      {:else if authoring.dirty}<p class="notice" role="status" data-testid="authoring-save-state">{authoring.sync.protection==='protected'?'已在此浏览器保护，尚未保存到服务端。':'正在保护当前修改…'}</p>
      {:else if authoring.sync.lastSaved}
        <p class="notice" role="status" data-testid="authoring-save-state">草稿已保存。</p>
      {/if}
    {/if}
    {#if saveError || authoring.error}<p class="error" role="alert">{saveError || authoring.error}</p>{/if}
    {#if authoring.save?.status === 'unknown'}<p class="error" role="alert">保存结果未确定，已暂停再次保存。{authoring.save.message} 工作副本仅在本页内存中，尚无浏览器恢复保护。</p>{/if}
    {#if authoring.save?.status === 'rejected'}<p class="error" role="alert">{authoring.save.code}：{authoring.save.message}</p>{/if}
    {#if editError}<p class="error" role="alert">{editError}</p>{/if}

    <div class="page-scroll">
      {#if parameterReviewOpen && parameterReview}
        <InlineParameterReview publication={parameterReview} {dataGateway}/>
      {:else if publicationOpen && publication}
        <PublicationReview {publication} />
      {:else if previewOpen && !previewRef && currentDocument && active}<RuntimeView displayInputs={services.displayInputs} document={currentDocument} {dataGateway}/>
      {:else if previewOpen && previewRef && active}
        <RevisionPreview pageId={previewRef.pageId} revisionId={previewRef.revisionId}
          readRevision={readSavedPreview} />
      {:else if active&&(instanceState.document || instanceState.loading || instanceState.error)}
        <div aria-label="参数化页面临时运行">
          <p>临时运行，不修改或保存当前页面。<button onclick={() => parameterInstance?.close()}>关闭运行预览</button></p>
          {#if instanceState.error}<p role="alert">{instanceState.error}</p>
          {:else if instanceState.loading}<p role="status">正在读取运行产物…</p>
          {:else if instanceState.document}<RuntimeView displayInputs={services.displayInputs} document={instanceState.document} {dataGateway} />{/if}
        </div>
      {:else if currentDocument&&active}
        <MetricCanvas
          displayInputs={services.displayInputs}
          document={currentDocument}
          {dataGateway}
          enabled={!savePending}
          selected={selectedComponent ?? undefined}
          draftSections={currentDraft?.authoringSections}
          inlineControls={false}
          allowDelete
          onintent={handleAuthoringIntent}
        />
      {:else}
        <div class="empty">
          <h2>{loading ? '正在加载页面文档…' : '从页面目录打开页面'}</h2>
          <p>
            已保存页面可在这里调整组件与布局，并显式保存为新修订。
          </p>
        </div>
      {/if}
    </div>
  </main>

  <aside
    class="inspector-track"
    aria-label="检查器"
    data-testid="workbench-track"
    data-contract-critical
  >
    <Inspector
      {pageModel}
      selected={selectedComponent}
      {selectedView}
      {selectedSpan}
      {selectedColumnCount}
      onClearSelection={() => selectedComponent = null}
      dateDraft={currentDraft}
      onDateEdit={(edit)=>{if(currentDraft&&!previewOpen&&!loading&&(currentDraft.pageDocument.layout==='dashboard'||selectedComponent))applyDocumentEdit(editReportDate(currentDraft,currentDraft.pageDocument.layout==='dashboard'?null:selectedComponent,edit));}}
      properties={propertyControls(currentDraft, selectedComponent)}
      onPropertyEdit={(edit) => { if (currentDraft && (selectedComponent||edit.kind==='presentation') && !previewOpen && !loading) applyDocumentEdit(editProperty(currentDraft, selectedComponent??{sectionId:'',componentId:''}, edit)); }}
      candidates={typeCandidates}
      fieldRows={selectedFieldRows}
      busy={savePending || previewOpen || loading}
      onSelectType={selectComponentType}
      onSelectComponent={selectComponentFromList}
      onEdit={(edit) => {
        if ((!savePending || flushingInput) && currentDraft && selectedComponent) {
          applyDocumentEdit(editComponent(currentDraft, selectedComponent, edit));
        }
      }}
    />
  </aside>

  {#if metadataOpen && currentDocument && pageModel}
    <MetadataJsonDrawer
      document={currentDocument}
      pageId={pageModel.pageId}
      transient={pageModel.transient}
      onclose={closeMetadataDrawer}
    />
  {/if}
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: var(--analysis-rail-w) minmax(0, 1fr) var(--inspector-rail-w);
    grid-template-rows:auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    min-width: 0;
    background: var(--bg);
    overflow: hidden;
  }
  .workbench.reading {grid-template-columns:minmax(0,1fr);}
  .reading-toolbar{grid-column:1/-1;grid-row:1;min-width:0}
  .workbench.reading .page-scroll{padding:24px}
  .settings-heading{font-size:14px;font-weight:600;margin:0 0 12px;color:#191919}
  .workbench.reading .chat,.workbench.reading .inspector-track{display:none}
  .workbench.reading .canvas{grid-column:1}
  .chat {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    color: var(--text);
    background: var(--surface);
    border-right: 1px solid var(--line);
  }
  .canvas {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }
  .inspector-track {
    grid-column: 3;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--surface);
    border-left: 1px solid var(--line);
  }
  .inspector-track :global(.inspector) {
    width: 100%;
    height: 100%;
  }
  .docbar {
    grid-column: 1 / -1;
    grid-row: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: var(--contextbar-h);
    height:auto;
    flex-wrap:wrap;
    padding-block:8px;
    min-width: 0;
    padding: 10px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .docbar .l,
  .docbar .r {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .docbar .r {
    flex: 0 1 auto;
    flex-wrap:wrap;
  }
  .docbar .l{flex:1 1 260px;flex-wrap:wrap}
  .docbar .r{margin-left:auto;gap:8px}
  .page-title-editor{min-width:120px;max-width:320px;flex:1}
  .settings-panel{flex:none;max-height:50%;overflow:auto;padding:24px;background:var(--surface);border-bottom:1px solid var(--line)}
  .settings-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
  .document-summary{font-size:12px;color:#808080;margin:12px 0 0}
  .canvas-title {
    flex: none;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
  }
  .badge {
    padding: 2px 7px;
    color: #3730a3;
    background: #eef2ff;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
  }
  .badge.transient {
    color: #92400e;
    background: #fef3c7;
  }
  .badge.adhoc {
    color: #92400e;
    background: #fef3c7;
    border: 1px solid #fde68a;
  }
  .badge.idle {
    color: #71717a;
    background: #f4f4f5;
  }
  .stat {
    color: #71717a;
    font-size: 12px;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.75);
    }
  }

  .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:3px 6px;border:0;border-radius:4px;background:transparent;color:#595959;font:inherit;font-size:14px;line-height:20px;cursor:pointer;text-decoration:none}
  .btn:hover:not(:disabled){background:#f0f0f0;color:#191919}.btn:focus-visible{outline:2px solid #1476ff;outline-offset:2px}.btn:disabled{color:#c2c2c2;cursor:not-allowed}
  .notice {
    margin: 0;
    padding: 6px 12px;
    color: #166534;
    background: #f0fdf4;
    border-bottom: 1px solid #dcfce7;
    font-size: 12px;
  }
  .error {
    margin: 0;
    padding: 6px 12px;
    color: #b91c1c;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    font-size: 12px;
  }
  .page-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  /* 运行中的骨架屏:预示即将出现的看板网格,shimmer 呼吸。 */

  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
  .empty {
    display: grid;
    place-content: center;
    min-height: 60cqh;
    text-align: center;
    color: #71717a;
  }
  .empty h2 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #3f3f46;
  }
  .empty p {
    margin: 0;
    max-width: 42rem;
    font-size: 13px;
    line-height: 1.7;
  }
  @container platform (max-width: 760px) {
    .workbench {
      grid-template-columns: minmax(0, 1fr);
    }
    .chat {
      display: none;
    }
    .canvas {
      grid-column: 1;
    }
    .inspector-track {
      display: none;
    }
  }
  @media(max-width:700px){.workbench.reading .page-scroll,.settings-panel{padding:16px}}
</style>
