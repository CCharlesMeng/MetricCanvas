# Relay 四项交付实施任务与状态

更新：2026-11-03。契约真源：[Spec](relay-reference-spec.md)，整体依赖：[实施规划](four-artifact-delivery-plan.md)。本文持续更新当前任务，不用设计完成替代产品/接入完成。

## 1. 本轮推进结果与来源

- Spec 已落盘：固定布局/入口、Interface、资源 ID、清单规范、保守兼容判据、采用回退和 A01–A10 验收。
- [ADR-0129](../../adr/0129-four-artifact-product-tools-and-relay-execution.md)记录已确认的职责调整及稳定交付取舍，旧 ADR/主题/索引同步。
- 首批发行检查器在已有隔离工作树实现：`tools/relay-reference/{release.py,compatibility.py,cli.py,test_release.py,README.md}`，不是产品 facade。
- 测试使用明确的结构夹具，只证明清单/兼容预检查；实际 compose/edit、四项导出和 Relay 自动切换仍未完成。

本次 fetch 后 `origin/main` 为 `7ccb3431693398d6347a02abbe07798943e8dbbb`；主目录和已附加首批工作树仍基于 `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`。远端当前 Schema 为 6.82，且 ADR-0128 已由表格默认筛选占用；本任务使用 ADR-0129，不搬入其他批次。其间产品/契约/生成链有演进，不能用 11 月 2 日 Schema 6.80 作为新正式发行基线。发行检查器是独立标准库工具，不读取这些产品源码；后续 S04/S05 前必须逐项对账当前主线并定向重放 I08a/I05a，重新生成，禁止整体复制脏文件或旧生成包。

源码工作树：`/Users/moon/.codex/worktrees/relay-product-first-batch/DataDashboard`。主目录的规划/spec/ADR 与工作树的代码均未提交，Git 交付/CI/部署尚未执行。后续交接必须携带明确文档与代码 allowlist，不能只新建工作树就假定这些文件已存在。

## 2. 可执行任务表

| 编号 | 责任/依赖 | 具体文件或结果 | 退出条件 | 当前状态 |
|---|---|---|---|---|
| S01 | MC；用户决策已确认 | Spec、ADR-0129、主题/索引、基线差异 | 责任不混淆，旧证据保留，新实现状态可追踪 | 文档与来源盘点完成；正式产品集成基线待 S04 前刷新 |
| S02 | MC；S01 | Spec 第 2–6 节稳定元数据/入口契约；逐操作能力覆盖表 | 对外面可由机器比较；compose/edit 等真实操作 Schema 从真源冻结 | 元数据面已定义并由检查器消费；产品覆盖矩阵和操作体未冻结 |
| S03 | MC；S01、S02 元数据部分 | `tools/relay-reference/`：seal/verify/compare + 冻结旧消费者夹具 | A01/A04、清单部分 A03、离线无副作用通过；不得宣称自动部署 | 首批实现与定向回归通过，见下方证据；尚未接入四项导出和 CI |
| S04a | MC；最新主线对账、I05a 重放 | 纯扫描/范围、读取投影和报告关联 | 无仓库路径/网络依赖，有序诊断和输入不变 | A 线已启动；11 月 2 日扫描/范围已有实现，新基线集成及报告关联待验 |
| S04b | MC；S02 产品覆盖表 | 校验/升级/参数的显式输入入口与 Node 程序 | 去掉 Bundle 根/tsx 假设，仓外同源执行 | A 线已启动，未完成产品验收 |
| S04c | MC；S02、相关呈现正确性 | query/results 中查询派生、结果映射/归一化、通用 scope/版本规则 | 不触发 metadata/DQE/store 回调；证据缺失明确返回 | B 线已启动，未完成核心验收 |
| S04d | MC；相关 S04a–c | compose/edit、纯状态前置/回执核对规则 | 显式完整输入，核心不保存，旧受控操作/错误语义保持 | B 线已启动；不是复制现有 platform_authoring 即可完成 |
| S05 | MC；S03、S04 的首版支持面 | 四项导出器、实际 `mc-tool/cli.py`、两份指南、预构建 Node、资源/导入闭包 | A02–A07/A10；清洁仓外全部承诺入口运行，双次导出一致 | C 线已启动，可先做只读/校验最小闭包探针；探针不等于完整首版 |
| S06a | Relay；S02 可准备，联调依赖 S05 | 真实 MCP/授权/查询/存储/CAS/保存交接包装 | 默认/显式入口唯一注册与可信供给；旧工具名迁移去向明确 | 待实际 Relay 代码接入；本仓不编造替身关闭 |
| S06b | Relay + MC；S06a/S05 | 暂存检查、固定冒烟、整批切换/缓存、回退及采用回执 | A08/A09 在实际包装 + 本地 HTTP fixture 验证 | 待实施；检查器通过不等于可自动采用 |
| S06c | Relay 接入；S06b | 真实身份/Java/DQE/前端工作副本和精确产物；在线旧代码接收清单 | 真实采用证据、单发送者/unknown 守恒；按 allowlist 退役旧实现 | 未验；不阻塞 S04/S05 的独立工作 |
| S07 | MC + Relay；按原 I05–I08 分项 | Tokens/最终呈现、报告关联、保留意图换源、多槽、两策略接续和减负 | 每批产品/页面/文档/local 同源及相关接入验收 | 未完成部分继续；不作为首版四项打包的总前置 |

