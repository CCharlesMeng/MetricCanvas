import type { Handle } from '@sveltejs/kit';
import {
  MOCK_ACTOR_HEADER,
  MOCK_ACTOR_QUERY_PARAM,
  MOCK_USERS,
  createIdentity,
  resolveMockUser
} from '$lib/server/identity.server';

/**
 * 唯一写入 `event.locals.identity` 的地方。开发环境可用请求头 x-mock-actor 或
 * 查询参数 mock-actor 切换 mock 用户,未指定时保持 developer-1;要求了清单外的
 * 用户直接拒绝,不静默回落。默认身份对应 workbench 客户端;需要不同 clientId
 * (以及由此决定的角色)的路由用 `withClient` 派生,而不是自己再拼一个身份对象。
 */
export const handle: Handle = async ({ event, resolve }) => {
  const requestedActorId =
    event.request.headers.get(MOCK_ACTOR_HEADER) ??
    event.url.searchParams.get(MOCK_ACTOR_QUERY_PARAM);
  const user = resolveMockUser(requestedActorId);
  if (!user) {
    const known = MOCK_USERS.map((candidate) => candidate.actorId).join(', ');
    return new Response(
      JSON.stringify({ message: `未知的 mock 用户 ${requestedActorId},可用:${known}` }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
  event.locals.identity = createIdentity('workbench', user);
  return resolve(event);
};
