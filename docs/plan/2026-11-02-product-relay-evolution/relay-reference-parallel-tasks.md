# Relay 四项交付并行任务与会话协调

日期：2026-11-03。依据：[Spec](relay-reference-spec.md)、[执行台账](relay-reference-execution.md)。用户明确授权：“可以，进行任务拆分，允许你启动新会话，并让会话之间进行通信”。本轮创建三个实施会话，当前会话负责协调、契约裁决及最终集成；尚未表示各任务已完成。

## 1. 授权、会话和运行位置

主控会话：`01a19c97-0922-7963-afd9-33fa2625f39a`（local）。人类授权位于此会话 turn `01a1a115-85f2-7132-a37b-8831b688af62` 的 userMessage；接收任务的会话先通过 read_thread 核实。通信限于本表三个新会话和主控，允许主动发送接口提案、依赖需求、测试事实、阻塞与完成回执，不向其他会话或外部服务发消息。

新会话以 DataDashboard 本地项目启动；各自检查工作树和最新 main 后，使用自己附加的合适隔离工作树，缺少时通过 create_worktree 创建。不得在脏主目录或已有首批工作树里同时改运行代码。初始会话不假定自动携带主目录未提交的 spec/计划，必须按下面绝对路径读取。

| 线 | 会话 | 任务 | 会话 ID / 状态 |
|---|---|---|---|
| A | MC 只读校验与参数核心 | S04a/b，纯读取、扫描/范围、校验/升级/参数程序 | `01a1a118-3a20-7351-b0c4-1d45be448d49` / 已交付，来源已冻结 |
| B | MC 查询结果与页面变换核心 | S04c/d，查询派生、结果处理、compose/edit 及纯核对规则 | `01a1a118-3e1e-7b23-b66a-bf4e8b1fd43d` / 已交付，来源已冻结 |
| C | MC 四项分发与平滑升级 | S05 + S03 接入，导出/稳定 facade/指南/兼容回放 | `01a1a118-40d4-7c81-9d78-aca96448b0b8` / 已交付，来源已冻结 |
| 主控 | 当前会话 | 基线与引擎演进对账、共享契约裁决、串行集成、最终验收、S06 对接 | 活跃；不将静态说明当真实 Relay 验收 |

## 2. 文件所有权和退出条件

### A：只读、校验与参数核心

拥有：页面纯分析相关 TS（含 `packages/page/src/authoring/`、`local-authoring-data-*`）、必要的 Node 参数程序真源与构建入口、Python `pages/validation/` 和参数确定性准备模块、自己的定向测试和证据目录。

复用已有 I05a；对比最新产品后定向重放，不能整包复制旧工作树。提取显式页面/Schema 输入的扫描与读取范围，保留完整有序诊断和输入不变。关闭参数程序对 pnpm/tsx/仓内 cwd 的依赖，提取校验/升级的资源输入接缝；现有调用方通过同一核心保持行为。

不拥有：公共发行 facade/清单、全局导出器、生成锁/安装 Skill、B 的页面变换和结果逻辑、全局 runtime_assets.py。需要改共享资源定位时先发接口需求给 C/主控，由 C 单一实现。

退出：真实核心及可预构建程序可从仓外调用、不联网、不依赖本仓路径；提供可供 C 接入的程序 Interface/操作描述、冻结向量、调用样例与复杂度结果。产品场景/文档/local 同步需求明确；全局生成由集成阶段统一完成。

### B：查询结果与页面变换核心

拥有：Python 数据推导/映射/归一化/呈现纯规则、`pages/referenced.py`、composition/editing 相关确定性逻辑、纯状态/作用域/回执规则，以及自己的测试与证据。先给出调用图和分小批顺序，再实现一个可验证的完整切片，继续推进其余承诺能力。

compose_page 当前可执行 DQE，platform_authoring 当前会查询状态并保存，不能直接改名视为纯工具。去掉产品入口中的在线 Prepared 与可联网 resolve/current 回调，改为显式完整输入。已有线上入口在迁移期仅包装同一个核心，实际状态/CAS、Java/DQE/preview 仍待 Relay 接收；不得删除内部 Adapter 或猜造授权。