## 3. 接下来按此顺序执行

1. 刷新并冻结隔离集成基线，对比最新产品演进，定向复用 I08a/I05a；重建能力矩阵，不复制旧快照掩盖漂移。
2. S04a/b 与 S05 最小闭包：扫描/读取、校验/升级、参数；真正预构建 Node，打开 Bundle 及 Python 导入链，尽早做仓外探针。
3. S04c/d：结果处理、compose/edit、状态/回执纯规则；保持单一产品真源，Relay 取得材料后供给显式数据。
4. S05 全部首版承诺能力导出、稳定 facade、两指南、双次生成和仓外验收，接上 S03 检查器；新旧真实发行纳入固定兼容回放。
5. Relay 按 spec 接真实包装和更新程序，执行本地联调及真实采用，才关闭 S06 和退役项。

共享源码和生成文件集成串行；每个代码批先测改动职责、后测全部新函数/辅助函数，新增自身 CC ≤15；产品行为批另做页面/文档/local 同步。无关仓库变更、其他工作树和现有内部 Adapter 保留。

## 4. 当前证据与限制

首批证据路径：`/Users/moon/.codex/worktrees/relay-product-first-batch/DataDashboard/docs/evidence/2026-11-03-relay-release-contract/README.md`。包含最终测试日志、复杂度逐函数结果和来源/范围记录；不是生产四项发行。

S03 的 A01/A04 是开发检查器层验收，A03 仅完成清单生成部分；A02/A05–A10 仍需实际产品/Relay 证据。当前未生成可交付 compose/edit 的四项包，也未做真实 MCP/Java/DQE、真实模型、远端 CI 或部署验收。此处检查器和文档不改变页面运行行为，不增加 Schema 字段，不更新安装 Skill；进入相关产品能力批后按仓库要求验收。

## 5. 并行实施会话

用户已授权创建新会话及会话间通信，已启动 A（S04a/b）、B（S04c/d）、C（S05/S03 接线）三条实施线。[任务拆分与协调表](relay-reference-parallel-tasks.md)记录真实会话 ID、通信授权出处、文件所有权、依赖和集成关口；当前会话负责契约及引擎更新后的统一集成。启动不等于完成，任务表的能力状态须随实际代码/测试回执更新。

## 6. 首轮联调进展（提供方回执，尚非主控集成验收）

