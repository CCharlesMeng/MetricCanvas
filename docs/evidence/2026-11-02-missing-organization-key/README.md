# 空组织键兼容验收（2026-11-02）

用户在内网导入“不查询伙伴声音闭环率得分”排查页后确认恢复，随后授权引擎兼容，并要求后续演进保持或精简 Schema、把逻辑沉淀到引擎。本批按这一要求实现默认行为，无页面开关。

## 实现与协议

页面 Schema 字段净增减为0，`packages/page/src/schema/`、算子声明类型和版本策略均与本批前一致；当前协议仍为6.77。正式 `pages/temporary/partner-health.json` 恢复为排查前原版字节（SHA256 `a86a376b05f053d8fe25877d3040207040441edf9df6999db44f7905d2584eb8`），保留声音闭环率查询，不包含任何新策略字段。排查版独立保留。网关请求与批处理未改。

引擎在组织并集和关联的共同边界检查键。null、缺失属性和空白文本键的记录不进入计算；类型异常与归一化降级证据仍失败，数值0与false键有效，零分与负分保留。组合键会检查所有项，另一项为空不能掩盖非法类型。并集单来源重复、unique关联重复、来源失败、非零总数矛盾仍失败，sum关联保持原聚合行为。

`COMPUTE_MISSING_KEY_ROWS` 数据快照告警只保留来源、字段和数量，不含行或组织值；同源同键的并集/关联不重复累计，向下游计算传播。全部空键得到带告警空态。只有确实删除主行时才重算关联结果数量，其他情况下保留原始总数；上游行及总数不变。

项目长期约定记录于 `AGENTS.md` 的“Schema 演进”，具体检查要求由 `docs/agents/page-metadata-changes.md` 的“Schema 最小化”维护。今后先证明现有声明是否足够，记录字段净增减、引擎承接职责及既有页面回归。

## 证据

- 真实回执本地回放：未经修改的10行通过字段映射与网关归一化；并集及关联得到9行，跳过数量1，源仍保留10行。本次不是一次新的内网HTTP联调；未把真实业务数据写入仓库。
- 自动回归：`vitest run packages/data-execution/tests packages/engine/runtime/tests` 加页面协议、伙伴健康度及表格导出定向回归，110文件、803项全部通过。覆盖原有正常查询/批次/取消、空键、组合键、真实零/负数、空态、类型异常、重复、缺依赖、错误传播、总数与导出告警。
- 页面校验：`pnpm validate`，157份通过。
- 包构建：`pnpm build:packages` 通过，data-execution、engine 与 metric-canvas 产物生成成功。
- 类型检查：page、data-execution包及 `tsc --noEmit -p tests/tsconfig.json` 通过。
- 原版页面浏览器：`/pages/partner-health?demo=synthetic` 保留海外总分30、代表处图表15组织及地区部表格15行；此路径仍为临时合成后端，不是内网服务证明。
- 浏览器：`http://localhost:5198/pages/missing-organization-key`，沿用6.74声明、全部inline合成数据。上表甲0、乙总分0、丙-2，告警a跳过2行、b跳过1行；下表空态、跳过2行。截图见 `browser.png`。该页不证明内网部署。
- 本地创作 Skill：语义文档与示例从产品真源生成，Skill版本1.14.12；不新增页面字段。仓外复制安装无符号链接，独立校验原版伙伴健康度与本批6.74示例均通过，校验器报告Schema6.77。独立检出的 `mc:content:check`（契约漂移、来源覆盖、33项MC检查、合成诊断示例）通过。完整创作工具回归单独记录；主工作区两项来源摘要差异（mc-content/runtime/source-identity.json、mc-content/mc-content.version.json）来自其他未跟踪页面及系统目录文件，未借本次改动覆盖。

## 复杂度

使用 `metriccanvas-ts-ast/1`、TypeScript5.9.3，按每个函数自身selfCC测量，闭包独立计数；完整报告见complexity-before/after.json。

| 函数 | 前 | 后 |
|---|---:|---:|
| unionKeys | 6 | 6 |
| joinAggregate | 8 | 11 |
| joinAggregate键验证回调 | 5 | 1 |
| applyComputation | 6 | 6 |
| computedSnapshots / visit | 2 / 5 | 2 / 5 |
| collectDependencies | 9 | 11 |
| evaluateRows | 9 | 12 |
| 新增missingKey / keyRows / recordSkipped | — | 9 / 3 / 2 |
| 新增mergedWarnings / 错误构造函数 | — | 1 / 1 |

删除原并集重复键验证辅助函数，把键校验与空记录处理集中在引擎；所有新增辅助函数、修改函数和测试回调均不超过15，本批无未关闭复杂度项。

## 交付边界

本批为本地未提交改动；没有push、CI、发布或内网部署证明。独立生成检出保持本批产品源及既有身份文件输入，主工作区其他任务的页面与Schema工作保留。主工作区全量派生检查受已有未跟踪业务页面、系统目录文件影响，具体差异由生成检查单独报告，不以本批独立检出通过替代全仓通过。

补充验收范围：组合 `skills:check` 的 repair/typecheck 阶段16项通过；其中历史Bundle、旧Skill入口与完整发布隔离专项按 AGENTS.md 的默认 local-authoring 范围停止，不将组合命令标记为全通过。本批另跑 tests/local-authoring-skill.test.ts 与 tests/page-reference.test.ts，2文件43项通过。

临时生成工作树已由托管归档工具保存可恢复快照后移除；主工作区与其他任务工作树保留。
