# #104 纯前端静态平台实施记录

2026-09-10。本切片完成平台从 SvelteKit Node 产物到纯前端静态 SPA 的切换；真实内网载体部署、盘古接入与提供方历史修订读取仍未完成，#104 不应因本切片关闭。

## 实施结果

- `apps/platform` 改用 `@sveltejs/adapter-static` 和 `fallback: 'index.html'`，顶层 layout 明确 `ssr = false` / `prerender = false`。
- 删除 7 条 `+server.ts`、`hooks.server.ts` 与全部 `$lib/server/**`；平台不再依赖 `page-assets-java`、`page-lifecycle`、`persistence-postgres` 和 `adapter-node`。
- 页面资产客户端不再回退到本仓 Node API；直接消费已确认的 `user-page-metadata` 目录、详情、新增与更新契约，每次请求现读集成门户注入的基址、`X-Auth-Token` 和 `X-Operator-Id`。
- 提供方尚未说明的历史修订、内容哈希和创建人不作推断；界面显示“接口未提供”，精确修订只在命中当前修订时成功。
- CI 在 push 后上传 `apps/platform/build` 为 `metriccanvas-platform-static-<sha>`；真实内网 deploy job 等待部署载体。

## 验证

- 平台测试：16 个文件，123 项通过，1 项跳过；其中两项专门锁定静态 adapter、SPA fallback、服务端入口归零与服务端依赖退场。
- 全仓测试：130 个文件通过，1 个跳过；948 项通过，12 项跳过。
- `pnpm check`：全仓通过。
- `pnpm build`：四个引擎交付物与静态平台通过；平台输出 `apps/platform/build`，产物约 2.5 MB。
- `pnpm authoring:contracts:check`：183 份产品契约、4 份创作契约与 1 份接口文件无漂移。
- `pnpm packages:check`：四个 `1.0.0-rc.1` 交付包入口、声明和文件范围通过。
- 静态预览：`/`、`/manage`、`/manage/pages/example-page` 均返回 HTTP 200 `text/html`，动态页面路径经 SPA fallback 可打开。
- 产物搜索未发现旧 `/api/pages`、`/api/runtime`、`adapter-node`、Postgres URL 或旧页面资产服务端配置。

## 仍待内网完成

- 使用真实 `CDINL2DataBuilderService` 验证目录、详情、POST 和 PUT，并根据实际 CommonRsp 与 CORS 行为修正适配。
- 取得历史修订/精确修订读取契约，恢复真实修订历史和差异能力。
- 确定内网静态载体、路由 fallback 与运行配置注入时序，建立 deploy job 并执行部署后验收。
- 完成盘古对话、页面构建产物和分析会话恢复接入。
