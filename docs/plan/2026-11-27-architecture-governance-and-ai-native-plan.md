# MetricCanvas 架构治理、AI-Native 升级与技术债清理主计划

> **状态**：Wave 0 已合入 `main`（PR #199 @ `560b1d968`）；Wave 1A（`W1-1` ~ `W1-4`）已合入 `main`（PR #200 @ `5e41ea766`，CI 8/8 全绿）；`W1-5` 已拍板延后并与 `W4-1` 合并推进（按 D1 执行）；当前正在推进 Wave 2  
> **立项日期**：2026-11-27  
> **基线提交**：`origin/main` @ `8ce2dd52eaabc179bf195000cf3592e6b0f1b8f3`  
> **唯一执行主入口**：本文为本轮“开发态转维护态”长周期治理的唯一主计划与进度台账。跨会话推进时就地更新勾选状态、提交 SHA 与复测指标，不再另起分稿。

---

## 1. 目标与已锁定架构决策

项目已完成核心能力快速建设，现转入**长期维护 + 标准 AI-Native 演进**阶段。治理目标为：**清晰单向分层、高内聚深模块、单一真源（SSOT）、轻指令重护栏、可持续低成本维护**。

以下 4 项关键决策已与项目负责人最终拍板，后续波次直接按此执行，不再反复讨论：

| # | 决策项 | 已锁定结论 |
| :---: | :--- | :--- |
| **D1** | **5 份生成镜像收敛与质量保证** | 收敛 Git 中冗余的 5 份生成镜像副本，对外预留幂等的一键构建命令（如 `pnpm authoring:materialize` / `pnpm skills:pack` / `pnpm mc:content:pack`），并通过 **4 层闭环** 保证产物 100% 可用：① per-PR 干净工作区现场构建与覆盖/链接闭合校验；② Git 保留轻量确定性指纹锁替代 15 MB 镜像；③ CI 打包后搬至仓外独立空目录做 Linux+Windows 黑盒安装回验；④ Release 附带通过回验的 `.tar.gz` + `.release.json`（SHA-256）。 |
| **D2** | **Python 校验器单真源策略** | Python 创作运行环境**预设 Node 22+ 可用**。Wave 3 彻底退役 `page_validation.py` 中手工维护的 2,910 行双份语义校验及 `_uses_product_bridge` 关键字嗅探，100% 收口至 `@metriccanvas/page` 单一校验真源；Node/桥接不可用作为独立环境错误报错，不再混成 `SCHEMA_ERROR`。 |
| **D3** | **Linter / Formatter 工具链** | 采用 **Biome（覆盖 `.ts/.mts/.js/.mjs/.cjs/.json`）+ 复用现有 `svelte-check`（覆盖 `.svelte` 模板与 Svelte 5 runes）**。接入策略为**先启用正确性与 import 卫生规则、格式规则卡增量改动**，避免首日全仓纯格式 diff 污染 `git blame`。 |
| **D4** | **推进方式与隔离策略** | 基于最新 `origin/main` 在独立干净 worktree 按 **Wave 0 → Wave 4** 稳步推进；严格遵守 **Tidy First（结构变更与行为变更分离）**，每项任务拆分独立原子 PR，并编排多 Subagent 并行执行 + 独立只读验真。 |

---

## 2. 阶段 0 量化基线快照（验收对照标尺）

> 本表记录 `8ce2dd52` 基线实测值，Wave 4 收口时按同口径复测并填入“实际结果”。

| 维度 | 指标 | 阶段 0 基线 | 维护期目标 | Wave 4 复测 |
| :--- | :--- | :--- | :--- | :--- |
| **测试安全网** | 测试/生产 LOC 比 | **0.92**（82,279 / 89,151 LOC） | ≥ 0.92（零行为回归） | 待测 |
| **根目录卫生** | 根条目数 / 误提交文件 | 46 条目（含 3×`pelican-*.html`、`.pnpm-store/v11/index.db`、3 个已跟踪 `.scratch`/`output` 文件） | 误提交 **0**；根条目 ≤ 25 | 待测 |
| **架构门禁** | `pnpm architecture:check` 违规 | **21 条**（10 环 + 11 跨层违例） | **0 条** | 待测 |
| **依赖环** | 静态环（含 `import type`） / 运行时值环 | **15 SCC**（含 `packages/page` 48 文件大环） / **2 运行时环** | 运行时环 **0**；静态大环拆解 | 待测 |
| **边界穿透** | `runtime-ui` 深路径绕过 barrel 导入 | **93 处**（53 `widgets` + 40 `runtime`） | **0 处** | 待测 |
| **枢纽磁铁** | `packages/page/src/internal.ts` Fan-In / Fan-Out | **265 / 91**（且被 `embed`/`engine` 公开重导出） | 拆分子域入口；公开包零重导出 `internal` | 待测 |
| **隐性复杂度** | `selfCC ≤ 15` 但 `subtreeCC > 100` 闭包工厂 | **5 个**（最高 `session.ts` `subtreeCC=267`，88 嵌套闭包）；豁免 **161 项** | 闭包上帝工厂 **0**；门禁覆盖 `subtreeCC` | 待测 |
| **头号热点** | 最高 `Churn × LOC` 文件（近 200 提交） | `RuntimeSurface.svelte`（**41 × 2,347 = 96,227**，Fan-Out 66） | 主视图壳 < 400 行，控制器独立可测 | 待测 |
| **双份校验** | TS / Python 语义校验实现 | `validate.ts` (2,701 L) + `page_validation.py` (2,910 L) | 单一真源（Python 仅桥接调用） | 待测 |
| **文档与提交噪音** | Markdown 总量 / >25 文件大提交占比 / `docs/plan/` 文件数 | **23.0 MB** / **48% (143/300)** / **227 文件** | 收口冗余镜像与已完计划；大提交占比 < 15% | 待测 |
| **AI 上下文与护栏** | 核心治理+入口文档体积 / per-PR 未入 CI 漂移检查 / Lint | **402 KB（~20–24 万 token）** / **5 项未入 CI** / **0 Linter** | 入口体量降 ≥ 50%；检查全入 CI；Biome 就位 | 待测 |

