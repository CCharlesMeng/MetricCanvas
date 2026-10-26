# 分页合并源实施与验收

日期：2026-10-26。实施 checkout：`/Users/moon/.codex/worktrees/paged-union/DataDashboard`，初始基线 `7834fbc5bc2534209e9358c2252bc9bd50e1eec8`；合并图表常量能力后的验证基线 `bf66b1caf6e35cd34b237c15aafe0fb797eb0017`，写出版本 6.61。原主工作区的未提交内容未移入；Git 交付与 CI 以交付回执为准，未部署。改动范围见本地 [scope.json](scope.json)。原始截图、JSON、Excel 按仓库约定留在本工作树，清理前另存核对，不随默认 Git 文件清单提交。

## 已实现

- 通用 `pagedUnion`，引用至少两个普通查询源，以各来源原始稳定键区分记录。字段、常量与 null 投影覆盖全部最终列，校验类型/角色/单位/币种/可空性；内容重复照常保留。
- `ordering.default` 在两个来源的完整匹配范围整体排序，初始表头同步；排序、搜索、筛选先下推，再计数归并取全局页。null 始终排尾，同值按来源和原始键排序。
- SourceProgram 统一执行；成员内部读不覆盖独立消费者；请求池最多缓存 256 项，4 个视图检查点、每源 200 行缓冲、浏览前缀最多 100000 行/60 秒。总数变化最多重试一次，取消与过期结果遵守现有会话边界。
- 跨来源候选合并并去重，保持数据行重复；候选超过 10000 项明确失败。来源常量可排除整个来源；null 不命中普通候选和文本搜索。
- 完整 Excel 导出保留提交视图，最多 10000 行/60 秒，不提供部分文件；来源导航使用原始业务键，不存在的来源目标显示普通文本。
- 来源失败整轮失败。沿用现有数据提示区显示“多来源数据加载失败，请刷新重试。”，普通表格的既有反馈保持原义。

## 功能、文档与 Skill 对应

| 功能 | 可观察页面 | 真源文档/Skill |
|---|---|---|
| 映射、默认整体排序、分页、筛选搜索、导出 | `/pages/multi-source-table` | `docs/page-metadata/data-sources.md#paged-union`、`PAGE-METADATA.md` |
| 来源详情与原始业务键 | `/pages/multi-source-contract-detail`、`/pages/multi-source-commercial-detail` | `docs/page-metadata/components/table.md#source-navigation` |
| 创作引导与独立校验 | 同页 JSON、`paged-union-page`、`paged-union-branches` | local-authoring `references/multi-source-table.md`、生成主题 `data.pagedUnion` / `table.source-navigation` |

Playground 使用两个普通分页模拟端点，由产品执行器完成归并，不使用旧 decision-opinion 专用合并适配器。目录复用同一页面。操作步骤见 `pages/capabilities/table/README.md`。

## 自动验证

- `pnpm check`：通过；补齐失败提示后 `pnpm --filter @metriccanvas/engine check`：0 错误、0 警告。
- `pnpm build:packages`：最终通过，含 Page、data-execution、engine 和 metric-canvas 的声明/分发构建。
- `pnpm test packages/page packages/data-execution packages/engine/runtime packages/engine/runtime-ui apps/playground/tests/decision-opinion-preview.test.ts apps/playground/tests/data-directory.test.ts apps/playground/tests/scenario-directory.test.ts --maxWorkers=4`：199 文件、1615 测试通过。
- `METRICCANVAS_PYTHON=<项目 venv>/bin/python pnpm test tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/local-authoring-upgrade.test.ts tests/page-reference.test.ts --maxWorkers=4`：4 文件、146 测试通过。最终新增来源名原型键反例补测 28 项通过，避免缺失来源 constructor 被误认为已声明数据源。
- `pnpm authoring:contracts` 与 `pnpm authoring:contracts:check`（同一 Python 环境）：生成并核对 1176 product、4 authoring、1 interface 文件。
- Bundle 完整摘要校验：`check_bundle.py` 通过 5802 项检查。
- 交付前重新生成契约并验证 Bundle：1176 product、4 authoring、1 interface 文件生成完成，5802 项摘要检查通过；`pnpm validate` 全部 98 个页面通过。
- 仓外复制完整 Skill：合法页面校验退出 0；`data.pagedUnion` 读取退出 0、12032 字节；删除商务来源 approver 映射后退出 1，准确指向 projection/approver。记录见 [standalone-skill.json](standalone-skill.json)。
- 导出隔离的初次完整检查受生成期间指纹变化与 90 秒超时影响；冻结产物后复验四项，三项通过；“本地模型评估产物不影响交付锁”曾在独立重跑中触及 90 秒超时。同一不变式的直接复验退出 0，见 [local-evaluation-lock.json](local-evaluation-lock.json)。交付前按原 90 秒预算再次独立运行该用例：1 项通过、29 项跳过，耗时 34.47 秒；未修改测试或放宽预算，关闭该次超时未关闭项。未重跑的完整 authoring:check 不据此报告全绿。
- 交付前补齐 MC 诊断示例与两个 Report 布局示例的 6.60 版本，诊断主题数同步为 160；使用现有生成器更新，无可执行分支变更。
- 复杂度：metriccanvas-ts-ast/1、TypeScript 5.9.3；228 个修改/新增函数实测，新增最高 CC 13；存量超限及前后值见 [complexity.md](complexity.md)。

