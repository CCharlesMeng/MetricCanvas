import {normalizeRouteBase} from '../lib/integration/navigation';
import type {PlatformPortalProps} from '../lib/integration/contract';
import type {AuthoringIntegration} from '../lib/dialogue/authoring-integration';
/** HTML entry contract, not an npm mounting API. */
export type PlatformProps = PlatformPortalProps<AuthoringIntegration>;
export interface QiankunPlatformProps extends PlatformProps {container:HTMLElement;}
export function portalConfig(props:QiankunPlatformProps):PlatformProps {
  if(typeof props.readConfig!=='function' || typeof props.subscribeConfig!=='function')throw Error('平台需要 readConfig 和 subscribeConfig。');
  return {...props,routeBase:normalizeRouteBase(props.routeBase) || '/'};
}