---

## 3. 维护期六条架构不变量（Invariants）

所有后续重构与新增功能均须遵守以下红线（除特别说明外，均需落入 CI 自动校验）：

1. **规范态内核（Canonical-Only Core）**：所有历史字段与版本号特例（`layoutForm`、`dashboardToolbar`、根 `iocHeader`、`back: 'auto'`、`legacyCandidateSearch`、`6.13/6.14` 日期、`tab.component` 等）只在入口反腐败层（ACL / Normalizer）一次性归一化。**统一运行时与纯渲染组件内禁止版本号分支与特定业务文案硬编码**。
2. **单一校验真源（Single Validation SSOT）**：页面元数据语义校验仅在 `@metriccanvas/page` 维护一份，创作期工具统一复用。
3. **双视图 Schema（Compat Read vs Strict Authoring）**：运行期读取保持兼容；面向 AI 与文档的 `schema.authoring.json` 仅暴露现行规范字段与单一当前版本号，屏蔽废弃字段与 135+ 历史版本号。
4. **深模块与显式边界（Deep Modules & Zero Bypass）**：禁止跨包或跨子目录绕过显式入口直连私有源码；消除无抽象价值的 1 行转发空壳；对外公开包不得重新导出 `@metriccanvas/page/internal`。
5. **声明式扩展与编译期穷尽（OCP）**：组件渲染派发、版本能力注册与一致性测试向量按组件/能力内聚组织，渲染派发采用 `Record<Component['type'], ...>` 确保编译期穷尽，避免新增一类组件改动十几处中心文件。
6. **轻指令、重护栏（Harness-First AI-Native）**：凡能用 Biome、TypeScript、`svelte-check`、`architecture:check`、`complexity:check` 与 CI 拦截的规则，不依赖自然语言提示词；文档遵循渐进式披露，按需加载、真源派生。

---

## 4. 执行 Agent 编排与并行协作协议

本治理横跨多个波次与数十个原子任务，采用 **“1 个主控 Coordinator + 6 类专业 Subagent 角色”** 分工协作，通过**按文件/目录零重叠切片**实现安全并行，所有代码改动须经过独立只读验真。

### 4.1 角色分工与模型选型

| 角色代号 | Subagent 类型与建议模型 | 职责边界（仅修改授权路径） | 典型承担任务 |
| :--- | :--- | :--- | :--- |
| **`coordinator`（主控）** | 当前主会话（高能力模型） | 基线同步、跨模块契约设计与接口定稿、Subagent 切片派发、结果合并审查、更新本台账、按 `scoped-main-delivery` 提交与盯 CI | 全程统筹、PR 拆合与门禁裁决 |
| **`guardrail-engineer`** | 写权限 Subagent（`inherit`） | CI workflow、门禁脚本、Biome 配置、`package.json` 快捷命令、`validate-cli` | `W0-1` ~ `W0-5` |
| **`repo-docs-curator`** | 写权限 Subagent（`flash` / `inherit`） | 根目录杂项清理、`.gitignore`、`docs/plan/` 归档、`docs/` 与根 `*.md` 消歧、`AGENTS.md` 瘦身、`ARCHITECTURE.md` | `W1-1` ~ `W1-4` |
| **`mirror-delivery-engineer`** | 写权限 Subagent（`inherit`） | `tools/scripts/export-authoring-contracts.ts`、镜像收口、指纹锁、仓外分发验证、双视图 Schema 导出 | `W1-5`、`W4-1` |
| **`boundary-architect`** | 写权限 Subagent（`inherit` / `pro`） | `architecture:check` 违规清零、断环、收窄 `page/internal`、消除 93 处深路径导入、统一入口 ACL、剥离业务硬编码、错误模型统一 | `W2-1` ~ `W2-6` |
| **`hotspot-refactorer`** | 写权限 Subagent（`pro` / `inherit`） | 拆解高风险上帝模块与闭包工厂（`RuntimeSurface`、`session`、`filter-state`、`orchestrator`、`validate`、`version`、`Table`）、退役 `page_validation.py` | `W3-1` ~ `W3-7`、`W4-2` |
| **`verifier-auditor`** | 只读 Subagent（`flash`） | **独立验收（不写代码）**：运行定向/全量测试、复杂度改前改后实测、`architecture:check`、1 MB blob 检查、diff 范围与行为保持审计 | 每个 Wave 交付前必经关卡 |

