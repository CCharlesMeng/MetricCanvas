# 本地创作布局形态识别、确认与范式

初次准备日期：2026-10-19（正式实施与交付准备见文末）。改动在独立工作树 `local-authoring-layout-confirmation` 完成，基于提交 `7ec7bb85` 的 Schema 6.29；未混入主工作区并行开发的协议。没有修改页面 Schema 或运行时，未提交、推送或安装到其他环境。

## 变更与来源

原流程仅要求“确认布局形态”，没有确认完成条件；协议缺布局时默认 Report，通用示例又可包含 Report 外框。现在入口先识别并说明依据，未确认时等待；明确指定形态的当前指令本身构成确认，避免重复询问。新页面显式写 layout，生成及交付都与用户确认比对。自动识别是模型基于阅读目的、外框及交互结构的判断，不是新增运行时分类器。

保留一个本地 Skill，以已确认形态分流阅读。范式由作者解释适用目的和易错点，结构摘要由 `tools/scripts/local-authoring-patterns.ts` 读取实际页面生成，记录来源 SHA256。摘要保留外框、分区权重、组件类型／variant／span、容器嵌套与全部 Tab 子项；白名单移除业务行、查询体、字段绑定、URL及自由文本。摘要不是完整页面，不能直接交给运行时。

| 范式 | 场景真源 | 本地 Skill 产物 |
|---|---|---|
| Dashboard 地图概览 | pages/ioc-project-overview.json | references/page-patterns/dashboard-map.json |
| Dashboard 主题分析 | pages/ioc-opportunity-analysis.json | references/page-patterns/dashboard-analysis.json |
| Dashboard 筛选清单 | pages/ioc-opportunity-list.json | references/page-patterns/dashboard-list.json |
| Dashboard 对象详情 | pages/ioc-project-detail.json | references/page-patterns/dashboard-detail.json |
| Report 经营月报 | pages/business-sdt-report-monthly.json | references/page-patterns/report-monthly.json |
| Report 分析简报 | pages/flow-analysis-report.json | references/page-patterns/report-briefing.json |

