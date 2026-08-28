import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
  MOCK_ACTOR_COOKIE,
  MOCK_ACTOR_HEADER,
  MOCK_ACTOR_QUERY_PARAM,
  MOCK_USERS,
  createIdentity,
  defaultClientIdForRole,
  resolveMetricCanvasRole,
  resolveMockActor
} from '$lib/server/identity.server';

/**
 * 唯一写入 `event.locals.identity` 的地方。mock 用户判定逻辑单点在
 * identity.server.ts 的 resolveMockActor(优先级 header > query > cookie >
 * 默认;查询参数切换时写 cookie 使切换在后续导航保持;显式清单外拒绝,
 * cookie 残值宽松清除),这里只做 SvelteKit 事件的粘合。默认身份对应
 * 客户端由部署角色决定:authoring 保留 workbench 开发行为,
 * reader 使用零角色 reader clientId;需要其他 clientId 的路由用 `withClient` 派生。
 */
export const handle: Handle = async ({ event, resolve }) => {
  const resolution = resolveMockActor({
    header: event.request.headers.get(MOCK_ACTOR_HEADER),
    query: event.url.searchParams.get(MOCK_ACTOR_QUERY_PARAM),
    cookie: event.cookies.get(MOCK_ACTOR_COOKIE) ?? null
  });
  if (!resolution.ok) {
    const known = MOCK_USERS.map((candidate) => candidate.actorId).join(', ');
    return new Response(
      JSON.stringify({ message: `未知的 mock 用户 ${resolution.requested},可用:${known}` }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
  if (resolution.persist) {
    event.cookies.set(MOCK_ACTOR_COOKIE, resolution.user.actorId, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false
    });
  }
  if (resolution.clearCookie) {
    event.cookies.delete(MOCK_ACTOR_COOKIE, { path: '/' });
  }
  event.locals.identity = createIdentity(
    defaultClientIdForRole(resolveMetricCanvasRole(env)),
    resolution.user
  );
  return resolve(event);
};
