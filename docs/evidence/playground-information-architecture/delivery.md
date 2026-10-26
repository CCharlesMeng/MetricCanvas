# Playground 目录改进交付复验

日期：2026-10-26。基线：`origin/main` 的 `45531dfab7afab5333094ae7636e8e67fb802c7a`，协议 6.58。用户授权直接 push main；不涉及引擎改动时使用 `[skip ci]`。准确提交和远端结论以本轮交付回执为准，跳过 CI 不表示 CI 通过。

## 范围

从共享工作区按 39 个显式路径迁入隔离 worktree，保留最新 main 的协议、Platform、表格与其他文档变化。交付 Playground 三维目录、19 类组件入口、35 项数据功能及实际 Dashboard／Report 过滤、紧凑页头、当前文档试改、目录状态与跨页承接；新增一个共享内联数据演示页面。旧文件目录移至 `/files`，`/pages/<id>` 保持可用。

未纳入任何 `packages/` 引擎、UI 或数据执行源代码。决策意见演示及适配器已由其他批次交付，直接使用 main 版本。未将原工作区临时评测文件加入 main；最新隔离版本自动发现 95 份页面文档。2026-10-24 原始记录的 112 份包含当时共享工作区的临时文件，不能作为本次提交文件数量。

共享文档仅迁入本任务段落。新增示例影响内容包来源指纹，执行正式生成器后只更新 `bundle.lock.json`、`mc-content.version.json` 与 `runtime/source-identity.json` 三份派生清单，没有新协议语义。

## 当前基线验证

| 命令或观察 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | 成功，锁文件未变 |
| `pnpm test apps/playground/tests` | 18 文件、86 测试通过 |
| `pnpm --filter playground check` | 0 errors、0 warnings |
| `pnpm build:playground` | 静态构建成功 |
| `pnpm authoring:contracts` 后 `pnpm authoring:contracts:check` | 生成指纹后 current：1150 product、4 authoring、1 interface |
| `pnpm test tests/local-authoring-skill.test.ts` | 24 测试通过，包括仓外安装与校验 |
| 浏览器使用隔离目录的 5192 服务 | Dashboard 条件阶段 10 项功能；Report 时间只出现实际 Report 演示；试改编辑器可用；搜索补列直接命中功能，单一演示不加下拉 |
| 跨页流程 | Dashboard 来源与清单进入 Report 详情，布局跟随目标；回显 `P&中文/001`、`2026-09`、RMB、north/south |

初次并发运行测试和检查造成 Svelte 自动生成声明内容损坏，串行重跑检查后恢复；没有修改生成文件或放宽规则。系统 Python 缺少 fastmcp，改用项目现有 `metriccanvas-authoring/tool/.venv/bin/python` 并通过 `METRICCANVAS_PYTHON` 注入后完成生成与复验。

## 复杂度

用 `metriccanvas-ts-ast/1` 在当前基线实测全部 23 份本次 TS、JS、Svelte 文件；Svelte script 与编译器提取的模板函数分别测量。274 个函数／闭包，自身 CC 最高 9，无超过 15 的项。`catalogHref` 5 → 6；`sceneRelations` 1 → 1；新增 `resolveFeature` 7、`dataLayout` 5、`selectDataExample` 2；移动的文件目录 `captureState` 1、`rememberState` 1、`restoreScroll` 4 等保持不变。本批无未关闭超限项。

原始日志、逐函数数据和浏览器截图按仓库规定留在本机 `.scratch/playground-directory-delivery-2026-10-26/`，不强制提交被忽略附件。旧实施记录中的原始附件名称也仅供本机追溯。

## 验收边界

本批不证明真实 DQE、Relay、CloudIOC、云宝或生产部署。内嵌 PDF 下载完成回执及整份 PDF／PNG 文件视觉仍保留为专项；此前的导出测试与独立页面下载不能替代这些专项。只清理本任务隔离工作树，原共享主工作区与其他活动任务的工作树保留。
