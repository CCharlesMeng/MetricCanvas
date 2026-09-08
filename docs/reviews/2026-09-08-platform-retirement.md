# #125 旧对话、模板与 Java 清理实证

日期：2026-09-08。开工基线 `07536fd7cccfdc9571496732db4e9d57b0eb6e60`，已 fetch 核对；#125 原指派 CCharlesMeng，本次继续认领。并发 ADR/计划文档未纳入本次改动。

## 消费者与处理

| 存活能力或退出对象 | 当前消费者 | 提取或退出方式 | 验证 |
|---|---|---|---|
| 页面文档编辑、十类局部组件构造、人工布局 | `PageAuthoringWorkbench`、`Inspector`、`document-edit`、`component-building` | 工作台通过 `?page=<pageId>` 与 `pageAssets.getLatest` 读取已保存页面；修订详情页提供入口。保留原有独立修订编辑页及撤销/重做 | 十类构造、文档编辑用例；浏览器由柱状图切明细表，改标题、宽度并保存 |
| 保存与精确修订预览 | `pageAssets`、`RevisionPreview`、工作台与修订编辑页 | 继续复用现有客户端，保存返回修订 id 后精确读取。工作台的预览在画布区域呈现 | 实际 Node 产物通过现有内存页面资产服务保存 R2，预览请求带精确 revisionId；浏览器 0 page error |
| 沉淀纯规则 | `workbench/promote.ts`、`promote-flow.ts` | 保留规则与显式保存命令，移除旧会话消息解析；27 项旧 MCP 沉淀规则测试改为验证工作台实现 | 固定输入文档有来源提交记录；临时指标确认、报告冻结、筛选解绑、命名与合法性用例通过。公共 Chat 未接入，临时页面产物入口未恢复 |
| 旧对话与会话 | 工作台 `agent-request`、`stream-consumer`、`session-replay`、`run-state` → `api/agent`、`api/sessions` → 旧 agent/ask/session | 删除消费者、对应 UI 卡片、路由、编排、模型 provider、会话存储与专属测试；服务组合根不再构造旧模型/会话。`/ask` 不再服务端装配预置示例 | URL 携带旧 session 参数也不发旧请求；旧端点实际返回 404；公共 Chat 明确显示不可用，发送禁用 |
| 发布治理、模板与 ACL 界面 | 发布确认、模板管理、发布/回滚 API、模板存储与播种 | 删除 UI、路由、模板库及 Postgres 模板实现、顶层 templates、专属测试。保留仍服务页面资产读取的修订历史/差异 | 页面目录、编辑、精确预览回归；服务组合根不再提供 templates；构建无模板模块 |
| MCP 包 | 旧编排、模板消费者与两个工作台测试输入生成器 | 生产消费者退出；工作台测试改读固定夹具，保留来源；包依赖归零后删除 MCP 包与专属旧编排测试 | workspace 依赖图、全仓 check/test、创作契约导出隔离与实际构建源映射 |
| 旧 Java 源码与纵切 | `slice:page-assets` 与旧 Java 工程 | 删除源码及 TS 纵切脚本/命令。默认 dev 本来已只启动平台与 DQE 仿真；清除多余旧服务端 DQE 配置及旧模型环境变量示例 | 完整历史 tag 已存在，本轮不重建基线；默认产品构建通过，CI 继续不交付 Java |
| 旧页面资产依赖链 | 7 条页面资产/渲染 API、`hooks.server.ts` → `services.server` → Java Adapter 或内存/Postgres 生命周期 | **保留** `page-assets-java`、`page-lifecycle`、`persistence-postgres`、compose 与页面种子；没有用假接口或仓库样例替换产品外部接口 | 本地适配器回归仅证明保留链可用，不代表 #105 新接口消费验证通过 |

## 验证结果

- `pnpm test`：129 个文件通过、1 个跳过；936 个用例通过、12 个跳过。减少部分为已退出能力的测试；存活的身份与沉淀测试保留/迁移。
- `pnpm check`：全仓通过；Svelte 0 错误、0 警告。
- `pnpm build`：embed ESM/IIFE 与平台实际产物通过；平台仍是 `adapter-node`。
- `pnpm --filter platform exec vite build --sourcemap`：检查 SvelteKit 中间产物及 Node adapter 产物的 121 份源映射、1976 个来源路径，未出现旧 agent/ask/session、工作台旧对话模块、MCP 或模板库。随后默认 `pnpm build` 再次通过，最终 JS 产物旧编排入口标记为零。
- workspace 图：平台可达 8 个 workspace 包、16 条边；MCP、模板库不可达。源映射仍明确含生命周期内存实现、Postgres 页面实现和 Java 页面适配器，未将它们误报为已隔离。
- 浏览器（Chromium，1440×1000）：实际构建产物 + 原有内存页面资产适配器，创建测试页面、打开工作台、柱状图切明细表、改标题、宽度 12→11、保存 R2、精确预览及元数据抽屉均通过；旧接口 404、无旧 agent/session 请求、无页面异常。预览区域坐标及截图检查通过。
- `pnpm authoring:contracts:check`：183 份产品契约、4 份创作契约与 1 份接口副本一致。`pnpm authoring:check`：Bundle 460 项摘要核验与 Python 153 项测试通过。Python 使用既有 `/tmp/wayfinder-102/python-env`（系统 Python 缺少 jsonschema 等依赖）。

机器证据：[依赖图、构建来源及浏览器 API 轨迹](./2026-09-08-platform-retirement-evidence.json)。工作台固定输入见 `apps/platform/tests/workbench/fixtures/README.md`；历史旧系统由 `legacy/pre-static-platform-2026-09-08` 保留。

## #104 静态化剩余边界

已不存在 `+page.server.ts`；剩余服务端入口是页面资产相关 7 条 `+server.ts` 与身份 hook。它们仍有真实消费者，不能仅为产出静态目录删除。最新 #105 仍未确认目录、page_id 寻址与精确修订读取的提供方接口；当前客户端的旧 `/pages` 协议不能视为新接口已消费。

#125 保持 OPEN：页面资产旧适配器与其生命周期/Postgres/compose 尚未退出。#104 保持 OPEN：尚未切静态 adapter、未完成真实部署与五项终点验收。公共 Chat 不可用是解耦期状态，不是问数验收通过。引擎发布 #113–#116 与真实 registry/集成 #103 未由本轮接管。