### 4.2 波次内并行策略与依赖 DAG（避免写冲突）

> **核心并行铁律**：同一时间并行运行的写权限 Subagent 必须拥有**严格不相交的文件写入集合**；凡触碰同一中心文件（如 `package.json`、`ci.yml`、`RuntimeSurface.svelte`、`validate.ts`）的任务必须串行或交由主控统一合入。

```mermaid
flowchart LR
    subgraph W0["Wave 0: 立护栏 (并行度 3)"]
        W0_1["W0-1 CI与blob门禁"]
        W0_2["W0-2 subtreeCC棘轮"]
        W0_3["W0-3 Biome+局部脚本\n(W0-3+W0-4串行合入package.json)"]
        W0_5["W0-5 validate-cli改造"]
    end

    subgraph W1["Wave 1: 降噪瘦身 (并行度 3)"]
        W1_1["W1-1 根目录与误提交清理"]
        W1_2["W1-2 docs/plan归档与索引"]
        W1_3["W1-3 文档消歧与日志剥离"]
        W1_4["W1-4 AGENTS瘦身+ARCHITECTURE"]
        W1_5["W1-5 镜像收敛与4层闭环"]
    end

    subgraph W2["Wave 2: 边界收口 (分2批并行)"]
        W2_1["W2-1 清零21条架构违规"]
        W2_2["W2-2 清零93处深路径导入"]
        W2_3["W2-3 拆page子域+收窄internal"]
        W2_4["W2-4 统一入口ACL"]
        W2_5["W2-5 清洗组件业务硬编码"]
        W2_6["W2-6 修复错误吞没与分类"]
    end

    subgraph W3["Wave 3: 热点攻坚 (按模块并行)"]
        W3_1["W3-1 拆RuntimeSurface"]
        W3_2["W3-2 平铺session+filter-state"]
        W3_3["W3-3 平铺orchestrator+controller+dqe"]
        W3_4["W3-4 拆validate+version+vectors"]
        W3_5["W3-5 ComponentRenderer穷尽派发"]
        W3_6["W3-6 拆Table+MetricCard"]
        W3_7["W3-7 退役page_validation.py"]
    end

    subgraph W4["Wave 4: AI-Native 闭环"]
        W4_1["W4-1 双视图Schema"]
        W4_2["W4-2 结构化自愈诊断"]
        W4_3["W4-3 Golden模板+术语巡检"]
        W4_4["W4-4 量化复测与交接"]
    end

    W0 --> W1 --> W2 --> W3 --> W4
```

* **Wave 0 并行切片**：`W0-2`（`tools/scripts/audit-code-complexity*`）与 `W0-5`（`packages/page/src/validate-cli.ts`）零重叠并行；`W0-1` + `W0-3` + `W0-4` 涉及 `package.json` / `.github/workflows/ci.yml`，由 `guardrail-engineer` 按顺序连续合入。
* **Wave 1 并行切片**：`W1-1`（根目录与 `pages/temporary/`）、`W1-2`（`docs/plan/` + `docs/archive/` + `docs/adr/README.md`）、`W1-3` + `W1-4`（现行文档与 `AGENTS.md`）互不冲突可并行；`W1-5`（镜像收敛）独立由 `mirror-delivery-engineer` 执行并走独立 PR 验收。
* **Wave 2 并行切片**：第 1 批并行 `W2-1` + `W2-5`（分别改依赖边/空壳与 `Table.svelte`/`MetricCard.svelte` 业务文案）；第 2 批顺序执行 `W2-2` → `W2-3` → `W2-4` → `W2-6`（均涉及核心契约接口，逐步收紧）。
* **Wave 3 并行切片**：`W3-2`（`data-execution` + `engine/runtime`）、`W3-4`（`packages/page` + `tools/scripts`）、`W3-6`（`engine/widgets`）、`W3-7`（`metriccanvas-authoring` Python 侧）四条线目录天然隔离可并行；`W3-1`（`RuntimeSurface.svelte`）与 `W3-5`（`ComponentRenderer.svelte`）在 `W2-6` 完成后推进；`W3-3` 紧随 `W3-2` 之后。
* **Wave 4 并行切片**：`W4-1`、`W4-2`、`W4-3` 并行完成后，由 `verifier-auditor` 执行 `W4-4` 量化复测。

### 4.3 Subagent 交付契约与跨会话接续协议

