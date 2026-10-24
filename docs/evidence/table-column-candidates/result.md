# 表格列候选值：本仓实现与验收

日期：2026-10-21。状态：本仓引擎实现和本地验证完成；真实 DQE 查询编码、权限、Relay 与部署验收 NOT_RUN。用户已授权提交并推送 main；远端提交和 CI 最终结果以本次会话交付记录为准，没有发布部署。

## 检出与范围

- 实施分支：codex/table-column-candidates。
- 检出：/Users/moon/.codex/worktrees/table-column-candidates/DataDashboard。
- 已确认基线：952b3a27（从本会话原工作区 HEAD 创建，保留原工作区并行产品修改）。
- 首轮演示使用旧基线，未包含昨天的表格皮肤；用户指出后，从已交付 eae372c4 / b0e736a2 / 589767c0 接入 TinyVue OS Grid 的 Table、图标、几何定位与回归夹具。没有从原工作区复制混杂的产品修改。RuntimeSurface 的样式段与交付版相同，无需带入其不相关的运行时改动。
- 原型：codex/table-column-candidates-prototype，提交 32e2fca8。一次性 HTML 验证排除自身、跨页和失配值保留，原型源码未进入产品分支。
- [唯一主计划](../../plan/2026-10-21-table-column-candidates.md)、[产品裁决](../../adr/0114-table-column-candidates-use-matching-results.md)、[DQE 对接说明](../../plan/table-column-candidates/dqe-handoff.md)。

## 实现

| 能力 | 位置与行为 |
|---|---|
| 统一源候选读取 | SourceProgram.readColumnCandidates；inline/完整 query/有界 pagedJoin/可选远程去重使用同一读取 Interface |
| 条件来源和收窄 | 完整 filterValues 保留既有网关读取方式；bindingValues/tableFilters 保留来源。内置 DQE 先处理业务绑定，再合取表头条件；已知空交集不发 HTTP |
| 状态与请求资源 | 候选会话按表格/列隔离，业务视图仍归 TableSession；QueryRunner 共用并发、缓存和独立取消；旧成功/错误不能覆盖新代次 |
| 候选交互 | 按需加载、独立搜索、每页50项、继续加载、错误重试；保留失配已选值，仅在完整结果证实缺失时显示无匹配 |
| 类型及 null | 字符串/数字稳定值不互转，label 独立；null 不作为首批选项，也不与空字符串等同 |
| NO_PERMISSION | 保留既有非成功码带非空 data 消费规则，再单独验证字段、去重总数和候选分页完整性 |
| 既有范围 | 保留固定 TopN 和上游查询窗口；组合读取使用现有有界完整关联，超限不扩大、不从成员字典替代 |
| 页面维度筛选器 | 继续使用原维度取值域端口；补同会话 reload 代次检查，保持既有级联语义 |

远程网关新增可选 fetchColumnCandidates；内置 DQE 通过可信部署配置 encodeColumnCandidates 接线，必须由真实服务契约确认模型定位、原粒度及准确去重计数。不配置时明确不可用，不自动删指标发“看似可用”的请求。不要求页面作者配置 scope 或复制候选查询体。

## 实际执行与结果

| 层级 | 命令 / 操作 | 结果 |
|---|---|---|
| 全量行为回归 | pnpm test | 257文件通过，2231测试通过，5跳过；此后新增 TopN/组合超限/不透明条件保护三个边界用例另跑通过（候选测试文件12项通过） |
| 新增边界及相关回归 | pnpm test packages/data-execution/tests/column-candidates.test.ts 等定向路径 | 候选、条件合取、空上游、NO_PERMISSION、并发、取消、迟到响应、原始类型、TopN及组合上限通过 |
| 类型与 Svelte | pnpm check；新增测试后再跑 data-execution check | 工作区检查通过，Svelte 0错误/0警告 |
| 页面协议 | pnpm validate pages | 30个页面全部通过，包含 table-column-candidates |
| 生产构建 | pnpm build:playground；pnpm --filter @metriccanvas/embed build | Playground SSR/客户端及内嵌产物构建通过 |
| 浏览器自动回归 | MC_EMBED_EXAMPLE_PORT=4187 pnpm --filter @metriccanvas/embed exec playwright test table-column-candidates.spec.ts table-toolbar.spec.ts query-result-where.spec.ts table-tiny-os.spec.ts | 20项通过，覆盖 Dashboard/OS 样式、候选交互、既有搜索/导出/详情/绑定、各变体和官方网格 CSS 像素对比 |
| Playground 浏览器 | 访问 http://127.0.0.1:5187/pages/table-column-candidates 并实际操作 | 64项候选跨当前页、50→64续页、候选搜索、排除自身、失配勾选保留及双表隔离通过 |
| 分发一致性 | pnpm authoring:contracts:check；python3 metriccanvas-authoring/scripts/check_bundle.py | 751 product/4 authoring/1 interface当前；2718项摘要检查通过 |
| 本次 Skill / 参考回归 | pnpm exec vitest run tests/local-authoring-skill.test.ts tests/page-reference.test.ts | 2文件、26项通过，含独立复制安装及文档一致性 |
| 仓外 Skill | 复制完整 metriccanvas-local-authoring 到独立临时目录，再运行其 scripts/validate-page.mjs 验证正式场景 | ok:true、errors:[]；不依赖仓库源码路径 |
| ADR / 文档 | adr-index.py 生成与 --check、相对链接与 JSON 语法、git diff --check | 通过 |
| CI / 真服务 | 未 push、未配置真实 DQE 编码及身份链路 | CI、真实 DQE/Relay/部署 NOT_RUN |