六页均为既有完整页面，已在试验场注册，本批增加“创作范式”检索标签，操作与环境见 [pages 说明](../../../pages/README.md#本地创作的布局形态范式)。协议语义补充于 `PAGE-METADATA.md`、`docs/page-metadata/page.md`，随契约导出同步到参考和独立安装目录。既有页面的业务缺口不因入选范式而视为通过。

## 独立前向使用

根据 skill-creator 的 Independent Forward-Testing，用独立子代理只读取更新后的完整 Skill 和原始需求；未提供预期输出、测试评分或旧页面 JSON，产物只允许写仓外临时目录。

初始请求：“帮我做一个月度运营分析页面，销售额、订单数、地区差异放一起，能够查看重点客户。文件叫 operations.json，可以先用明确标注的演示数据。”

第一轮仅读取入口与 page-form，推荐 Dashboard，并指出“月度运营分析”也可能指 Report，返回形态确认问题。没有写页面、章节骨架或模板。

第二轮模拟用户回复：“就用 Dashboard。重点客户用表格列出客户名称、地区、销售额和订单数；先不接真实查询。”模型继续读取 Dashboard 主题分析范式，未重复提问，生成 inline 演示页面。实际检查 `layout=dashboard`，无 layoutForm，所有数据源均为 inline；首次快照、独立校验和快照完整性检查均退出 0。由原始演示输入独立重算：销售额 1,240,000 元、订单数 700、4 个地区、4 个重点客户，与页面一致。

原始记录：`/tmp/metriccanvas-layout-forward-test/forward-test-evidence.md`；原始输入、工作文件、attempt-1、命令回执与独立对账保留在同目录。最终 operations.json 的 SHA256：`6113af25250b247917b2f387953b1c9cb84c3d26d341475692b910b5b40f4eba`。本轮没有修复或覆盖失败样本。这是一个需求的两阶段本地模型行为证据，不是识别准确率评测，也不代表真实 DS 模型验收。

## 检查结果

| 检查 | 结果 |
|---|---|
| pnpm authoring:contracts | 通过，派生物由真源重建 |
| pnpm authoring:contracts:check | 通过 |
| check_bundle.py | 通过，2640 项 digest checks |
| skill-creator quick_validate.py | 通过；系统 Python 缺 yaml，改用已有 Bundle 虚拟环境后通过 |
| pnpm exec tsc --noEmit -p tests/tsconfig.json | 通过 |
| local-authoring-skill / page-reference / authoring-export-isolation | 3 文件、40/40 通过，212.28 秒 |
| 页面目录测试 | 6/6 通过；先执行 svelte-kit sync 生成工作树所需 tsconfig |
| Authoring 测试清单检查 | 60 文件，分类无漂移 |
| Authoring 全量回归 | Ran 540，539 通过、1 跳过，116.873 秒；独立工作树不含调查报告原始语义数据，跳过现有 test_actual_model_keeps_derived_configuration_unknown_units_and_conflict |
| 独立前向使用 | 未确认停止、确认后生成、显式布局及静态／数据验收通过 |

独立安装测试将完整 Skill 复制到无仓库源码的临时目录，检查目录内链接、版本、知识哈希、合法／非法文档及产品契约向量；新增断言读取六个真实范式源，核对全部嵌套组件与权重，保留 Dashboard reportHeader 反例，拒绝源页面损坏、身份或形态漂移。导出隔离测试同时覆盖新生成摘要的漂移与生成子树所有权。

## 未执行的验收

没有对任何外部设计稿进行本轮还原；没有浏览器视觉／交互验收、真实 DS 请求、真实 DQE／Relay／Java、部署或线上安装。Skill 确认是会话指令，Schema 校验通过不能证明模型已经取得用户确认。当前前向样本证明一次停止和继续流程，尚不足以衡量多设计源、多轮会话下的识别质量。


## 用户裁决后的修订（2026-10-19）

用户接受明确指令本身构成确认、确认摘要包含组织方向，以及 Skill 流程约束配确定性结果检查；要求发生实质冲突时必须显式确认，范式部分单独规划后进一步设计。

据此更新入口和 page-form：确认摘要覆盖内容分组、阅读／操作顺序、交互位置和候选范式；已有明确选择仅在无未解决冲突时继续。发现新冲突必须展示差异、适配方案并等待针对冲突的答复；指令本身已经明确解决同一冲突时不重复提问。组件名或模型偏好不作为冲突证据。

独立校验器增加可选参数 `--expected-layout dashboard|report`，比较本次用户确认与有效布局，参数不从产物反推。未传参数时沿用原校验行为；省略布局继续按 Report 解释，兼容合法历史文档。参数错误返回 2，形态不一致返回 1，并保留 SCHEMA_ERROR、/layout 与预期／实际值。该选项不读取会话，也不证明用户确认。

新增 CLI 场景核对已合法页面的匹配／错配、省略布局的默认值及非法参数。修改后定向测试与冲突行为复测结果见下方。前文全量 Authoring 回归属于上一轮快照，本轮不借用它证明新分支已覆盖。

范式独立规划见 [规划文档](../../plan/2026-10-19-local-authoring-patterns.md)；现有六类是候选草案，分类、卡片内容与视觉基线待用户进一步设计，未继续扩充候选卡。

版本记录更正：旧记录把未更新概览中的 6.28 当作作者版本；已按 packages/page/src/version.ts 与实际 references/knowledge.json 更正为 6.29。本批没有更改产品版本或 Schema。


### 冲突停止与明确答复后继续

新的独立请求明确指定 Dashboard，同时要求原样保留定宽报告封面、连续经营分析章节、封面日期工具带及整份报告下载。模型读取当前入口、page-form 和页头协议后，列出外框与工具带能力冲突，要求在保持 Report 与适配 Dashboard 间明确选择，未生成 review-board.json。

模拟用户回复“保持原样，使用 Report”后继续，未重复提问，最终文件显式 layout=report，数据源均为 inline。首次生成即通过 --expected-layout report 与快照完整性检查；独立对账为收入 1,500,000 元、成本 1,000,000 元、毛利 500,000 元、订单 900。页面注明日期变化只改变封面期间，正文保持固定演示快照。原始输入、首轮停止记录、所有尝试、命令回执及对账保留在 /tmp/metriccanvas-layout-conflict-test；视觉、日期操作及真实下载效果未验收。


### 裁决后验证结果

- 3 个定向文件全部通过，46/46 项，260.05 秒；新增 CLI 匹配、错配、默认布局与非法参数场景通过。
- TypeScript 类型检查通过；契约导出与 --check 通过；Bundle 2640 项 digest checks 通过；Skill quick_validate 通过；git diff --check 通过。
- 原有仓外 operations.json 使用 --expected-layout dashboard 通过；冲突确认后的 review-board.json 使用 --expected-layout report 通过，最终文件 SHA256 为 a41ab8af92e418eb5303138e3947cb2cf246ef7c21ca8d2fc118a540df7aa9f6。
- 规划文档的仓内相对链接存在性检查通过。范式详细设计仍待用户推进；本轮未继续扩充候选范式，未提交、推送或合入主工作区。


## 正式实施与 main 交付准备（2026-10-19）

用户授权实施并最终合入 main 后，保留已确认的流程边界与六类候选范式状态，未代用户完成后续范式详细设计。交付范围为 37 个显式路径，保留原工作区的其他文档和调查材料。

首先接入 main 的 Report 导出提交 8ff56a268a659dc026ec76b90d6bcc4353c48d5d，保持 Schema 6.31、exportButtons 及 PDF／PNG 说明；随后接入并行画布提交 8502d8c0acb4ba0ce53472fbffcaab4256dc0de1。文本保留两边意图，哈希与打包校验器从当前产品真源重新生成，不复制旧版派生文件。

- 基于 8ff56a26：通过 pnpm test 的四文件定向回归，52/52，190.85 秒；Authoring 全量 540 项运行、539 通过、1 项因缺少本地调查数据跳过，113.600 秒；类型、契约和 Bundle 检查通过。
- 最终基线 8502d8c0：受影响的独立 Skill、页面参考及页面目录再次通过 32/32，5.67 秒；类型检查、751 项产品契约导出检查及 Bundle 2718 项 digest checks 再次通过。导出隔离实现未变化，完整 20 项隔离回归沿用前一条相同实现的结果；远端 CI 仍执行完整回归。
- 独立安装行为复测：从 8ff56a26 加本批代码的 Skill 整目录复制 428 文件到 /tmp/metriccanvas-layout-main-acceptance/skill，仅消费复制版；417 项知识清单哈希通过，schemaVersion=6.31，入口 SHA256=e43ac28ca547df031d767956d1101a69bcb27eeb5894a813bbcc5b2c3911c70e。后续画布并轨只更新共享文档与分发哈希，本批形态流程和校验器实现保持一致。
- 模型使用明确 Report 输入生成 executive-monthly.json，按总览、地区、重点客户组织；使用 exportButtons 声明 PDF 2倍、单张 PNG 4倍，不写旧字段。首次快照、--expected-layout report、快照完整性和独立对账通过：收入 900,000 元、450 笔订单、6 个客户，重点子集 3 个。输入、安装清单、参考哈希和回执保留在上述仓外目录。

实际下载、视觉交互、真实 DS／DQE／Relay／Java及线上安装／部署未由本批验证。远端提交一致性与对应 CI 完整结论由交付回复报告；不能用本地通过或 push 回执替代 CI。
