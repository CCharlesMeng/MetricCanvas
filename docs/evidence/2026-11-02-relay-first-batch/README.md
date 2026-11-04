# Relay 产品演进首批实施回执

2026-11-02。基线与远端 main 在启动时均为 `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`，Schema 6.80。实现保留在 `/Users/moon/.codex/worktrees/relay-product-first-batch/DataDashboard`，未提交、push 或部署。主目录及两个既有工作树的并行修改未纳入本批。

实施依据为主目录尚未提交的 `docs/plan/2026-11-02-product-relay-evolution/implementation-handoff.md`、`implementation-seams-v1.md` 与 Relay 反馈 assessment/v1.1；从主目录读取，没有整树复制设计或工作区。本回执覆盖 **I08a 百分比确定性纠错**和 **I05a 无 I/O 扫描/读取范围提取**，不代表 I05/I08 全部完成。

## 已实现

| 批次 | 原问题 / 结果 | 代码入口 |
|---|---|---|
| I08a | 原值 12.5、单位 `%`：完整覆盖选 `percent-2`，部分或未知覆盖误选 `number`。现在可信百分数刻度先于覆盖率判断，三种覆盖均保留百分号。 | `data/field_presentation.py` |
| I08a | 来源 `scale: percent` + 普通数值 `defaultFormat` 建议不再直接短路；改成 `percent-2`，返回 `PRESENTATION_FORMAT_ADJUSTED`，关联数据源、字段及 from/to，来源描述本身不改。 | 同上，现有 `query.py` warnings 路径 |
| I08a | 微小正负百分比保留单位与原值，返回 `PRESENTATION_PRECISION_LIMIT`。组件显式格式、无来源描述的已有默认格式继续保留。 | 同上；实际格式器未变 |
| I05a | 扫描、字段/容器/子表发现和读取闭包由产品内部纯模块拥有；显式传入页面与 Schema，不读取文件、不执行查询。 | `packages/page/src/authoring/data-scan.ts`、`data-scope.ts` |
| I05a | 原工具导出兼容；CLI 的磁盘、hash、manifest、材料/报告、退出码继续留在原包装层；MC inspect 改用产品核心。 | `tools/scripts/local-authoring-data-{analysis,scope,cli}.ts`、`mc-content-page.ts` |

原始值、查询体、粒度、取数单元的其他属性及输入对象保持；不改保存、partial、unknown 或 preview 流程。Page Schema 字段净变化 **0**，仍为 6.80；不新增工具或模型步骤。`fraction`、`unknown`、已有缩放值不猜百分比、不重复缩放。

`percent-*` 现有最大精度为两位，`0.0001` 仍显示 `0.00%`；这是明确返回的能力限制。原值明细显示 `0.0001`，本批没有新增精度枚举或统一全产品小数位策略。静态 local 校验只证明页面合法，不证明业务刻度或真实查询已验真；本批未删除生产方法兜底。

## 场景、文档与分发

