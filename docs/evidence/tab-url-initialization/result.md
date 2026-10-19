# URL 初始化 Tab 与来源链接验收

日期：2026-10-19。实施基线：`origin/main` 的 `227f7c61b913e686617042ae7c8b4af243654a86`。隔离工作树：`/Users/moon/.codex/worktrees/tab-url-initialization/DataDashboard`。本地修改，尚未提交、推送或部署；原混合工作区未修改。

## 已确认行为

页面协议 6.33 新增 `tabContainer.props.initialTabUrlParam`。每个容器显式接收一个 URL 参数，以 Tab id 精确匹配；单个合法 URL 值优先于 `defaultTab`，再回退首项。缺失、空值、未知值或重复键均回退；同名多值即使相同也不接受。参数名与本页页面参数、筛选器实际 URL 名称和其他 Tab 容器互斥。

渲染引擎消费集成应用传入的 `initialSearch`；纯呈现组件保持原有点击状态。手动切换不改写地址，不重新执行初始化。重新打开或刷新页面实例按 URL 再初始化。查询与报告静态导出仍沿既有行为执行和展开全 Tab，不增加按活动页签取数的语义。

来源超链接沿用既有 `href` 与 `query`：固定参数直接写入 URL，动态绑定来自来源页参数、筛选状态或当前行字段。有效动态值覆盖同名静态值，保留其他参数及锚点；缺值保留静态值。目标容器参数名和 Tab id 是来源页面必须同步维护的公开配置。普通导航不加载目标页面做跨页静态校验，目标变更后的旧链接回退默认页签。

## 交付物

