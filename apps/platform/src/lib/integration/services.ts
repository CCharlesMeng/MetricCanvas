import {createWorkbenchDqeGateway} from '../workbench/data-gateway';
import { getContext } from 'svelte';
import { createInjectedDqeGateway } from '@metriccanvas/application-runtime';
import { createPageAssetServices } from '../page-assets';
import { createPlatformSession } from './session';
import type { PlatformNavigation } from './navigation';
import type { DialogueAdapter } from '../dialogue/port';
import type { AuthoringIntegration } from '../dialogue/authoring-integration';
export const PLATFORM_CONTEXT = Symbol('platform-services');
export function createPlatformServices(session: ReturnType<typeof createPlatformSession>, navigation: PlatformNavigation, options: {
  embedded: boolean; dialogueAdapter?: DialogueAdapter; authoring?: AuthoringIntegration; events?: EventTarget;
}) {
  return {...createPageAssetServices({readConfig:session.readConfig,fetchImpl:session.fetchImpl}),session,navigation,
    workbenchGateway:createWorkbenchDqeGateway(session.fetchImpl,session.readConfig),
    dataGateway:createInjectedDqeGateway(session.fetchImpl,undefined,session.readConfig),
    events:options.events ?? new EventTarget(), embedded:options.embedded,
    dialogueAdapter:options.dialogueAdapter ?? {async mount(){throw Error('对话服务尚未接通。');}}, authoring:options.authoring};
}
export type PlatformServices = ReturnType<typeof createPlatformServices>;
export function usePlatformServices(): PlatformServices {
  const services = getContext<PlatformServices>(PLATFORM_CONTEXT);
  if (!services) throw Error('平台实例尚未初始化。');
  return services;
}