1. **单次 Subagent 派发必须明确**：目标任务 ID（如 `W0-2`）、授权改动路径白名单、必须先补/确认的特征测试、改前改后复杂度测量口径、以及本地验收命令。
2. **严禁自审自过**：每个写权限 Subagent 完成后，由 `verifier-auditor` 独立复核 diff、单测、`complexity:check`、`architecture:check` 与暂存文件体积（≤ 1 MB）。
3. **Tidy First 强制分离**：结构性重构 PR 不夹带任何协议字段变更或业务行为修改；如途中发现需调整页面 Schema，须立即暂停并按 `AGENTS.md` §Schema 演进先向用户提案确认。
4. **跨会话接续（长战线工作流）**：每次新开会话，只需执行 `scoped-main-delivery` 同步基线并读取本文 **§5 任务台账**，从第一个未勾选 `[ ]` 的任务继续派发 Subagent，每合并 1 个 PR 同步勾选 `[x]` 并在 §6 记账。

---

## 5. Wave 0 → Wave 4 原子任务台账

### Wave 0｜先立护栏与止血（目标：阻止新债务进入，建立秒级反馈）

- [x] **`W0-1` 补齐 CI 漂移门禁与文件体积守卫**（负责：`guardrail-engineer`）
  - **范围**：`.github/workflows/ci.yml`、新增 `tools/scripts/check-repo-hygiene.mjs`（检查已跟踪/变更文件 ≤ 1 MB 白名单外拦截、拦截 `docs/evidence/` 新增跟踪文件）。
  - **动作**：将 `pnpm adr:index:check`、`pnpm design:facts:check`、`pnpm packages:check` 及仓库卫生检查接入 per-PR `ci.yml`；同步更新 `tests/ci-workflow.test.ts`。
  - **验收**：`pnpm test tests/ci-workflow.test.ts` + 新增卫生脚本单测通过 + 远端 CI 绿。
- [x] **`W0-2` 堵住复杂度门禁闭包嵌套漏洞（`subtreeCC` 棘轮）**（负责：`guardrail-engineer`）
  - **范围**：`tools/scripts/measure-ts-complexity.mjs`、`tools/scripts/audit-code-complexity.mjs`、`tools/scripts/complexity-debt.json` 及对应测试。
  - **动作**：在保留 `selfCC ≤ 15` 基础上增加 `subtreeCC`（阈值 45）与生产文件行数（阈值 600）棘轮基线，允许存量登记下降、禁止新增或恶化；更新 `docs/agents/code-complexity.md` 说明口径。
  - **验收**：TS/JS 棘轮单测与仓库自检通过（Python `radon` 部分待 CI `authoring` 作业复核），当前 35 个 `subtreeCC > 45` 闭包工厂与 9 个 >600 行生产文件已锁定。
- [x] **`W0-3` 引入 Biome（TS/JS/JSON）并与 `svelte-check` 协同**（负责：`guardrail-engineer`）
  - **范围**：`package.json`、`biome.json`、`.github/workflows/ci.yml`。
  - **动作**：安装 `@biomejs/biome` (`^2.6.9`)，配置 `biome.json`（排除 `.svelte`、生成产物与归档夹具；开启 correctness / suspicious / unused imports，格式化卡增量改动），新增 `pnpm lint` / `pnpm lint:fix` / `pnpm format:check` 并接入 `ci.yml`。
  - **验收**：`pnpm lint` 116ms 扫 2,113 文件 0 errors，`pnpm check` 通过，零大面积历史格式 diff。
- [x] **`W0-4` 补齐按包秒级测试与快速自检脚本**（负责：`guardrail-engineer`）
  - **范围**：根 `package.json`。
  - **动作**：新增 `test:page`、`test:data-execution`、`test:engine`、`test:platform`、`test:playground`、`verify:fast`（`lint + hygiene:check + architecture:check`，零 Python 依赖）。
  - **验收**：`pnpm verify:fast`、`pnpm test:page`、`pnpm test:data-execution` 均跑通。
- [x] **`W0-5` 升级 `pnpm validate` 支持单文件与 `--json`，消除 `packages → tools` 反向依赖**（负责：`guardrail-engineer`）
  - **范围**：`packages/page/src/validate-cli.ts`（及单测）。
  - **动作**：支持传入单个 `.json` 文件或目录；增加 `--json` 机器可读输出；内聚页面文件扫描逻辑，消除 `packages/page/src/validate-cli.ts` 对 `../../../tools/scripts/page-files.mjs` 的反向 import。
  - **验收**：`pnpm validate`（268/268）+ 单文件 `--json` + `validate-cli.test.ts`（10/10）+ `pnpm check` + `pnpm architecture:check` 均绿。

---

### Wave 1｜仓库瘦身、文档消歧与镜像收敛（目标：清噪音、降上下文、砍大提交）

- [x] **`W1-1` 根目录杂项与误提交清理**（负责：`repo-docs-curator` / `flash`）
  - **范围**：根目录 `pelican-*.html`（3 个）、`.pnpm-store/v11/index.db`、已跟踪的 `.scratch/*`（2 个）与 `output/diagnostics/platform-route-hide-probe-20261014.js`、`.learnings/`（3 文件）、`.gitignore`、`pages/temporary/`（清理 5 个零引用子目录共 26 文件，保留 8 个仍有测试/文档消费者的目录）。
  - **验收**：`pnpm validate`（263/263）、`pnpm verify:fast` 与 12 份消费者测试（100/100）通过；根误提交清零。
