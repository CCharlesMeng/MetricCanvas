# 两套页面结构计划的对比与口径选择

日期：2026-09-21。状态：**已按口径 A 完成实现收敛**（2026-09-22）。下文保留选择时的历史对比；实现与验证见 [续跑记录](2026-09-22-authoring-resume.md)。

背景：`origin/main` 合入 `codex/grouped-page-params` 的过程中，发现两边各有一套「页面结构计划」。本文把差异摆齐，供决定哪套是最终口径。合并基点是 `8621f10f`，该提交上**两套都不存在**——它们是基点之后各自长出来的。

## 1. 它们不是两个特性，是同一个模块的两次演进

| | 本分支（v2 目标面） | main（已在主干） |
|---|---|---|
| 创建提交 | `56ae99ff refactor(authoring): land the shared use cases and Platform v2 baseline` | `ad96e28d feat(authoring): add scenario-guided composition and refine report layouts` |
| 模块位置 | `pages/composition/{page_structure,structure_composition}.py`、`pages/editing/section_editing.py` | `domain/{page_structure,section_editing,section_presentation,structure_presentation,structure_preflight,structure_diagnostics,structure_scope}.py`、`application/{structure_composition,structure_revision,structure_query_cache,metric_relations,page_parameters,parameter_preparation}.py` |
| 体量 | 310 行 / 3 模块 | 1133 行 / 13 模块 |
| 计划 Schema 真源 | 内联推导：`section-patterns.json` + `page-build-spec.schema.json` + `contract-snapshot/page/schema.json`，`version` 固定 `'1'` | authored 契约 `page-structure-plan.schema.json`，`oneOf` 三版（v1/v2/v3） |

判断依据不是名字相同，而是**公开面几乎一致**：两侧都导出 `PATTERNS`、`obj`、`StructureError`、`validate_plan`、`field_id`、`block_component`、`scope_note`。main 多一个 `scope_notes`，`block_component` 多一个 `relations` 关键字参数。`block_component` 的正文 diff 是纯增量，没有互斥改写：

- `intent` 缺省从 `purpose` 推导（`structure_presentation.purpose_intent`）
- `presentation.kind == 'metric-summary'` 时走 `section_presentation.present_metric_summary(block, source, component, relations)`
- 统一后置 `structure_presentation.apply_presentation(block, source, component)`
- span 取 `PATTERNS['presentations']['metric-summary']['metricSpan']`

## 2. 能力差（main 有、本分支没有）

| 能力 | main 的实现 | 本分支 |
|---|---|---|
| 主辅指标组合与确定性呈现（`compactSummary` 的 rows/changes 展开） | `domain/section_presentation.py`（90 行） | 无 |
| 呈现意图统一后置（`purpose` → intent、`apply_presentation`） | `domain/structure_presentation.py`（67 行） | 无 |
| 计划预检与查询签名去重 | `domain/structure_preflight.py`（76 行）、`application/structure_query_cache.py`（43 行） | 无 |
| Schema 错误定位到具体路径 | `domain/structure_diagnostics.py`（33 行） | 无 |
| 结构修订与范围刷新 | `application/structure_revision.py`（143 行）、`domain/structure_scope.py`（14 行） | 无 |
| 指标关联证据 | `application/metric_relations.py`（41 行） | 无 |
| 页面参数发布工作流 | `application/page_parameters.py`（242 行）、`application/parameter_preparation.py`（48 行） | 无 |
| 计划 Schema 多版本（v2/v3 大纲语义） | authored 契约 `oneOf` 三版 | 只有 v1 |

反过来，本分支那套**没有**任何 main 缺少的能力：它是同一模块在 Platform v2 归位时带过去的较早形态。

## 3. 消费者与测试

| | 消费者 | 专属测试 |
|---|---|---|
| 本分支 | `data/results.py`、`pages/referenced.py`、`pages/composition/{unified_composition,structure_composition}.py`、`pages/editing/{unified_edit_page,section_editing}.py`——Platform v2 目标面 | `test_shared_authoring_capabilities.py`（7 项） |
| main | `entrypoints/compat/unified_content_mcp.py` 及其自身模块——v1 兼容面 | `test_structure_v3.py`（15）、`test_section_presentation.py`（9）、`test_page_parameters_mcp.py`（8）、`test_structure_revision.py`（5）、`test_parameter_preparation.py`（5）、`test_structure_preflight.py`（2），共 **44 项** |

