import type { LifecycleContext, LifecycleRole } from '@metriccanvas/page-lifecycle';
import type { TemplateContext } from '@metriccanvas/template-library';

/**
 * 唯一的身份构造点。平台目前没有真实的用户认证/会话体系,所有请求都被当作
 * 同一个开发者身份处理——这是本仓库尚未解决的架构缺口,还没有对应 ADR。
 * 引入真实身份提供方时,只需要改这一处:让 DEVELOPER_ACTOR_ID 的取值来自
 * 请求携带的会话/凭证,其余调用方(hooks、路由)不需要变化。
 *
 * TODO: 补一篇 ADR 记录认证方案选型后,在此处引用。
 */
const DEVELOPER_ACTOR_ID = 'developer-1';

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
 */
export function createIdentity(clientId: PlatformClientId): LifecycleContext {
  return {
    actorId: DEVELOPER_ACTOR_ID,
    clientId,
    roles: CLIENT_ROLES[clientId]
  };
}

/**
 * 同一身份、不同 clientId 的派生。clientId 差异(workbench / management-console /
 * page-editor / publish-confirmation / template-publish-confirmation)反映的是
 * "哪个客户端发起了这次调用"——用于发布生命周期的幂等命名空间与审计字段,
 * 与"这个请求背后是谁"(actorId)是两回事,因此保留为参数而不是塞进角色里。
 */
export function withClient(identity: LifecycleContext, clientId: PlatformClientId): LifecycleContext {
  return {
    ...identity,
    clientId,
    roles: CLIENT_ROLES[clientId]
  };
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