- [x] **`W1-2` 收口 `docs/plan/` 历史分稿并修复归档/ADR 索引**（负责：`repo-docs-curator` / `flash`）
  - **范围**：`docs/plan/`、`docs/archive/README.md`、`docs/archive/plan-cleanup-2026-11/`、`docs/adr/README.md`。
  - **动作**：将 22 份已完成且无外部引用的历史分稿归档入 `docs/archive/plan-cleanup-2026-11/`（保留被 ADR/测试/原型引用的计划以零断链），清零 `docs/plan/` 未索引孤儿；修正 `docs/archive/README.md` 漏列批次与文件数；更新 `docs/adr/README.md` 下一编号至 `0133`。
  - **验收**：`pnpm adr:index:check` 通过，全仓相对链接扫描零断链。
- [x] **`W1-3` 全仓文档矛盾消歧与 `PAGE-METADATA.md` 日志剥离**（负责：`repo-docs-curator` / `inherit`）
  - **范围**：`CONTEXT.md`、`README.md`、`PAGE-METADATA.md`、`PAGE-PARAMETERS.md`、`docs/README.md`、`docs/solution.md`、`docs/frontend-runtime-capabilities.md`、`docs/changelog/page-metadata.md`、`docs/page-metadata/`、`docs/agents/`。
  - **动作**：统一版本号真源 `packages/page/src/version.ts`；将已上线的组合卡/分类明细/置顶汇总行移出 `CONTEXT.md` 提议区；`README.md` 补全 `packages/ui` 与 `packages/data-execution`；重写失真的 `docs/frontend-runtime-capabilities.md` 与 `docs/solution.md`（清零禁用旧名 `Canvas`/`宿主`）；修复断链与过时 ADR 计数；将 `PAGE-METADATA.md` 400+ 行历史日志剥离至 `docs/changelog/page-metadata.md`（**110.2 KB → 23.5 KB，-78.7%**）。
  - **验收**：`tests/page-reference.test.ts`（9/9）、`pnpm authoring:contracts:check`、`pnpm verify:fast` 全绿，零死链、零禁用术语。
- [x] **`W1-4` AI 上下文渐进式披露瘦身与维护者架构地图**（负责：`repo-docs-curator` / `inherit`）
  - **范围**：`AGENTS.md`、`docs/agents/*.md`、新增根级 `ARCHITECTURE.md`（127 行 / 10.3 KB）。
  - **动作**：精简 `AGENTS.md`（对齐 `.agents/skills/` 清单、指向自动化门禁与 `ARCHITECTURE.md`）；编写维护者架构图、职责边界、变更定位决策树与按包验证命令矩阵；核心入口+治理文档全集从 **343.7 KB 降至 277.3 KB（-19.3%，其中 `PAGE-METADATA.md` -78.7%）**。
  - **验收**：`pnpm verify:fast` 通过，核心入口锚点全部保留。
- [ ] **`W1-5` 5 份生成镜像收敛与 4 层构建验证闭环**（已拍板延后并与 `W4-1` 合并推进；负责：`mirror-delivery-engineer`）
  - **范围**：`tools/scripts/export-authoring-contracts.ts`、`package.json`、`contracts/`、`metriccanvas-authoring/`、`.gitignore`、`.github/workflows/ci.yml`、`.github/workflows/ci-full.yml` 及相关测试。
  - **动作**：
    - 新增幂等集成构建入口（`pnpm authoring:materialize`），支持集成方从任意提交一键构建所需分发内容；
    - 盘点并逐一解除 `contract-snapshot/`、`mc-content/`、`skill/metriccanvas-page-builder/`、`skill/metriccanvas-local-authoring/` 内的冗余生成 Markdown 镜像跟踪，改为**单源 + 轻量确定性指纹锁**（KB 级 manifest/hash）；
    - 在 `ci.yml` 中落实现场构建 + 覆盖率/链接闭合 + 确定性指纹校验（层 1+层 2）；
    - 在 `ci-full.yml` 中加固仓外空目录黑盒安装回归与 Release 制品校验（层 3+层 4）。
  - **验收**：`pnpm authoring:contracts:check`、`pnpm skills:check`、`pnpm mc:content:check` 与仓外安装验证全绿；重复构建产物字节一致；仓库 Markdown 镜像体量大幅下降。

---

### Wave 2｜架构边界收口、清零违规与统一 ACL（目标：清晰分层、零倒灌、纯渲染组件无业务污染）

