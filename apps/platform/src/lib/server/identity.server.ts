import type { LifecycleContext, LifecycleRole } from '@metriccanvas/page-lifecycle';
import type { TemplateContext } from '@metriccanvas/template-library';

/**
 * 唯一的身份构造点与唯一的 mock 用户清单。平台尚无真实用户认证,开发环境以
 * 可切换的 mock 多用户模拟身份(ADR-0030:mock 必须提供多个可切换用户,且按
 * actorId 的可见性过滤必须真实执行;接入真实身份是上生产的前置条件)。
 *
 * 请求经 hooks.server.ts 解析请求头 {@link MOCK_ACTOR_HEADER} 或查询参数
 * {@link MOCK_ACTOR_QUERY_PARAM} 选择用户;未指定时保持 developer-1,
 * 不打断既有流程。引入真实身份提供方时仍只需要改这一个模块。
 */

export interface MockUser {
  actorId: string;
  /** 用户级角色。admin 表示平台管理员,可读取全部分析会话(ADR-0030)。 */
  roles: readonly LifecycleRole[];
}

const DEVELOPER_ONE: MockUser = { actorId: 'developer-1', roles: [] };

/** mock 用户唯一清单:identity、hooks 与测试共用,不得另写一份。 */
export const MOCK_USERS: readonly MockUser[] = [
  DEVELOPER_ONE,
  { actorId: 'developer-2', roles: [] },
  { actorId: 'admin-1', roles: ['admin'] }
];

export const DEFAULT_MOCK_ACTOR_ID = DEVELOPER_ONE.actorId;

/** 开发环境切换 mock 用户的请求头。 */
export const MOCK_ACTOR_HEADER = 'x-mock-actor';
/** 开发环境切换 mock 用户的查询参数(便于浏览器地址栏直接切换)。 */
export const MOCK_ACTOR_QUERY_PARAM = 'mock-actor';
/**
 * mock 用户的持久化 cookie:经查询参数显式切换后写入,使切换在后续导航
 * 中保持(顶栏切换器的支撑)。请求头与查询参数始终优先于 cookie。
 */
export const MOCK_ACTOR_COOKIE = 'mock-actor';

/**
 * 解析请求要求的 mock 用户。未要求(null / 空串)时返回默认用户;要求了
 * 清单外的用户时返回 null,由调用方(hooks)拒绝请求——静默回落到默认身份
 * 会让"以为在看 A 的数据、实际在看 developer-1 的数据"这类错误无从发现。
 */
export function resolveMockUser(requestedActorId: string | null): MockUser | null {
  if (!requestedActorId) return DEVELOPER_ONE;
  return MOCK_USERS.find((user) => user.actorId === requestedActorId) ?? null;
}

/** 请求级 mock 用户判定的输入:三个来源按优先级 header > query > cookie。 */
export interface MockActorSources {
  header: string | null;
  query: string | null;
  cookie: string | null;
}

export type MockActorResolution =
  | {
      ok: true;
      user: MockUser;
      /** 经查询参数显式切换:hooks 据此写持久化 cookie。 */
      persist: boolean;
      /** cookie 携带清单外残值(如清单变更后):hooks 据此清除。 */
      clearCookie: boolean;
    }
  | { ok: false; requested: string };

/**
 * 请求级 mock 用户判定(hooks 的唯一逻辑来源,纯函数可测):
 * 显式指定(header/query)清单外即拒绝;cookie 残值宽松回落默认并要求清除
 * ——cookie 是系统自己写的,清单变更后不该让用户被旧值卡死。
 */
export function resolveMockActor(sources: MockActorSources): MockActorResolution {
  const explicit = sources.header ?? sources.query;
  if (explicit) {
    const user = resolveMockUser(explicit);
    if (!user) return { ok: false, requested: explicit };
    return { ok: true, user, persist: sources.query === explicit, clearCookie: false };
  }
  if (sources.cookie) {
    const user = MOCK_USERS.find((candidate) => candidate.actorId === sources.cookie);
    if (user) return { ok: true, user, persist: false, clearCookie: false };
    return { ok: true, user: DEVELOPER_ONE, persist: false, clearCookie: true };
  }
  return { ok: true, user: DEVELOPER_ONE, persist: false, clearCookie: false };
}

/** 各路由/客户端在发布生命周期里承担的角色,由这里统一决定,不再由路由各自编。 */
export type PlatformClientId =
  | 'workbench'
  | 'management-console'
  | 'page-editor'
  | 'publish-confirmation'
  | 'template-publish-confirmation';

const CLIENT_ROLES: Record<PlatformClientId, readonly LifecycleRole[]> = {
  // Agent(MCP)工具调用面。此前 services.server.ts 里固化的 context() thunk
  // 传 roles: [],导致 Agent 永远无法确认/拒绝/取消发布——这里补齐 publisher。
  workbench: ['publisher'],
  // 管理控制台承担发布、回滚、强制释放租约、模板管理等偏管理侧操作。
  'management-console': ['admin'],
  // 页面编辑器只保存修订,不触碰发布生命周期,不需要任何角色。
  'page-editor': [],
  'publish-confirmation': ['publisher'],
  'template-publish-confirmation': ['admin']
};

/**
 * 请求级身份工厂。`hooks.server.ts` 用它填充 `event.locals.identity`;
 * 需要为下游调用切换 clientId 的路由用 {@link withClient} 派生。
 * 角色是客户端角色与用户级角色的并集:默认用户没有用户级角色,
 * 与引入 mock 多用户前的行为完全一致。
 */
export function createIdentity(
  clientId: PlatformClientId,
  user: MockUser = DEVELOPER_ONE
): LifecycleContext {
  return {
    actorId: user.actorId,
    clientId,
    roles: mergedRoles(clientId, user.roles)
  };
}

/**
 * 同一身份、不同 clientId 的派生。clientId 差异(workbench / management-console /
 * page-editor / publish-confirmation / template-publish-confirmation)反映的是
 * "哪个客户端发起了这次调用"——用于发布生命周期的幂等命名空间与审计字段,
 * 与"这个请求背后是谁"(actorId)是两回事,因此保留为参数而不是塞进角色里。
 * 用户级角色(如 admin-1 的 admin)按 actorId 重查 mock 清单保留,不随 clientId
 * 切换丢失;actorId 不在清单里(如离线种子)时只保留客户端角色。
 */
export function withClient(
  identity: LifecycleContext,
  clientId: PlatformClientId
): LifecycleContext {
  const user = MOCK_USERS.find((candidate) => candidate.actorId === identity.actorId);
  return {
    ...identity,
    clientId,
    roles: mergedRoles(clientId, user?.roles ?? [])
  };
}

function mergedRoles(
  clientId: PlatformClientId,
  userRoles: readonly LifecycleRole[]
): readonly LifecycleRole[] {
  return [...new Set([...CLIENT_ROLES[clientId], ...userRoles])];
}

/**
 * `@metriccanvas/template-library` 的 `TemplateContext` 角色集合比
 * `LifecycleContext` 窄(只有 'admin'),两者结构不兼容,不能直接复用同一个
 * 对象。模板相关路由统一走这里做窄化转换。
 */
export function toTemplateContext(identity: LifecycleContext): TemplateContext {
  return {
    actorId: identity.actorId,
    clientId: identity.clientId,
    roles: identity.roles?.includes('admin') ? ['admin'] : []
  };
}

/**
 * 离线种子(启动期执行,不经过 hooks)专用的 actorId。与请求期身份分开,
 * 但同样只在这一个模块里声明,避免散落的字面量。
 */
export const OFFLINE_SEED_ACTOR_ID = 'offline-seed';