- A 报告 I05a 8 个扫描/范围向量及五操作仓外禁网切片已有通过证据，公开 scan 已移除可替换 Schema，由同批静态产品规则供给；正在补齐切片回归/复杂度。
- B 报告 query/compose/edit 显式输入核心和旧 Platform V2 37 项回归、I08a 呈现 13 项通过；纯状态/回执规则继续提取。assets/lifecycle.py 仅允许同源纯规则委托的最小接线，不改变在线保存语义。
- C 报告真实四项候选已跑通首个仓外 content/A/B 基础 self-test；候选仍在补冻结消费者、缺依赖、双次导出和回退证据。基础探针不关闭 S05 或真实 Relay 验收。
- 已澄清 operation 的 inputSchema/outputSchema 只对应 input/成功或部分成功的 data，外层信封由 C 统一；业务 error 不强套成功数据 Schema。
- 新发现时间确定性关口：日期边界隐式读取当前时间。方向已定为显式评估时间＋业务时区，A 先给最小透传链与文件范围，B 核对自身隐藏时钟，C 保留未验支持面；首版正式验收前需关闭，不全局替换 Date/TZ，不新增 PageDocument 字段。

### A2：显式时间与业务时区（已分配，未完成）

主控已批准 A 先按支持矩阵交付非时间切片，缺上下文的时间敏感请求明确拒绝；该阶段不关闭完整确定性验收。A 随后在独立工作树继续实现 TemporalEvaluation（instant、IANA timeZone）的最小透传链，包括 parse/invariant/filter、resolve/materialize/extract/apply、upgrade/normalize；确切源码 allowlist 和基线由 A 报告。保留旧渲染缺省行为，不全局替换 Date/TZ，不新增 PageDocument 字段。

A2 须验证至少两种不同进程 TZ 下同一评估上下文的跨日/月/年、未来边界、参数与升级/inspect结果和有序诊断一致，并覆盖缺/非法上下文及复杂度。C 同步公开错误/上下文契约，正式首版前关闭此关口；B 核对自身日期依赖，避免重复改 A 的时间链。

A2 最小 allowlist 已由主控批准（约12源码文件）：temporal-evaluation、filter/time-filter-boundary、validate/normalize/invariant、resolve/materialize/extract/apply 参数、parameter-program、upgrade、authoring inspect/product/contract 及必要 Python 资源描述；A 继续在其隔离工作树推进。非时间旧请求不新增必填，旧渲染缺省保持；外层回执明确区分缺/非法评估上下文。

B 后续提供方回执为扩大回归 192 项中 189 通过、3 项在原 485 基线同样失败（两项 time granularity 旧错误期望、一项旧 presentation 操作 Schema），原日志保留，不算全绿。A 的旧 Python 校验全集亦发现基线失败，正在逐项分型；其局部 TS/显式资源/参数通过不能替代全集。以上仍为各线回执，主控统一集成验收未执行。

C 后续报告分发测试 31 项通过（19 继承＋12 真实四项），repair 的实际 tsc/vitest 与16项测试通过；pnpm 包装被工具链自动安装/TTY检查拦住，因此仅记录直接等效命令，不声称 pnpm包装或CI通过。页面/工作稿/回执正在注入 A 的实际 Node 路径、摘要和默认Schema；共享 evaluation Schema 由 A 单一维护，C 构建时生成 A/B 契约内联副本，外层信封不变。这些仍为提供方回执，未替代主控集成验收。

B 已报告阶段冻结：精确17源码/测试及摘要在其 source-manifest.json，7真实操作、10禁网向量、新增17项切片与线上委托测试通过；扩大194项中191过/3项原HEAD同样失败。主控已开始只读复核，当前不计最终集成通过。C 已移除重复全业务Schema预校验，保留作者handler的校验顺序；共享evaluation还须实际运行时生效，并覆盖所有声明它的操作。B发现的声明绑定零命中拒绝导出已纳入Spec；缺共享/未知绑定/零命中及非法上下文回执继续作为关口。

C 后续报告 evaluation-only 结构hook及5项绑定构建门禁通过；完整语义覆盖尚需 A 的同源私有 Node checker（已批准，不增加公开工具）。C 已在实际源码摘要不符时拒绝混拷，等待 A outputSchema/checker/共享Schema 的完整更新快照。B 的 page.edit/receipt.check 共4个 null/空上下文仓外负例被 node-bundle 缺 evaluation-schema.json 明确拦住，尚未运行；不得补假文件绕过，须真实 A2 bundle 重建后定向复验。