- [x] **`W2-1` 清零 `architecture:check` 21 条基线违规与浅薄转发空壳**（负责：`boundary-architect`）
  - **范围**：`packages/engine/widgets/src/`、`packages/engine/runtime/src/`、`packages/engine/data-gateway/`、`packages/data-execution/src/`、`packages/page/src/`、`packages/ui/prototypes/`、`apps/platform/src/lib/workbench/publication-fixture.ts`。
  - **动作**：
    - 消除 11 处 `widgets → runtime` 倒灌（消除 `runtime/src/chart-series-state.ts` 等 10 个单行转发壳与 `engine/data-gateway/src/` 纯空壳，按包导出兼容策略调整指向）；
    - 拆断 2 个运行时值环（`packages/page` 5 文件参数/查询环与 `data-execution` `session.ts ↔ source-candidates.ts`）；
    - 移出混在生产源码中的 `pie-chart/prototype/`、`packages/ui/prototypes/` 与跨仓引用 `metriccanvas-authoring` 的 `publication-fixture.ts`；
    - 将 `packages/data-execution/src/debug-warnings.ts` 对 `import.meta.env.DEV` 的耦合改为可注入 logger/sink，切断 `widgets → data-execution` 的日志耦合。
  - **验收**：`pnpm architecture:check` 报告 **0 条违规**（并将棘轮锁死为 0），`pnpm packages:check` 与 `pnpm test` 绿。
- [ ] **`W2-2` 清零 `runtime-ui` 93 处深路径越权导入**（负责：`boundary-architect`）
  - **范围**：`packages/engine/runtime-ui/src/`、`packages/engine/widgets/src/`、`packages/engine/runtime/src/`、`tools/architecture/`。
  - **动作**：为 `widgets` 和 `runtime` 定义清晰的包内内部出口（如显式分组的 `internal-runtime.ts` / `internal-widgets.ts`），把 53 处 `widgets` 和 40 处 `runtime` 深路径导入全部收敛；在 `tools/architecture/` 新增禁止跨子目录绕过入口的校验规则。
  - **验收**：`pnpm architecture:check`、Embed 构建门禁（`pnpm --filter @metriccanvas/embed check:dist`）与全部单测绿。
- [ ] **`W2-3` 拆分 `@metriccanvas/page` 内部子域并收窄 `internal.ts`**（负责：`boundary-architect`）
  - **范围**：`packages/page/src/`、`packages/embed/src/types.ts`、`packages/engine/runtime-ui/src/index.ts`。
  - **动作**：
    - 将 `packages/page/src/` 内部按变化原因整理为清晰子域（`schema/`、`normalize/`、`validate/`、`query/`、`edit/`），打散 48 文件静态类型环；
    - 把 `DisplayInputsSource`、`DisplayInputsSnapshot`、`DataPeriodFact` 等真正对外稳定的类型提升到 `@metriccanvas/page` 公共入口，彻底禁止 `embed` 与 `engine` 公开重导出 `@metriccanvas/page/internal`；
    - 为 `packages/page/src/data-source.ts` 与 `filter.ts` 补齐与 Zod Schema 的双向编译期等价断言（或改用 `z.infer`）。
  - **验收**：`pnpm packages:check`、`pnpm compatibility:check`、`pnpm check`、`pnpm test:page` 全绿。
- [ ] **`W2-4` 建立统一入口反腐败层（ACL）收拢历史兼容**（负责：`boundary-architect`）
  - **范围**：`packages/page/src/normalize/`（整合 `legacy-compatibility.ts`、`layout-compatibility.ts`、`ioc-header-normalization.ts`、`header-binding.ts` 等）、`packages/engine/runtime/`、`packages/engine/runtime-ui/`、`packages/engine/widgets/`。
  - **动作**：在 `normalizePageDocument()` 入口一次性完成 `layoutForm`、`dashboardToolbar`、根 `iocHeader`、`back: 'auto'`、`tab.component`、`6.13/6.14` 日期、`legacyCandidateSearch`、`< 6.124` 清空确认等兼容归一化并产出显式规范态结构；移除 `ioc-header-normalization.ts` 的模块级全局 `WeakSet`，清空 `runtime-ui` / `widgets` 中的版本号分支判断。
  - **验收**：全部历史兼容测试（含 `5.x`/`6.x` 夹具回归）与 `pnpm test` 全绿。
- [x] **`W2-5` 剥离通用纯渲染组件与执行引擎中的特定业务硬编码**（负责：`boundary-architect`）
  - **范围**：`packages/engine/widgets/src/components/table/Table.svelte`、`packages/engine/widgets/src/components/metric-card/MetricCard.svelte`、`packages/data-execution/src/source-program/session.ts`、`packages/engine/runtime/src/orchestrator.ts`、`packages/engine/runtime-ui/src/RuntimeSurface.svelte`。
  - **动作**：
    - 移除 `Table.svelte:126` 通用表格硬编码副标题 `"— 代表本周期没有合同单/商务单"`（核对现有业务页/测试，确需展示的页面显式配置或由兼容层按旧版本注入）；
    - 移除 `MetricCard.svelte:175-184` 硬编码 `"年累计/同比/本月/环比"` 占位文案；
    - 将 `'region' / 'region-dept' / 'office' / 'rep-office'` 筛选规则收拢为显式策略模块，不再散落硬编码于执行引擎与渲染壳。
  - **验收**：组件单测 + Playground/Embed 浏览器回归全绿。
