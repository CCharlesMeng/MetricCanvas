import type { Handle } from '@sveltejs/kit';
import { createIdentity } from '$lib/server/identity.server';

/**
 * 唯一写入 `event.locals.identity` 的地方。默认身份对应 workbench 客户端;
 * 需要不同 clientId(以及由此决定的角色)的路由用 `withClient` 派生,而不是
 * 自己再拼一个身份对象。
 */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.identity = createIdentity('workbench');
  return resolve(event);
};