不拥有：A 的校验/参数/扫描、C 的产品 launcher/导出与全局资源定位、真实 Relay 包装、全局生成物。需要 A 的输入类型/校验能力时协商契约，不跨写 A 的实现。

退出：约定切片从真实旧调用链提取为无网络产品核心；输入不变、有序诊断、旧操作/字段/原值保持；提供 C 可接入的 Interface/操作描述、证据缺口语义和正反例。不能把没有执行/保存的候选报告为已验真/已保存。

### C：四项分发与平滑升级

拥有：`tools/relay-reference/`、新的四项导出器/稳定 facade 维护真源、两份指南作者源、必要的 `runtime_assets.py` 资源定位及 `tools/scripts/mc-content*`、projection/全局导出器接线、自己的分发/兼容测试和证据。

复用首批 19 测试的清单/兼容检查器，按 allowlist 携带；不能从结构占位 fixture 生成“生产就绪”结论。与 A/B 交换操作契约和资源需求，产品实现只委托共享核心，不重写扫描、参数、compose/edit 或查询规则。可以先完成真实只读/校验最小闭包探针，但完整首版必须覆盖冻结支持矩阵。

不拥有：A/B 的核心实现、主目录引擎改动、真实 Relay 状态/保存/更新器。机器兼容检查通过仍仅能进入冒烟，不自动宣布采用。

退出：实际四项导出、固定 facade/索引、双次路径/字节一致、旧调用/资源兼容矩阵、仓外无 wheel/无仓库/禁网/预装依赖运行及回退夹具。生成物只在自身隔离候选目录输出；最终主线与引擎基线确定后由主控串行集成并重新生成。

## 3. 共享文件与引擎更新

- Spec、ADR、主计划/台账/本协调表由主控维护；子会话提出变更建议，未经协调不直接写这些共享文件。各自在独有证据目录写事实和结果。
- `runtime_assets.py`、顶层 launcher/操作注册、全局生成器由 C 单一修改；A/B 只提出资源/调用需求。A/B 自有操作描述由各自维护，C 负责汇总导出。
- 页面 Schema、引擎和当前主目录可能继续更新。各线先按可复现来源推进；最终正式发行须采用同一明确引擎/产品提交重放回归，不能从旧生成包覆盖新产品事实。
- `contracts/`、安装 Content/Skill、锁及摘要不由三条线在主目录并行生成。子会话可在自身工作树验证候选；正式集成按来源顺序串行生成，禁止手改摘要。
- 首批旧工作树 `/Users/moon/.codex/worktrees/relay-product-first-batch/DataDashboard` 是已实现 I08a/I05a/S03 的来源，只读复用。不得重置、清理或让三条线共用它作为写目录。

## 4. 通信与完成回执

先核实人类授权，再通过 send_message_to_thread 与登记会话互通。初始 3 个会话创建完毕后主控填入真实 ID 并广播成员清单；不要猜 ID。未收到其他线的 Interface 时继续独立调用图/测试/核心工作，不空等，也不凭空声明对方已完成。

需通信的时间点：开始时报告自身工作树/来源/文件范围；跨线 Interface 准备好或需变更时；发现共享文件/引擎漂移时；完成一个可集成切片或遇到外部阻塞时。消息带任务编号、实际文件、输入输出变化、测试事实和下一依赖；不要仅发“完成/没问题”。

完成回执包含：维护真源 allowlist、实现来源 SHA/未提交状态、实际测试与失败、复杂度前后/新函数结果、导出和安装层级、未验项、给下游的具体调用/资源契约。可保留可审阅的工作树改动，不自行 push main、混入其他工作或清理他人工作树。

## 5. 集成关口

A/B 给出可接入的纯核心及契约 → C 形成真实四项候选 → 主控核对引擎更新后的基线并串行集成 → 同源生成/完整兼容回放/独立运行与相关产品浏览器验收 → Relay 真实包装/本地 fixture/自动切换 → 真实环境采用。