- [ ] **`W2-6` 统一错误传播契约与修复错误吞没**（负责：`boundary-architect`）
  - **范围**：`packages/page/src/errors.ts`、`packages/page/src/validate.ts`、`packages/engine/runtime/src/orchestrator.ts`、`packages/data-execution/src/source-program/session.ts`、`packages/engine/runtime-ui/src/RuntimeSurface.svelte`。
  - **动作**：清理 `RuntimeSurface.svelte` 10+ 处把异步定稿期/数据网关失败误报成 `SCHEMA_ERROR` 的裸 `catch`；修复 `orchestrator.ts:239` 吞没为 `UNKNOWN` 的问题；保留 `session.ts` 原始错误诊断；对齐 `ERROR_TYPES`（对真实字段契约错误发射 `FIELD_CONTRACT_ERROR`，清理或补齐从未使用的成员）。
  - **验收**：新增错误处理特征测试（覆盖异步定稿失败、查询异常、字段契约报错），全量测试通过。

---

### Wave 3｜热点攻坚、平铺上帝模块与消灭霰弹式修改（目标：攻克 Top 8 热点与双校验器）

> **执行纪律**：每个子任务开工前先锁定对应模块的特征测试基线，拆解遵守 **Deep Modules（深模块）** 原则（按变化原因拆，不拆出浅薄单行转发层），改后实测 `selfCC` 与 `subtreeCC` 均显著下降。

- [ ] **`W3-1` 拆解头号热点 `RuntimeSurface.svelte`（2,347 L → < 400 L）**（负责：`hotspot-refactorer`）
  - **拆解方案**：抽出 5 个独立、可单测的 TS 控制器：`page-lifecycle.ts`（初始化/鉴权/定稿期）、`url-param-sync.ts`、`detail-modal-controller.ts`（含焦点管理）、`export-controller.ts`（PDF/PNG）、`ioc-navigation-controller.ts`；样式 token 独立抽离；`RuntimeSurface.svelte` 退化为薄视图装配壳。
  - **验收**：`RuntimeSurface.svelte` < 400 行、Fan-Out ≤ 20；Playwright Embed + Playground 浏览器回归全绿。
- [ ] **`W3-2` 平铺 `session.ts`（`subtreeCC=267`）与 `filter-state.ts`（`subtreeCC=160`）**（负责：`hotspot-refactorer`）
  - **拆解方案**：消除共享可变闭包的 88/43 层嵌套函数；转为显式不可变/结构化状态上下文 + 顶层纯转换模块（如 DAG 调度、候选校验、初始行复用、URL 编解码各自独立单测）。
  - **验收**：两模块 `subtreeCC` 均降至门禁线以下，移除对应 `complexity-debt.json` 豁免。
- [ ] **`W3-3` 平铺 `orchestrator.ts`（150）、`table/controller.ts`（139）与 `dqe.ts`（69）**（负责：`hotspot-refactorer`）
  - **拆解方案**：`dqe.ts` 拆分为传输/并发队列、指标/对象 DSL 编码器、响应解包与诊断 3 个清晰模块；`orchestrator.ts` 与 `table/controller.ts` 消除深层嵌套闭包。
  - **验收**：三模块 `subtreeCC` 达标，`test:data-execution` + `test:engine` 全绿。
- [ ] **`W3-4` 模块化 `validate.ts`（2,701 L）、`version.ts`（1,631 L）与 `page-conformance-vectors.ts`（2,977 L）**（负责：`hotspot-refactorer`）
  - **拆解方案**：将 `componentErrors`（`subtreeCC=152`）按组件类别拆分为独立校验器并挂载至组件注册表；`version.ts` 能力探测按领域/组件目录内聚聚合；`page-conformance-vectors.ts` 按特性模块拆文件，消灭每次加特性必撞车单文件的问题。
  - **验收**：`validate.ts` 与 `version.ts` 主入口均 < 400 行，`pnpm authoring:contracts:check` 与 `test:page` 全绿。
- [ ] **`W3-5` `ComponentRenderer.svelte` 声明式穷尽派发**（负责：`hotspot-refactorer`）
  - **拆解方案**：用类型受控的 `Record<Component['type'], ...>` 派发映射替换 `ComponentRenderer.svelte` 的手写 `{:else if}` 链与 `widget-host-state.ts` 分支，确保新增组件若漏接编译期直接报错。
  - **验收**：`pnpm check` + Embed 分包体积门禁（`check:dist`）全绿。
- [ ] **`W3-6` 治理 `Table.svelte`（1,967 L）与 `MetricCard.svelte`（957 L）**（负责：`hotspot-refactorer`）
  - **拆解方案**：剥离 `Table.svelte` 1,078 行多变体 CSS 与 `MetricCard.svelte` 724 行 7 变体 CSS 为模块化样式文件，隔离交互状态逻辑，严守 Embed Shadow DOM 样式打包约束（`emitCss: false`）。
  - **验收**：`pnpm --filter @metriccanvas/embed check:dist` + 表格/指标卡视觉与浏览器测试全绿。