| 能力 | 真源与场景 |
|---|---|
| Tab 初值声明、回退、命名与版本 | [Schema](../../../packages/page/src/schema/components/tab-container.ts)、[参数命名校验](../../../packages/page/src/navigate.ts)、[版本门槛](../../../packages/page/src/version.ts)、[运行时解析](../../../packages/engine/runtime-ui/src/initial-tabs.ts) |
| 来源链接与两容器接收 | [来源页](../../../pages/tab-url-source.json)、[目标页](../../../pages/tab-url-initialization.json)，注册于试验场目录；[操作和预期](../../../pages/README.md#url-初始化-tab-与跨页链接) |
| 持续可查的使用说明 | [Tab 容器](../../page-metadata/components/tabContainer.md)、[链接传参](../../page-metadata/actions-and-navigation.md#链接传参与目标页签)、[页面参数入口](../../../PAGE-PARAMETERS.md#url-初始化-tab)、[协议入口](../../../PAGE-METADATA.md) |
| 创作与独立安装 | 产品真源生成 Schema、正反契约向量、示例、参考手册、独立校验器及哈希清单；创建 Tab 容器和属性修改接受新字段，普通标题编辑保留它；Python 对使用该字段的文档复用 Bundle 内产品校验桥 |

## 验收

- 页面：`pnpm validate pages`，34/34 通过。
- 定向单元：页面协议、版本、URL 解析与导航共 22 项通过。完整协议与分发回归共 689 项：首次 688 项成功，导出隔离的一项 30 秒边界超时；同一用例单独复验通过，未扩大超时或修改断言。最终协议、页面目录、参考手册及仓外 Skill 闭合另跑 6 个文件，49 项全部通过。
- 类型：`pnpm --filter @metriccanvas/page check`、`pnpm --filter @metriccanvas/engine check`、`pnpm exec tsc --noEmit -p tests/tsconfig.json` 通过；引擎 Svelte 诊断 0 error / 0 warning。
- 浏览器：独立页面试验场端口 5193，`node apps/playground/tests/tab-url-browser.mjs docs/evidence/tab-url-initialization/artifacts`，Chromium 151.0.7922.34 的 10 个场景通过，无 pageerror。直接消费两份完整页面，未在测试内重写交互配置；包括静态/页面参数/行字段跳转、多容器、默认及异常、手动切换不改 URL、刷新恢复和未声明参数。见[机器结果](artifacts/result.json)、[宽屏](artifacts/tabs-wide.png)、[窄屏](artifacts/tabs-narrow.png)。
- 分发：`pnpm authoring:contracts:check`、Bundle 摘要检查通过；最终新增创作入口后再次生成并通过 `pnpm authoring:contracts:check`；Bundle 2818 项摘要检查通过。复制完整本地 Skill 至仓库外，独立校验来源页与目标页均通过；最终 49 项测试包含完整目录复制、知识/哈希/链接闭合。
- 系统 Python 首轮缺少 jsonschema/httpx 等依赖，未作为产品失败；按 `metriccanvas-authoring/tool/requirements.lock` 使用 `uv pip sync --require-hashes` 安装临时独立环境，再运行完整创作回归。新增容器创建/修改、普通编辑保留与非法配置拒绝的 9 项定向回归通过。

本次为本地代码、页面、浏览器与分发验收。未运行真实 DQE、Relay、DS 模型、真实集成门户或部署验收；未执行远端 CI。新能力无外部取数依赖，不以演示数据证明真实服务行为。

## 最终冻结版本复验

产品源与派生物停止修改后，`PATH=/tmp/metriccanvas-tab-url-python/bin:$PATH pnpm authoring:test` 使用锁定依赖的 Python 3.12.13 完成 542 项：541 成功、1 跳过，耗时 128.458 秒，无真实模型调用。首次完整 Python 进程早于桥接接入启动，其缓存中的旧实现对四个新反例漏检；最终完整重跑确认版本、命名冲突及归一化拒绝全部闭合。

最终 TypeScript 定向复验命令：

```sh
pnpm exec vitest run packages/page/tests/tab-url-initialization.test.ts packages/page/tests/version.test.ts packages/engine/runtime-ui/tests/initial-tabs.test.ts tests/page-reference.test.ts tests/local-authoring-skill.test.ts apps/playground/tests/page-catalog.test.ts
```

6 个文件、49 项全部成功。对应[摘要](artifacts/unit-summary.txt)；Python [摘要](artifacts/python-summary.txt)。`pnpm validate pages` 再验 34/34，测试代码类型检查及 `git diff --check` 再验通过。10 个浏览器场景对应的功能源与双页配置在最终冻结过程中未再改变。

本批次本地实现与验收完成；提交、推送、远端 CI 和真实集成验收未执行。

## main 交付检查（2026-10-19）

用户授权提交并推送 main，并要求快速交付。交付前 fetch 确认 `origin/main` 仍为实施基线 `227f7c61b913e686617042ae7c8b4af243654a86`，复用上文同一产品输入的完整本地验收。新增的通用 Playground 验收要求同步于 AGENTS.md 与 docs/agents/feature-acceptance.md。

补跑 `pnpm test` 指定页面协议、版本、Tab URL 初始化、导航与 Playground 目录五个测试文件，28 项通过；`pnpm authoring:contracts:check`、Bundle 2818 项摘要检查与差异检查通过。显式路径清单只覆盖本次功能、协议派生物、页面场景、验收记录和验收约定。远端提交与 CI 结论以实际交付结果为准。

首次推送提交 `66fba44026e086c719484bf8f3590f276bd0dc7b` 的 CI 报告 `_uses_product_bridge` 圈复杂度 19，超过 15。随后仅抽取 Tab URL 与报告导出页头的检测函数，保持路由条件不变，并更新 Bundle 源文件摘要。`python tools/scripts/check-authoring-complexity.py` 确认 0 违规、全局最大值 15；Tab 容器与完整页面校验 23 项回归通过，契约生成、Bundle 2818 项摘要检查和差异检查通过。后续 CI 以修复提交为准。

修复提交 `8e8d297aea71e04f82a145e13a61d13d409bb169` 的完整 TypeScript CI 为 2268 成功、5 跳过、1 失败：示例页面 id `tab-url-initialization` 与内部能力标识同名，触发页面 id 中立性约束。随后把内部能力标识改为 `tab-url-initial-state`，不更改公开字段、版本号、页面 id 或 URL；同步独立校验器及摘要。页面 id 中立性、版本、页面协议和初始化行为四个文件的 18 项回归通过，Bundle 2818 项摘要检查与差异检查通过。