- 实际页面：`pages/capabilities/data/authoring-percent-coverage.json`，入口 [页面试验场](http://127.0.0.1:5197/pages/authoring-percent-coverage)，无需 URL 参数或 DQE。5197 监听进程的 cwd 已核实为本工作树的 `apps/playground`。
- 页面为 inline 合成数据，普通、微小正负、零与缺失均可观察。相邻原值和显式一位格式使用同一组输入值的合成列副本；指标卡继承默认百分比，表格排序仍比较原值。
- 更新 `PAGE-METADATA.md`、`docs/page-metadata/field-bindings-and-formats.md` 及 reference-map；MC 数值与诊断指导在既有作者源更新。新示例由 `pages/` 真源进入官方导出链。
- `pnpm authoring:contracts`、`mc-content-fixtures.py` 正式生成契约、参考、MC、local 和完整性锁。生成器按最小合法样例重新选择了部分组件示例及其引用；没有从另一工作树整包复制或手改摘要。
- local Skill 修订为 **1.17.4**；完整安装包与 release 回执位于 `artifacts/relay-product-first-batch-20261102/`。归档 SHA256：`e189f0408a7439c47ac86a9ec1d9a04f126b305377b05c7df9ad120469fe209b`。来源标记为当前基线上的脏工作区，不是冻结发行或目标环境部署。

## 验证

| 层次 | 实际结果 / 证据 |
|---|---|
| 失败复现 | 改动前直接调用实际格式决策：total=1 → percent-2；total=2 → number，断言 `known percentage lost its unit` 失败。新增回归在修复前出现 8 个失败及 1 个新参数错误，修复后通过。 |
| 字段、来源映射、查询策略 | 41 项通过；包括部分/未知覆盖、来源建议、显式意图、已缩放/未知刻度、零/缺失与微小正负值，查询原值及来源描述不变。 |
| 扩展 Python 回归 | [62 项回归](python-regression.log)：60 通过，2 个基线失败；同样失败已在原 main 复现，见[基线记录](baseline-failures.log)。分别为 time-granularity 候选应含 month 的旧断言，以及旧 presentation 编辑操作的 OPERATION_INVALID。未混入本批修复。 |
| 扫描与仓外 CLI 一致性 | [8 项核心回归](core-check.log)通过。冻结 `552ef5c` 的完整有序输出摘要；嵌套/子表/层级/共享消费者及非法组件诊断保持，仓外 CLI 与程序输出逐项相同，页面和 Schema 不变。共享依赖图按 neutral platform 打包通过，不含工具包装层。 |
| 既有 local 行为 | 局部读取及子表 44 项通过；整套 `pnpm skills:check` 退出 0：repair/发行 16 项、authoring 232 项全部通过，含 17 个导出隔离场景。见 [skills-check.log](skills-check.log)。 |
| 产品生成与 MC | [mc-check.log](mc-check.log)：生成一致性、完整覆盖、51 项 MC 回归及诊断夹具检查。Bundle [6,579 项摘要](bundle-check.txt)通过。 |
| 类型 | `tsc --noEmit -p packages/page` 与 `-p tests/tsconfig.json` 通过；repair 入口的定向类型检查随 skills 检查执行。 |
| 浏览器 | [browser.json](browser.json)：Chrome headless，1280 与 390 宽，实际自动发现页面、百分号/原值/显式覆盖/缺失/指标卡及原值排序通过，无 pageerror。截图在 artifacts 目录；这是合成渲染证据。 |
| 独立安装 | [归档回验](independent-skill.json)通过：仓外版本、合法概览与非法页面退出码正确。安装内容不依赖产品仓库或 Python。[738 个文件](archive-source-match.json)与当前完整安装目录逐字节相同。 |

首次检查曾误用缺依赖的系统 Python；正式检查改用主目录锁定的 Python 3.12 环境，并设置 `PYTHONDONTWRITEBYTECODE=1`。本工作树检查过程中产生的 MC bytecode cache 已删除，完整性检查未豁免缓存或摘要。旧解释器/旧输入的长检查已终止，最终检查使用锁定环境。

## 复杂度

TS 使用 `metriccanvas-ts-ast/1`、TypeScript 5.9.3；Python 使用 Radon 6.0.1。测量每个函数及闭包自身 CC，生成的压缩脚本以维护真源为口径。全部原始函数结果见 [TS 前](complexity-ts-before.json)、[TS 后](complexity-ts-after.json)、[Python 前后](complexity-python.json)及[固定门禁](complexity-python-gate.json)。

| 函数 / 范围 | 前 → 后 |
|---|---|
| apply_field_presentation | 7 → 7 |
| choose_field_format | 6 → 13 |
| choose_scale | 15 → 13 |
| finite_magnitudes 提为模块函数 | 8 → 8 |
| 新 percent_points / precision_warning | 新增 5 / 4 |
| query_data 闭包 | 33 → 33；只透传既有 warnings，本次不扩大流程重构 |
| scanPageData | 13 → 13 |
| auxiliaryUses | 20 → 9；字段收集/控制引用新辅助函数 9 / 4 |
| scopePageData / readingClosure | 1 → 1 / 2 → 2 |
| buildProductOutputs | 15 → 15；仅增加既有生成名单的一项 |
| 产品核心全部函数/闭包 | 59 项，最大 13；TS 新增测试与浏览器回调最大 3；Python 新增测试最大 6 |

固定 Python 清单无超限。仍存在未修改的 `checkAnalysis` 回调 CC19、`buildSkillProjections` CC52；不以代码搬移宣称这些存量问题已治理。修改的 query_data CC33 未增长：更大异步授权、执行与诊断流程的拆分不属于这次格式参数修复。

## 后续边界

I08 的 Tokens 百万规则、最终组件/轴/标签/Tooltip 格式全面检查、local 的同源业务语义诊断及对应方法减负尚未完成。I05 的报告身份/业务映射关联仍需后续批次；本批完成 D2 的纯扫描/范围提取，不宣称整个 D1–D4 已兑现。

I06 多槽装配/编辑、I07 保留既有页面意图的受控换源、I01–I04 Relay 采用/可信轮次/产物交接不在本批。私有四类材料仍待补齐；没有改 Gate、猜造 store/CAS、向其他聊天发消息或覆盖内部 Adapter。

真实 DQE/Relay/Java、真实模型、目标安装部署和远端 CI 均未运行。本地通过及独立归档不能替代这些层次。工作树保留用于复核和后续实施，未请求交付，因此未合并、清理或 push。