- [ ] **`W3-7` 退役 `page_validation.py`（2,910 L）双份校验与关键字嗅探桥**（负责：`hotspot-refactorer`）
  - **前提**：已锁定决策 D2（预设 Node 22+）。
  - **拆解方案**：移除 `page_validation.py` 中手工重写的全部协议语义校验及 `_uses_product_bridge` 嗅探；统一通过常驻/标准化 Node 桥接调用 `@metriccanvas/page`；将 Node 进程/版本不可用报错显式区分为环境错误（非 `SCHEMA_ERROR`）；更新 `check-authoring-validation-parity.py`。
  - **验收**：`pnpm authoring:test`、`pnpm skills:check`、`pnpm mc:content:check` 全绿。

---

### Wave 4｜AI-Native 能力闭环与维护态交接（目标：AI 写得准、改得稳、自愈快）

- [ ] **`W4-1` 产出双视图 Schema（`compat` vs 纯净规范态 `authoring`）**（负责：`mirror-delivery-engineer`）
  - **范围**：`packages/page/src/schema/`、`tools/scripts/export-authoring-contracts.ts`。
  - **动作**：从同一 Zod 真源同时生成运行期兼容 Schema 与面向 AI/文档的纯净 `authoring` Schema（剥离 `deprecated: true` 字段与 135+ 历史版本号，仅暴露最新规范版本），减少 LLM 幻觉与旧写法回流。
  - **验收**：`pnpm authoring:contracts:check` 与 `local-authoring` 全套消费场景测试全绿。
- [ ] **`W4-2` 增强校验器机器可读自愈诊断**（负责：`hotspot-refactorer`）
  - **范围**：`packages/page/src/errors.ts`、`packages/page/src/validate.ts`、结构化联合分支错误收窄。
  - **动作**：为 `TypedError` 扩展可选结构化诊断字段（`code`、`expected`、`allowedValues`、`hint`）；为 `component`、`filterDeclaration`、`pageParam`、`fieldBinding` 补齐类 `dataSourceStructureErrors` 的分支报错收窄，消除 `anyOf/oneOf` 报错噪音。
  - **验收**：校验器诊断单测 + `repair-page-metadata` / `local-authoring` 测试全绿。
- [ ] **`W4-3` 沉淀维护者 Golden Templates 与术语/版本漂移巡检**（负责：`repo-docs-curator` + `guardrail-engineer`）
  - **范围**：`docs/agents/`、`tools/scripts/`、`ci.yml`。
  - **动作**：提供“新增组件 / 新增协议属性 / 新增筛选能力”的最小标准范例与检查清单；新增自动化巡检脚本检测 `CONTEXT.md` `_Avoid_` 禁用术语与文档版本号漂移并接入 CI。
  - **验收**：新巡检脚本在当前仓库零告警通过。
- [ ] **`W4-4` 阶段 4 量化复测、债务台账收口与维护态交接**（负责：`verifier-auditor` + `coordinator`）
  - **动作**：按 §2 基线表逐项重测并回填“Wave 4 复测”列；确认所有关键门禁全绿、历史 `complexity-debt.json` 大幅清零；总结固化维护期守则并将本计划收口归档。

---

## 6. 执行与交付台账

| 日期 | 任务 ID | 执行 Agent | 提交 SHA / PR | 验收摘要（测试 / 复杂度 / 架构 / CI） | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-27 | 立项 | `coordinator` + 5 路只读探查 | 基线 `8ce2dd52` | 完成阶段 0 量化基线采集、4 项架构决策拍板、主计划落盘 | 已立项 |
| 2026-11-28 | `W0-1`~`W0-5` | 3 路 `guardrail-engineer` + `verifier-auditor` + `delivery-runner` | PR #199 (`560b1d968`) | 远端 CI 8/8 全绿（含 Biome、`hygiene:check`、`packages:check`、Python `radon` + `subtreeCC`/`fileSize` 棘轮），已合入 `main` 并清理旧分支 | 已合入 `main` |
| 2026-11-28 | `W1-1`~`W1-4` | 3 路 `repo-docs-curator`（2×`flash` + 1×`inherit`） | PR #200 (`5e41ea766`) | 清理 36 个误提交/临时文件、归档 22 份计划、`PAGE-METADATA.md` -78.7%、新增 `ARCHITECTURE.md`，远端 CI 8/8 全绿，已合入 `main` | 已合入 `main` |
| 2026-11-28 | `W2-1` + `W2-5` | 4 路 `boundary-architect`（3×`inherit` + 1×`flash`）+ `verifier-auditor`（`flash`） | 分支 `refactor/wave2a-architecture-boundary` | `architecture:check` 21→0 锁死、13 个转发空壳与 3 组原型/夹具迁出、`debug-warnings` 解耦 Vite、顺带平铺 `session.ts`（`subtreeCC` 266→16）、清除 `Table`/`MetricCard` 硬编码并抽离 `ioc-region-policy.ts`，待独立验真与 PR 交付 | 本地完成（待验真/PR） |
