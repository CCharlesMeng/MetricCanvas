# MetricCanvas UI 与页面管理：新会话 Handoff

> 后续交互更新：按本会话用户要求，详情与编辑已合并为工作台的页面设置；目录操作改为文字入口，次要操作改为统一图标／文字。原详情 URL 保留兼容跳转。当前规则见页面管理交互设计顶部的后续修订。该增量不使用 sdd-dev-frontend；早先验收记录仍对应当时的代码指纹。

> 2026-10-12 实施更新：本会话已连续推进 W0–W6 前端实现，W7 保留真实提供方门禁。实现状态和验收缺口见 [实施计划](2026-10-12-platform-ui-management-implementation.md)。原前置过程文件完整保存在 `stash@{0}`（说明：codex: preserve 43 pre-platform-ui process files 2026-10-12）；不得整份 pop 覆盖当前实施。截至该实施记录时尚未提交、推送或部署。

> 2026-10-13 交付更新：用户已要求提交本批改动并合入 main；提交、远端同步和 CI 结果以本次交付回执为准。生产部署尚未执行。

日期：2026-10-12。项目根：`/Users/moon/Documents/Code/公司项目/DataDashboard`。

目标：继续实施独立的 MetricCanvas UI 和已确认的页面管理交互，按 TinyVue OS Theme 还原对应组件，保持工程统一，并保留引擎内容区的现行视觉。

生成 handoff 时交付仅包含交互设计、原型、架构决策和实施计划，`packages/ui` 尚不存在。此句描述交接时快照；本次实施已经推进 W0–W6，当前状态以顶部更新和实施计划为准。

## 1. 新会话先做什么

1. 读取仓库 `AGENTS.md` 与 `CONTEXT.md`，再按下节顺序读取三份设计/实施文档。完成条件：明确已确认范围、三类关键页面与五轮迭代，不重问 Q1–Q21。
2. 重新核对 Git HEAD、status 和目标文件，区分本任务文档与并行工作。完成条件：得到当前起点和拟修改文件范围，保留已有改动；下文 Git 信息只是交接快照。
3. 对照实施计划 C01–C15 核对本轮涉及的源码事实。完成条件：新增 UI 包的构建/版本入口、日期依赖、工作台保存与恢复机制的当前位置已确认，漂移记录明确。
4. 推进 W0：按仓库 SDD 冻结 UI 组件与平台页面的视觉来源/必要状态，形成分别可实施的规格；输出 Java 配合清单，使提供方可并行推进。完成条件：视觉真源、状态与布局规格可追溯，原型交互和真实服务能力分开。
5. 推进 W1：建立 UI 包骨架、统一构建/公开面/独立消费/CI门禁。完成条件按实施计划 W1；视觉实现使用已冻结的基线。采用的 SDD流程需要基线确认时，提交具体可审阅的工件，不重新询问架构选择。

本会话用户要求在新会话继续推进。开始实施的具体指令以新会话用户消息为准；本 handoff 不代表 Git 推送、发布、部署或修改外部服务的授权。

## 2. 阅读顺序与真源

| 顺序 | 文档 | 用途 |
| --- | --- | --- |
| 1 | [页面管理交互设计](2026-10-12-platform-page-management-design.md) | 功能规则、导航、预览、编辑、复制、发布、恢复和删除旅程 |
| 2 | [UI 架构与风格方案](2026-10-12-platform-os-theme-component-architecture.md) | UI 包职责、引擎复用层次、视觉所有权与依赖方向 |
| 3 | [具体实施计划](2026-10-12-platform-ui-management-implementation.md) | C01–C15 冲突、W0–W7 文件职责/退出条件、AT01–AT12、五轮排期与包变更矩阵 |
| 按需 | [交互原型](../evidence/platform-page-management-interaction-2026-10-12/page-management-interaction-prototype.html)及[保存记录](../evidence/platform-page-management-interaction-2026-10-12/README.md) | 独立 HTML，示例状态验证旅程；旧外观不作为新视觉基线 |
| 架构核对 | [ADR 索引](../adr/README.md) → [包边界主题](../adr/topics/domain-modeling-and-package-boundaries.md)、[生命周期主题](../adr/topics/page-lifecycle-and-publish-governance.md) | 先读现行结论；必要时展开 ADR-0066、0071、0080、0093、0094 |