`test_structure_plan.py`（16 项）两边都写了一版，是 14 个冲突之一。

## 4. 当前合并态的两处硬伤

「两套原地共存」在现在的工作区里**不成立**，有两处会直接炸：

1. **13 个模块里 8 个 import 不了。** 它们引用的是本分支已经拆掉的模块：`domain.page_building`（已拆为 `pages/composition/page_building.py` + `data/executable_units.py`）、`domain.execution`（已进 `data/`）、`application.bundle_info`（已进包根）、`application.authoring_turns`（已进 `work/`）。逐个 import 的结果：`structure_presentation`、`structure_diagnostics`、`structure_scope`、`metric_relations`、`parameter_preparation` 通过；其余 8 个 `ModuleNotFoundError`。
2. **契约取成了本分支版。** 合并后的 `contracts/authored/section-patterns.json` 只有 `version`/`scenes`/`patterns`，没有 main 的 `presentations`；main 的 `block_component` 读 `PATTERNS['presentations']['metric-summary']['metricSpan']`，会 `KeyError`。

## 5. 决定这件事的关键事实

本分支自己的计划 [`docs/plan/scenario-guided-refinement/tasks.md`](scenario-guided-refinement/tasks.md) S2「主辅指标组合与确定性呈现」写的是：

> 依据注册表将对象概况展开为 compactSummary 的 rows/changes……
> 文件：`pages/composition/page_structure.py`（修改）；同目录 `section_presentation.py`（**新建**）；`contracts/authored/section-patterns.json`（**修改**）；`test-harness/tests/test_section_presentation.py`（**新建**）。

三项全是未打勾的 `[ ]`。而 main 已经有 `section_presentation.py`（90 行）、`test_section_presentation.py`（9 项）、`section-patterns.json` 里的 `presentations`。

也就是说：**main 那套就是本分支计划里还没做的那一段的已实现版本**，不是竞品。

## 6. 三个口径

**口径 A · 以 main 为准（推荐）**

删掉本分支那套 3 个模块，v2 侧 6 个消费者改指 main 的实现，main 的 13 个模块按新布局归位（`data/`、`pages/composition/`、`pages/components/`、`work/`），`section-patterns.json` 取 main 版。

- 代价：一次真正的移植，约 1100 行改 import + 6 处消费者改造 + 两套 `test_structure_plan.py` 合一。`unified_edit_page.py` 要把 main 的 `structure_state` / `load_relations` 约 30 行并进来。
- 收益：拿到呈现、指标关联、预检、修订、参数发布整条线；不在主干上删已上线功能；scenario-guided S2 不用重做。

**口径 B · 以本分支为准**

main 那条线在合并后整体退役，删 13 个模块与 44 项测试，`unified_content_mcp.py` 的相关接线一并拆掉。

- 代价：在主干上删已经上线的功能，需要单独的决策记录；scenario-guided S2/S3 得自己重做一遍，等于把 main 已验证的 44 项测试重新挣一遍。
- 收益：合并立刻收口，`application/`、`domain/` 保持删除。

**口径 C · 两套并存**

修 8 个 import、`section-patterns.json` 取并集，两套同名同义模块长期并行，`application/` 与 `domain/` 两个包永久回归。

- 代价：直接违背刚做完的 A03「同一事实只有一个权威维护源」和第七/八批的归位结论；同名的 `page_structure`、`section_editing`、`structure_composition` 各两份，后续每改一次结构计划都要改两处。
- 收益：合并最快收口。

## 7. 建议

**口径 A。** main 已在主干且带着 44 项测试，本分支那套是同一模块的较早形态且没有独占能力；口径 B 是在主干上删功能再重做，口径 C 把刚收敛的真源重新劈成两份。

归位工作量真实存在，但它是「把第七批对 main 的新特性再做一遍」，性质与已完成的 7a–7h 相同，可以按同样的退出条件单独成批，不必塞进合并提交。