## 实际浏览器验证

服务为本工作树 `pnpm --filter playground dev --host 127.0.0.1 --port 5193`；已核对端口对应本 checkout。使用 Codex 浏览器真实 UI，入口 `http://127.0.0.1:5193/pages/multi-source-table`。

1. 默认整体降序：首三条为商务 130、合同 120、商务 100，总数 256，表头显示降序。合同 001 仍显示后端 63%，不重算为 75%。见 [default-order.png](default-order.png)。
2. 切换占比升序、降序后跳第 13 页，两方向最后均为合同 004 的 null，序号 256；分页保留当前整体排序。见 [null-last.png](null-last.png)。
3. 类型候选同时出现合同/商务。选择合同并搜索“审批人甲”后总数 2，导出 Excel 恰好为表头加 2 行；读取工作簿核对 120/100、63/87.5 与合同类型，见 [export.json](export.json)、[filtered-export.xlsx](filtered-export.xlsx)。
4. 清除条件后完整导出为表头加 256 行，超出当前 20 行窗口；已读取工作簿核对 257 行。见 [full-export.json](full-export.json)、[full-export.xlsx](full-export.xlsx)。
5. 搜索当前页之外的审批人候选“审批人124”，选中后跨两源匹配总数 2，证明候选不只来自当前页。
6. 点击商务审批人丁进入商务详情，URL `record-id=002`，正文显示“原始来源内业务键：002”。
7. `?sourceFailure=commercial` 显示明确失败提示，未展示合同半份结果；见 [source-failure.png](source-failure.png)。

## 证据边界

按需模拟源验证两百万条匹配记录的首屏只请求每源 200 行，冷深页超扫描上限明确失败；这证明有界读取行为，不代表真实接口的吞吐或延迟。服务端排序、null、字符串比较、计数、文本搜索与候选能力仍须真实 DQE/Relay 请求响应验真。当前未运行真实 DQE、Relay、DS 模型、远端 CI 或生产集成。实时 offset 接受跨请求数据变化，不提供事务快照；单源未读取范围的行键唯一性仍由上游保证。

## 合入最新 main 后的回归

- 保留 main 的图表常量取值能力；本批顺延为 Schema 6.60、ADR-0120，所有派生契约从合并后的真源重新生成。
- `pnpm check`、`pnpm build:packages` 通过。
- 产品回归 201 文件、1647 测试通过，覆盖 Page、data-execution、engine runtime/runtime-ui、图表常量与 Playground 目录。
- local-authoring 四文件首轮 147 项通过；旧页升级示例版本仍为 6.59 导致 1 项失败，修正示例至 6.60 后升级文件全部 94 项通过，其余三个文件输入未变。
- `pnpm mc:content:check` 通过，含 1188 product、4 authoring、1 interface 文件一致性、MC 来源覆盖、30 项内容测试与诊断夹具。之后同步旧页升级示例，重新生成契约与诊断快照，最终摘要检查另见交付回执。
- 在本工作树 5193 服务重新打开实际页面，首三条仍为商务 130、合同 120、商务 100，总数 256，详情链接仍携带各来源原始业务键。
- 同口径重新测量 228 个修改/新增函数，新增最高 CC 13，存量超限前后值保持记录。

## 继续合入表格原文容错与置顶行

main 在交付期间继续前进到 `3f502e482b4b56e35011f994b1f735b0abab5909`，保留其原文展示证据、独立汇总查询的缓存作用域，以及图表常量实现。本批最终顺延为 Schema 6.61、ADR-0121。归并源沿用组合快照的 cellFallbacks 结构与校验，生成知识补齐同源语义；本批不改变明细与独立汇总的职责。最终复杂度基于该提交重测 230 个修改/新增函数，新增最高 CC 13，四项存量超限不增长。此前 6.60 回归属于中间基线，最终验证以本节后续回执和 Git CI 为准。

最终冻结后验证：`pnpm check`、`pnpm build:packages` 通过；补充网关测试类型检查通过；238 个产品测试文件、2024 项测试通过；4 个 local-authoring 文件、150 项测试通过；102 个页面文档全部校验通过；`pnpm mc:content:check` 完整通过（1212 product、4 authoring、1 interface，30 项内容测试和诊断夹具）；Bundle 5957 项摘要检查通过。浏览器确认合并后首三条 130/120/100、总数 256。同步修正网关两个历史断言以符合 main 已确认的标量容错协议，保留结构错误拒绝与不回显业务值的检查。