视觉真源：[TinyVue OS Theme Grid](https://opentiny.design/tiny-vue/zh-CN/os-theme/components/grid)及实际使用控件的同主题页面。原会话观察到官网部署资源为 `tiny-vue-web-doc/3.32.0`；正式冻结时重新确认页面和资产摘要，不能仅凭 URL 推导 npm 主题包，也不混用其他主题。

日期迁移时读 `docs/archive/report-date-ui-2026-10/report-date-picker-tiny-os/` 的验收与证据、`docs/evidence/report-date-picker-tiny-os-2026-10-11/` 的官方来源。已有日期证据是迁移回归依据，不证明新 UI 包或新控件已经验收。

三份主文档分别拥有交互、架构与工程计划；后续更新对应真源，handoff 只更新起点/进展，不复制一套新规格。交互文档里的早期视觉描述以新 OS Theme 规格为准，交互规则保持。

## 3. 已确认决策，直接沿用

| 范围 | 用户确认 |
| --- | --- |
| 管理对象与组织 | 个人存量页面；平铺目录，搜索/状态/排序；首期无批量操作 |
| 资产语义 | 草稿与发布分离；发布为人工确认精确修订；历史先预览，恢复追加新草稿；整体永久删除，已发布页面要求输入名称确认 |
| 名称与复制 | 移除独立重命名，工作台编辑页面标题；保留复制，产生独立草稿，不复制历史/发布状态 |
| 页面结构 | 页面管理、页面详情、页面搭建工作台；预览是同页阅读模式，含进入编辑入口 |
| 编辑与返回 | 列表编辑直接开工作台；侧栏创作恢复当前任务；新建是明确动作；保存留在工作台；一步返回管理并恢复目录条件/位置 |
| 预览进入编辑 | 草稿/发布预览打开当前草稿；历史入口明确为“编辑当前草稿”；工作台预览恢复原工作副本，包括未保存的新页面 |
| Q14 A | 保持 Svelte，实现同主题组件 1:1 还原 |
| Q15 A | 本轮演进平台工具面；预览中的报告、图表、页面表格等引擎内容保持现行视觉 |
| Q16 B | 新增独立 **MetricCanvas UI**，包名 `@metriccanvas/ui`，目录 `packages/ui`；不采用 engine/controls 方案 |
| Q17 | UI 独立版本/消费/发布，工程仍统一：同仓、pnpm workspace、锁文件、工具链和 CI；原四产品包继续锁步，产品精确引用已验收 UI |
| Q18 A | 人工修改本地持续保护，明确保存才写远端；AI 保留工具单次提交，人工脏稿进入 AI 前先保存或取消 |
| Q19 A | 先交 UI、视觉与服务真实支持的旅程；缺能力明确未开放，随后补齐 |
| Q20 A | 同浏览器、同身份/workspace/服务目标刷新或重进恢复当前任务和各页未保存副本；不做跨设备同步 |
| Q21 A | 首期当前稳定 Chrome/Edge，记录实际验证版本；真实门户环境单独验收 |

UI 只消费中性值、选项、行列、展示属性与事件。引擎和平台向下使用 UI，UI 不反向依赖 engine/page/DQE/ECharts 或页面资产。页面协议属性类型留在 page；普通引擎 Table 不在本轮整体替换成管理 Grid。

## 4. 五轮实施与包范围

| 迭代 | 工作包 | 主要源码包 | 交付与初步估算 |
| --- | --- | --- | --- |
| I1 | W0/W1 | 新 packages/ui；仓库工程工具 | 视觉基线、UI骨架、公开面与消费/CI；2–3 工作日 |
| I2 | W2/W3 | packages/ui、packages/engine | 日期提取、管理组件和还原验收；4–6 工作日 |
| I3 | W4/W5 | apps/platform | 保存/恢复、实例工作会话、导航与阅读；4–6 工作日 |
| I4 | W6 | apps/platform；UI按实际适配需要修正 | 管理增量版本与集成回归；3–4 工作日 |
| I5 | W7 | apps/platform；Java由外部提供方修改 | 完整资产能力与真实服务验收；就绪后2–4 工作日 |

排期按一名主开发持续投入且包含针对性测试/集中浏览器验收估算：前四轮13–19工作日，MC侧全部15–23工作日；不是 agent 已测耗时或固定日期承诺。Java建设/等待不包含在内；I1结束后校准区间。完整完成时点取“前四轮完成与Java就绪较晚者 + I5”。

`tools/package-build`、根脚本/锁文件、公开面快照和 CI 在 I1调整。I2更新页面试验场日期测试并回归 embed/搭建画布。engine 正式发版时 page/metric-canvas/embed 同版联动，必要契约摘要按导出链生成；不是本任务业务重构。Python 创作算法、Relay协议、私有部署 Adapter 不属于本轮业务改动。

## 5. 实施前必须留意的冲突

完整证据和源码位置见实施计划 C01–C15，这里保留会改变推进方式的事项：

- **包与版本**：四包同版检查、库构建名单和仓外安装名单都要适配 UI；公开包集合与版本分组分开。UI独立消费不免除产品组合验收。
- **日期不是简单搬文件**：现 DatePicker 类型及 helper 依赖 page/internal。UI拥有中性日期值/日历逻辑，领域适配器保留页面校验，用共用向量证明一致；原根样式与浮层保留。
- **工作会话与保存**：当前路由 key 销毁工作台，人工编辑自动 sync.enqueue；目标要求实例工作会话、本地保护和明确远端提交分离。旧语言租约、撤销、pending/unknown保护以及单次发送要保留。
- **存储**：旧记录仅按身份/workspace/页面/资源分范围，session还绑定服务目标。新版本补齐作用域，旧 frozen command、sending/unknown保留，来源歧义不重放。
- **真实服务缺口**：当前目录只有状态分页；Java单资源状态更新不保证发布隔离；历史仅摘要，rollback不保证追加，DELETE 204不证明所有引用失效。W6只开放真实可支持旅程，W7等待提供方保证。
- **视觉与兼容**：平台 CSS 不覆盖 RuntimeView；embed样式进入ShadowRoot，浮层不默认搬到body。首期浏览器按已确认范围。现有 README 的兼容性 CI 描述与流水线不一致，实施时补齐实际矩阵。
- **既有标题/URL**：保留旧深链与resource身份；标题可能是TextValue引用，展示fallback不自动回写、解析文字不覆盖绑定。

Java服务由外部拥有；MC侧列消费保证、接口缺口和验收向量，不自行设计数据库或虚构接口。旧资产向双引用模型的迁移及旧客户端写入阻止策略必须具有提供方依据。契约待落实不阻止UI/已支持旅程先推进。

## 6. 工作区交接快照与并行修改

生成时本地分支 `main`，HEAD `e02cfb415a3d536428ce08b4404e32dc5c6c41a3`。远端一致性/CI未在本次handoff验证；该HEAD不是“UI已经实现”的证明。实施计划有未提交修改，三份主文档与原型实际存在。

当前并行修改集中在 engine 的 compute、图表/指标卡/Table呈现、EChart、轴格式，以及 page 的组件Schema/compute/validate/version、explicit-presentation相关新增文件，另有embed导航和参数测试。尤其 `packages/engine/widgets/src/components/table/Table.svelte` 已有其他任务修改；保留当前内容再核对任何抽取建议。

新会话重新执行 git status/diff，记录当前真实范围；不要将并行“显式呈现协议”变更当作本任务需要修改Page Schema的理由。source-tree兼容验证要明确所测树，不能跑旧HEAD后声称未提交工作区通过。

如后续交付需要暂存，只暂存本任务精确文件；保留其他修改与恢复记录。提交/推送/部署由用户另行要求。已有工件先核验再更新，不重复生成另一份原型或另一套组件。

## 7. SDD、验证与完成报告

仓库规定：对外部设计源还原视觉走 SDD；纯保存逻辑/重构按功能与兼容证据验证。UI组件库与platform应用分开Story，工程工具共用。

当前 `.agents/skills/` 实际只发现 repair-page-metadata，SDD软链接未在该位置出现。已定位维护方 skill：

- `/Users/moon/Documents/Code/moon-skills/skills/sdd-dev-frontend/SKILL.md`
- `/Users/moon/Documents/Code/moon-skills/skills/sdd-task-frontend/SKILL.md`
- `/Users/moon/Documents/Code/moon-skills/skills/sdd-init-frontend/SKILL.md`

使用前核对当前路径并读取对应入口，以上游内容为准。已有 app baseline 与正式 Story任务/验收工件还没有在本轮建立；三份计划不能冒充SDD冻结/还原结果。若流程输入缺口存在，说明准确缺口并继续可独立推进的工程工作，不能宣称自动验收已完成。

证据按实施计划 AT01–AT12组织：逻辑/消费契约、组件与产品浏览器、仓外tarball消费、CI、真实Java/Relay/身份/门户、发布访问分别记录。此前原型浏览器检查只证明示例交互；新UI组件、服务隔离/历史/删除与真实门户均未验收。

每轮结束报告：

1. 对应I/W与实际完成范围，新增或修改哪些包。
2. 完成的验收编号、对应证据和仍未验证/依赖外部的项。
3. 原交互、引擎视觉、单次写入与旧记录保护是否保持。
4. 当前起点/验证树；若有授权交付，再报告commit、remote与CI，单列部署。
5. 下一轮唯一入口；若出现新架构冲突，当场给出事实、选项和推荐进行grill，已确认选择直接沿用。

## 8. 可直接粘贴到新会话

> 请在 `/Users/moon/Documents/Code/公司项目/DataDashboard` 接续 MetricCanvas UI 与页面管理工作。先完整读取 `docs/plan/2026-10-12-platform-ui-management-handoff.md`，再按其中顺序读取交互、架构和实施计划。已确认 Q14A、Q15A、Q16B，Q17为UI独立版本但工程统一，Q18–Q21均A；这些不重复grill。先核对当前工作区并保留并行修改，从第一迭代 W0/W1 开始推进。视觉按指定 TinyVue OS Theme 冻结并1:1还原，UI和platform分开Story，统一工程；原型只作交互依据。新实质架构冲突向我grill，Java缺能力明确列出但不阻止UI和已支持旅程推进。按迭代报告实际证据，不自动提交、推送或部署。
