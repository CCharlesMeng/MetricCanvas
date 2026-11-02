# main 范围交付复核（2026-11-02）

交付检出：`/Users/moon/.codex/worktrees/partner-health-delivery/DataDashboard`。
基线：`21d9364ca201bbcc6382cf552f6677abdb0f0b17`（本地原工作区仍为 `2133241a6b4f259fc19ff54bfdd9a0dcb9c96e06`）。原工作区的并行改动保留，只转移本次会话的源文件和必要文档段落，派生产物在最新基线上重生成。

## 最终范围

- 引擎 `unionKeys`、`joinAggregate` 的空组织键跳过与脱值数量告警；不新增页面 Schema 字段。
- 伙伴健康度正式及显式 Mock 页下部对象查询按组织取数；正式页迁移为根级 `iocHeader`；保留独立“不查询声音闭环率”排查 JSON。
- 项目 Schema 最小化、IOC JSON 页头迁移约定；能力示例、测试、语义文档与同源分发知识。
- 本地 Mock 夹具支持既有 `fetchFilterCandidates`；正式页面仍返回宿主网关，没有在生产查询路径注入合成数据。

保留上游 6.78 查询分页结果的 `validateComputedJoin` 校验，以及 6.79 置顶汇总与 IOC URL 行为。文档计算示例列表同时保留期间比较分页与本次空组织键场景。当前引擎作者协议沿 main 为 6.79，伙伴健康度声明保留 6.77，空键示例保持 6.74；本批协议字段净新增 0。

local-authoring Skill 在 main 已为 1.17.0 的基础上升至 1.17.1，并从合并后的真源重新生成；此前本地 1.14.12 验收仅作为历史过程证据。

## 重新验证

- 引擎/运行时、页面协议、伙伴健康度与导出：111 文件、821 项通过。
- local-authoring 独立安装与页面参考：2 文件、43 项通过。
- 页面文档：157 份全部通过。
- 根 tests 类型、page/data-execution 包类型、Playground 测试类型通过。
- `pnpm build:packages` 与 `pnpm --filter @metriccanvas/embed build` 通过。
- 合并后契约导出、MC 来源覆盖、51 项 MC 回归和诊断夹具校验均通过；生成后的演示夹具再刷新，与最终内容摘要一致。
- 当前检出使用全新嵌入运行时直接读取正式 JSON，在明确标注的合成宿主复测：全球地区部图表及表格 15 行；ORG-06 总分 6，URL 写 `region-dept=ORG-06`；REP-06 总分 3，原代表处层级链接保持兼容；表格切换代表处显示 REP-06。截图为相邻页头目录的 `delivery-browser.png`。不代表内网真实查询。

复杂度口径继续为 `metriccanvas-ts-ast/1`、TypeScript 5.9.3。上游合并后的计算路径测量见 `complexity-delivery.json`，`evaluateRows` 为 9→12、`collectDependencies` 为 9→11，保留的上游 `validateComputedJoin` 为 4→4；全部新增/修改函数不超过15，无未关闭项。

本文件记录提交前的内容与验证输入；提交、远端和 CI 的最终状态以 Git 提交与同 SHA 的 GitHub Actions 记录为准。没有内网部署或真实服务验收声明。
