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
  embedded: boolean; dialogueAdapter?: DialogueAdapter; authoring?: AuthoringIntegration;
}) {
  const config=session.readConfig();
  const workSession=createWorkSession({scope:{actorId:config?.operatorId??'',workspaceId:config?.workspaceId??'',pageId:'__platform-work-session__',serviceTarget:JSON.stringify([config?.pageMetadataBaseUrl,config?.dqeEndpoint])},base:navigation.base,origin:location.origin});
  session.onInvalidate(()=>workSession.dispose());
  return {workSession,...createPageAssetServices({readConfig:session.readConfig,fetchImpl:session.fetchImpl}),session,navigation,
    workbenchGateway:createWorkbenchDqeGateway(session.fetchImpl,session.readConfig),
    dataGateway:createInjectedDqeGateway(session.fetchImpl,undefined,session.readConfig),
    embedded:options.embedded,
    dialogueAdapter:options.dialogueAdapter ?? panguDialogueAdapter, authoring:options.authoring};
}
export type PlatformServices = ReturnType<typeof createPlatformServices>;
export function usePlatformServices(): PlatformServices {
  const services = getContext<PlatformServices>(PLATFORM_CONTEXT);
  if (!services) throw Error('平台实例尚未初始化。');
  return services;
}