本轮启动三条 MC 实施线；S06 的实际 Relay 实现须在真实 Relay 代码可得后推进，不创建空会话或写生产替身假装联调完成。具体接收材料与未验项继续在主控台账维护。

## 6. 启动回执与首轮 Interface 决议

三个会话均已核实主控的人类授权并开始源码工作，独立工作树已确认：

- A：`/Users/moon/.codex/worktrees/relay-read-validation/DataDashboard`；起跑基线 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`。
- B：`/Users/moon/.codex/worktrees/relay-core-page-transform/DataDashboard`；起跑基线 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`。
- C：`/Users/moon/.codex/worktrees/relay-four-artifact-export/DataDashboard`；起跑基线 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`。

起跑基线只用于当前切片，最终发行仍须对账用户后续引擎更新。三会话均已收到真实成员名单和共享文件归属，已明确可主动互通。

A 首版候选操作 ID 为 `page.scan`、`page.project`、`page.validate`、`page.upgrade`、`page.parameters`；不是已完成支持矩阵。A 维护操作 descriptor，C 只汇总真实实现和已验收能力。全局 format/requestId/operation envelope 由 C 按 Spec 统一包装。

- upgrade 未传 target 时使用发行声明的 defaultPageSchema 或要求显式指定，不随 latest 暗中升级。
- project 优先复用既有纯投影；确需跨语言新增时说明原因并用同源向量核对。
- Schema/Node 的本机路径和摘要属于程序侧资源描述，不能由模型随意供给或替换产品规则。
- A 可写自身独立的 Node 构建模块；C 单独修改全局生成器与 mc-content-page.ts 接线。

后续接口决定以主控记录及各线真实代码/测试为准；未完成的 S04/S05/S06 不因启动或静态提案而关闭。

## 7. 联调发现与后续关口

C 的真实仓外探针发现 A/B 初版 descriptor 曾把完整信封作为 outputSchema，现已统一：inputSchema=input，outputSchema=ok/partial 的 data，错误回执核对状态及诊断、不强套成功数据 Schema；C 负责稳定信封。此为首版尚未采用前的语义澄清，不能以结构 fixture 冒充真实操作回归。

A 发现 parsePage/resolvePageParams 的时间边界会隐式读取当前时间；评估时间及业务时区须显式定义。A 先给最小调用链/文件 allowlist，并继续不依赖该关口的工作；未关闭时间敏感场景前不宣称完整显式确定性。不全局替换 Date，也不直接修改主目录的引擎。

B 可在 assets/lifecycle.py 做纯 receipt_rules 委托的最小接线，保持原在线 verify_document/保存语义；规则模块不得反向导入在线 Client/store/lifecycle 模块。C 携带 A/B 切片时记录 allowlist 与文件摘要，不能边读仍变动的源码边生成“冻结”发行。

共享时间契约已裁决：`input.evaluation` 保持固定信封，A 单一维护 EVALUATION_SCHEMA 及 ISO/IANA 语义校验；C 从 A 描述确定性生成/内联 A/B 操作契约，最终引用闭合。B 不手写重复 Schema。错误码为 EVALUATION_CONTEXT_REQUIRED、INVALID_EVALUATION_CONTEXT；path/hash/schemaVersion 由已验证发行解析，时钟由可信程序按本轮冻结，不混同用户分析期间。

## 8. 统一集成回执

主控在 `/Users/moon/.codex/worktrees/relay-reference-integration/DataDashboard` 以 `8b1e09ad62da10e86cc07f9494efd5c4a56a5d7e` 集成 A28/B17/C23，来源摘要与基线 blob 均核对；新主线的五个 pagedJoin 文件不与本批来源重叠。主控额外的 UTF-8/LF、文档/场景/生成和浏览器调整单独记录，未改写三线冻结 manifest。正式结果见[执行台账](relay-reference-execution.md)和[集成证据](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-11-03-relay-reference-integration/README.md)。三个会话均已收到集成通知；本轮不因并行交付而关闭真实 Relay 接入、CI 或部署。
