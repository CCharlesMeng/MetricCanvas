import {describe, expect, it, vi} from 'vitest';
import {connectPortal, portalConfig} from '../../src/microfrontend/portal-config';
import type {PlatformDeploymentAdapter} from '../../src/lib/integration/contract';

const props = {routeBase:'/metrics', readConfig:()=>null, configChanges:'reload' as const};
describe('independent deployment adapter', () => {
  it('handles host replacement of props without relying on the discarded standard config', async () => {
    const app: {props: Record<string, unknown>} = {props};
    const appList = [{appUrl:'/metrics'}], roleList = ['reader'];
    app.props = {appList, roleList};
    await expect(connectPortal(app.props)).rejects.toThrow('readConfig');
    let config = {authToken:'initial-token'};
    const connect = vi.fn(input => {
      expect(input).toEqual({appList, roleList});
      return {props:{...props,readConfig:()=>config}};
    });
    const connection = await connectPortal(app.props,{contractVersion:'1',connect});
    expect(connection.props.routeBase).toBe('/metrics');
    expect(connection.props.readConfig()?.authToken).toBe('initial-token');
    config = {authToken:'refreshed-token'};
    expect(connection.props.readConfig()?.authToken).toBe('refreshed-token');
    expect(connect).toHaveBeenCalledTimes(1);
    await connection.disconnect();
  });
  it('accepts an explicit reload deployment without inventing a subscription', () => {
    expect(portalConfig(props).subscribeConfig).toBeUndefined();
    expect(()=>portalConfig({...props, configChanges:undefined})).toThrow('配置订阅');
  });
  it('keeps direct props integration and live subscriptions compatible', async () => {
    const subscribeConfig = vi.fn(() => vi.fn());
    const result = await connectPortal({...props, configChanges:undefined, subscribeConfig});
    expect(result.props.subscribeConfig).toBe(subscribeConfig);
    expect(subscribeConfig).not.toHaveBeenCalled();
    await result.disconnect();
  });
  it('maps unknown host props outside platform code and disconnects only once', async () => {
    const disconnect = vi.fn();
    const connect = vi.fn(input => {expect(Object.isFrozen(input)).toBe(true);return {props,disconnect};});
    const adapter:PlatformDeploymentAdapter = {contractVersion:'1',connect};
    const result = await connectPortal({permissions:[], hostSpecific:{opaque:true}}, adapter);
    expect(result.props.routeBase).toBe('/metrics');
    await Promise.all([result.disconnect(),result.disconnect()]);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });
  it('cleans up on invalid mapped config without falling back to valid raw props', async () => {
    const disconnect=vi.fn();
    await expect(connectPortal(props, {contractVersion:'1',connect:()=>({props:{...props,routeBase:'bad'},disconnect})})).rejects.toThrow('routeBase');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it('rejects incompatible contracts before invoking connect', async () => {
    const connect=vi.fn();
    await expect(connectPortal(props, {contractVersion:'2',connect} as unknown as PlatformDeploymentAdapter)).rejects.toThrow('不兼容');
    expect(connect).not.toHaveBeenCalled();
  });
});