首轮失败包含旧断言和派生产物漂移，均已修正并复验：保留完整 filterValues 防止既有自定义网关漏掉表头条件；数字 1 与字符串“1”、null 与空字符串按新裁决区分；参考链接按独立 Skill 净化要求去除仓库外跳转后重新生成。

## Dashboard 与最新表格修正

- `pages/` 后续新增示例默认显式声明 Dashboard；用户明确要求或验收 Report 专属能力时例外。原则写入原工作区与本检出的 AGENTS.md，并由 pages/README.md 指向该约定；不更改产品省略 layout 时的兼容默认值，也不改用户页面创作的形态确认规则。
- 本页使用 `layout: "dashboard"`、`meta.title`、现有统一工具栏和 `container: "card"` 白色小节卡片，移除 ReportHeader 和报表渐变面板。
- 网格样式采用已交付 TinyVue OS Grid：40px 表头、灰色背景、600 字重、48px 基础行高、短分隔线及 SVG 排序/筛选图标。新增候选项复用这套勾选样式。
- 首轮隔离验证时，OS 样式、图标和几何定位与 589767c0 对齐；交付合并时继续保留最新主线对行内子表增加的选择器与定位隔离，不退回旧版。新候选逻辑与这些已交付能力共同回归。
- 浏览器新增断言直接检查 Dashboard 工具栏、表头和行高、候选复选框；继承的 TinyVue 9 项浏览器检查包含三种网格与冻结官方 CSS 的零差异像素比较，均通过。此证据针对已覆盖网格，不宣称新增候选菜单的全部交互与 OpenTiny 完全相同。

[历史截图：Dashboard 与最新表格](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/table-column-candidates/dashboard.png)

## 可观察场景与证据

正式页面：[table-column-candidates.json](../../../pages/table-column-candidates.json)，已注册 Playground。无 URL 参数，64行内联合成数据；按[页面说明](../../../pages/README.md)步骤操作。

- 搜索“办事处64”只收窄候选；勾选后表格为1行，清空候选搜索仍可加载全体候选。
- 再将金额下限设为650000，表格为0行，已选办事处64保留并标记无匹配。
- 另一张表仍为64行；数字级别0选择后首表为22行，其他级别仍可选。

[历史截图：候选搜索及独立表格](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/table-column-candidates/candidates.png)

[历史截图：失配已选值保留](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/table-column-candidates/mismatch.png)

协议说明真源为 PAGE-METADATA.md 与 docs/page-metadata/components/table.md；已从真源生成 contracts、local-authoring知识、参考及锁文件。真实 DQE 的 DISTINCT、聚合后筛选、计数及权限不能从以上合成或本地结果推断通过。

## main 交付基线复验（2026-10-21）

合入交付前 origin/main df12228bd66c2fe0ab852ffa994c6533d3d829f7。保留主线的行内子表、字段选择搜索、IOC 动态候选和时间校验；列候选与普通读取共用声明校验，按可信展示上下文隔离缓存。新增回归覆盖非法页面选项不得发候选请求及权限事实修订后重取。ADR-0111 已被主线占用，本次决策改为 ADR-0114，更新引用并重新生成索引。

- pnpm check：整个工作区通过，Svelte 0错误／0警告。
- pnpm build 和 pnpm build:playground：产品包、内嵌、Platform 与 Playground 生产构建通过。
- pnpm validate pages：58个页面全部通过。
- 浏览器原20项加行内子表5项：25项全部通过；保留 TinyVue OS 网格像素比较。
- pnpm test：299文件通过，2602项通过、5跳过；另1个既有 authoring-language 时序用例在并行全量中失败，该文件独立复验55项全部通过。CI 结果另行确认；不将这次全量记为全部通过。
- 新增与合并边界定向回归：候选读取、同源表隔离和完整目录注册，3文件24项通过。
- pnpm authoring:contracts:check：961 product／4 authoring／1 interface 当前；check_bundle.py：3356项摘要检查通过，保留最新6.44知识和独立校验器。全量测试中的 local-authoring 独立安装验证通过。
- pnpm packages:check 与取数包独立 Node ESM／CLI／外部类型消费：通过。

真实 DQE／Relay／线上权限与部署仍未运行；远程去重编码继续需要对接确认。
