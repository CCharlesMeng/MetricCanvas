import {normalizeRouteBase} from '../lib/integration/navigation';
import type {PlatformPortalProps, PlatformDeploymentAdapter} from '../lib/integration/contract';
import type {AuthoringIntegration} from '../lib/dialogue/authoring-integration';
/** HTML entry contract, not an npm mounting API. */
export type PlatformProps = PlatformPortalProps<AuthoringIntegration>;
export interface QiankunPlatformProps extends PlatformProps {container:HTMLElement;}
export function portalConfig(props:PlatformProps):PlatformProps {
  if(typeof props.readConfig!=='function')throw Error('平台需要 readConfig。');
  if(props.configChanges !== undefined && props.configChanges !== 'subscribe' && props.configChanges !== 'reload')throw Error('无效的配置变化策略。');
  if(typeof props.subscribeConfig !== 'function' && props.configChanges !== 'reload')throw Error('平台需要配置订阅，或明确声明身份变化将整页重载。');
  if(props.subscribeConfig !== undefined && typeof props.subscribeConfig !== 'function')throw Error('无效的配置订阅。');
  return {...props,routeBase:normalizeRouteBase(props.routeBase) || '/'};
}

/** Prefer an explicit deployment adapter; never fall back after its validation fails. */
export async function connectPortal(
  input: Record<string, unknown>,
  adapter?: PlatformDeploymentAdapter<AuthoringIntegration>
) {
  if (!adapter) return {props: portalConfig(input as unknown as PlatformProps), disconnect: async () => {}};
  if (adapter.contractVersion !== '1' || typeof adapter.connect !== 'function') throw Error('不兼容的平台部署 Adapter 契约。');
  const connection = adapter.connect(Object.freeze({...input}));
  let cleanup: Promise<void> | undefined;
  const disconnect = () => cleanup ??= Promise.resolve().then(() => connection.disconnect?.());
  try {
    if (!connection || typeof connection !== 'object' || !connection.props ||
        (connection.disconnect !== undefined && typeof connection.disconnect !== 'function')) throw Error('无效的平台部署接线。');
    return {props: portalConfig(connection.props), disconnect};
  } catch (error) {
    if (connection && typeof connection.disconnect === 'function') await disconnect();
    throw error;
  }
}
