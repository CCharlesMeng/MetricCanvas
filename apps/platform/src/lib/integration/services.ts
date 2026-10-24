import {createDialogueSessions} from '../dialogue/sessions';
import {createPageInfoPort} from '../page-assets/info';
import type {PageInfoPort} from './contract';
import {platformFilterCandidates} from './filter-candidates';
import {isDisplayInputs} from '@metriccanvas/engine';
import {createWorkSession} from '../workbench/work-session';
import {createWorkbenchDqeGateway} from '../workbench/data-gateway';
import { getContext } from 'svelte';
import { createInjectedDqeGateway } from '@metriccanvas/application-runtime';
import { createPageAssetServices } from '../page-assets';
import { createPlatformSession } from './session';
import type { PlatformNavigation } from './navigation';
import type { DialogueAdapter } from '../dialogue/port';
import { panguDialogueAdapter } from '../dialogue/runtime';
import type { AuthoringIntegration } from '../dialogue/authoring-integration';
export const PLATFORM_CONTEXT = Symbol('platform-services');
export function createPlatformServices(session: ReturnType<typeof createPlatformSession>, navigation: PlatformNavigation, options: {
  embedded: boolean; displayInputs?:unknown; filterCandidates?:unknown; dialogueAdapter?: DialogueAdapter; authoring?: AuthoringIntegration; pageInfo?:PageInfoPort;
}) {
  if(options.displayInputs!==undefined&&!isDisplayInputs(options.displayInputs))throw Error('displayInputs必须实现getSnapshot/subscribe');
  const displayInputs=isDisplayInputs(options.displayInputs)?options.displayInputs:undefined;
  const candidates=platformFilterCandidates(options.filterCandidates,session);
  const config=session.readConfig();
  const workSession=createWorkSession({scope:{actorId:config?.operatorId??'',workspaceId:config?.workspaceId??'',pageId:'__platform-work-session__',serviceTarget:JSON.stringify([config?.pageMetadataBaseUrl,config?.dqeEndpoint])},base:navigation.base,origin:location.origin});
  session.onInvalidate(()=>workSession.dispose());
  const assets=createPageAssetServices({readConfig:session.readConfig,fetchImpl:session.fetchImpl});
  const dialogueAdapter=options.dialogueAdapter??panguDialogueAdapter;
  const dialogueSessions=dialogueAdapter.agent?createDialogueSessions(dialogueAdapter.agent):undefined;
  session.onInvalidate(()=>dialogueSessions?.dispose());
  return {workSession,displayInputs,...assets,session,navigation,dialogueSessions,
    pageInfo:options.pageInfo??createPageInfoPort(assets.pageAssets),
    workbenchGateway:{...createWorkbenchDqeGateway(session.fetchImpl,session.readConfig),...candidates},
    dataGateway:{...createInjectedDqeGateway(session.fetchImpl,undefined,session.readConfig),...candidates},
    embedded:options.embedded,
    dialogueAdapter, authoring:options.authoring};
}
export type PlatformServices = ReturnType<typeof createPlatformServices>;
export function usePlatformServices(): PlatformServices {
  const services = getContext<PlatformServices>(PLATFORM_CONTEXT);
  if (!services) throw Error('平台实例尚未初始化。');
  return services;
}
