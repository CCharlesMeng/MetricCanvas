# DeepSeek 本地 Skill 行为首轮证据（2026-09-15）

本文是当时的评测记录；脚本与结果已归档到 `metriccanvas-authoring/test-harness/model-evals/history/`，不代表当前创作协议或运行器的验收状态。

## 交付与结论

- 任务：`01a0a2c4-be2b-7361-8d6d-b42022abc912`；分支 `codex/deepseek-platform-eval`；工作树 `/Users/moon/.codex/worktrees/91c4/DataDashboard`。
- 交接基线 `39b587481a0e9ff3f97aa9b7ce8d2b49126d0a48`；产品基线 `7f998ba8407fd0b988bb6252c05a30b5c80b7c08`。启动时干净、HEAD准确，无需fetch，原工作区未改。
- 作者提交 `9f44c0e` 提供运行器、评分与证据检查脚本；本报告所在后续证据提交是可消费基线。精确证据SHA由提交后回执给S0，避免在提交内自引用。
- **14例首轮：本地行为6 pass、3 fail、5 blocked；13例实际调用模型，普通问数1例未调用。** 三例校准复用，同一用例未重跑，没有将失败覆盖成成功。所有14例的真实 Skill 路由子断言均 blocked，因此这不是完整 Relay 验收通过率。
- 8份合法内容产物：7次编辑、1次静态创建。四个数据创建例无产物，原因是实际发现工具返回 `DATA_CONTEXT_CONFIG_ERROR`，不是已证明的模型创建失败。

## 模型与执行条件

非敏感配置来源：原工作区 `/Users/moon/Documents/Code/公司项目/DataDashboard/apps/platform/.env`。仅从中读取既有 DeepSeek配置；未更改文件、模型或端点。

| 项目 | 实际记录 |
|---|---|
| 请求模型 | `deepseek-v4-flash` |
| 每次响应模型 | `deepseek-flash` |
| 端点 | `https://api.deepseek.com/chat/completions` |
| 官方非生成元数据 | GET `/models` 返回 `deepseek-flash` 与 `deepseek-v4-pro` |
| 固定版本 | **未验证**；元数据未给出 flash/v4别名映射或固定版本标识 |
| 参数 | temperature=0，max_tokens=4096，thinking.type=disabled |
| 实际运行环境 | 原项目既有Python环境，FastMCP 3.4.7；Python版本及文件SHA见provenance |
| 模型路由 | 按case.expected手动分配Skill，无真实Relay |
| 内容工具 | 当前公开基线的生产 `metriccanvas_authoring.content_server`，真实stdio调用 |
| 外部边界 | 可信基线为本地合成夹具；Data Context/DQE未配置；无Java持久化、盘古或Relay联调 |

公共Skill主文、共同约定和两种布局参考进入模型上下文，完整页面不进入。受控工具请求Schema来自实际 `list_tools`。模型输出由DeepSeek生成，执行任务的Codex只搭建运行器与审阅证据。第一次网络执行被自动审批拒绝；核实 GitHub 仓库为 PUBLIC、payload源于已合并公开文件和合成夹具后，原命令重新审批放行。被拒尝试无API消耗。

## 逐例结果

下表为本地非路由断言及Skill工具范围。完整 expected 逐项状态、实际参数、答复、token和产物hash见 `metriccanvas-authoring/test-harness/model-evals/history/first-round.results.json`。

| 用例 | 本地状态 | 实际证据 |
|---|---|---|
| create-report（校准复用） | blocked | 两次发现配置错误；明确report，未编造数据或冒称创建 |
| create-dashboard | blocked | 两次发现配置错误；明确dashboard，无创建产物 |
| create-user-choice | blocked | 用户指定dashboard优先的语义断言pass；发现配置错误，产物layout未验证 |
| create-ambiguous | blocked | 首轮询问用途且无工具调用，澄清断言pass；回答后采用report，发现配置错误 |
| edit-report（校准复用） | pass | 仅 `/sections/0/components/2/props/title` 改为地域明细 |
| edit-dashboard | pass | 仅 `/sections/0/components/1/props/title` 改为经营趋势 |
| existing-add | fail | add_text成功，原文档完整保持；此前误调数据发现，越出修改Skill工具范围 |
| missing-baseline（校准复用） | pass | 等待可信基线，零工具调用，未重建 |
| ambiguous-target | pass | 询问组件与新标题，零编辑、零产物 |
| switch-dashboard | fail | 产物仅改 `/layout`，影响说明完整；此前误调数据发现 |
| switch-report-backdrop | fail | 产物仅改 `/layout`，铺底/卡片/轨道完整保持；此前误调数据发现 |
| manual-language-multiturn | pass | header后chart，两轮新token/hash精确衔接，230列宽保持 |
| explicit-new-from-existing | pass | 新ID来自程序，创建明确dashboard静态页，原基线不变；数据能力缺失明确披露 |
| ordinary-ask | blocked | 缺真实普通问数入口与Relay，未用手动Skill选择冒充隔离回归 |

创建组：1 pass / 4 blocked；修改组：5 pass / 3 fail；普通问数组：1 blocked。没有规定通过率阈值。若仅核对原expected的非路由项，三个fail场景的编辑断言均通过；额外的Skill工具范围断言揭示其真实行为失败，未抹掉产物成功事实。

## 失败归因与关键违规

1. **模型行为/Skill执行：3例越出allowed-tools。** 修改Skill只声明`edit_page`，但existing-add和两例布局切换将`discover_data_context`用于搜索“共同约定/布局基线”。工具实际失败后，模型自行纠正并正确编辑。未修改Skill或产品代码，交S0决定后续整改。测试程序暴露全部content工具用于观测违规，因此不能据此宣称真实Relay授权机制失效。完整部署应否强制限制工具，仍需其真实接线验收。
2. **外部环境：4例数据创建blocked。** 三例在相同配置错误后多做一次发现，create-user-choice一次即停；均为模型生成的调用，不是运行器HTTP重试。最多两次，无持续循环。没有为了提高成绩追加数据夹具或篡改首轮。
3. **运行器边界：** 未实现按需读取完整Skill参考目录；主文/公共/布局已加载。统一上下文中的`page_id`始终用于新建，已有页真实身份另在`baselineRef.pageId`。missing-baseline及explicit-new-from-existing的答复把新建ID称作已有页ID，这是上下文歧义与模型解读共同造成的限制；原页保持由完整基线和工具调用验证，不能把模型口头身份陈述当验收证据。
4. **答复质量：** 部分开场及整段回答为英文。existing-add自行撰写的文字含“数据随筛选条件联动更新”，基线摘要未提供这种行为证据；未扩大本轮expected判定，但记录为未经依据的业务说明。edit-report说“由程序执行生命周期保存”，其他多数答复明确尚未持久化；本程序只留存产物，未调用任何保存服务，不能把这些流程性措辞当保存事实。
5. **四类关键违规：** 无缺基线重建、无越过意图改整页、无完整产物/数据行经模型泄露、无明确声称已收到保存/发布成功回执。路由本身不可观测，不将“未发现错路由”记为路由通过。3例工具范围违规单列为上述fail，不混同真实外部权限越界。

## 实际消耗

| 项目 | 数值 |
|---|---:|
| 付费生成API请求 | 34 |
| 输入tokens | 551,073 |
| 输出tokens | 7,179 |
| 总tokens | 558,252 |
| 输入缓存命中 | 510,720 |
| 输入缓存未命中 | 40,353 |
| 校准（已含在合计中） | 97,472 |
| 其余首轮 | 460,780 |
| 模型请求累计耗时 | 71.120秒 |
| 各例累计耗时（含stdio） | 76.853秒 |
| 非生成GET `/models` | 1次 |
| 内容工具 | discover_data_context 11次、edit_page 7次、create_content_page 1次 |
| 金额 | 未知；API未返回费用，不按假定单价估算 |

耗时是各请求/各例实测累计，不是包含阅读、人工审阅、审批、准备工作的总任务墙钟时间。单次上下文约1.6万输入token，主要为实际工具Schema；零HTTP重试、每用户轮最多6次模型请求。两阶段均未触及上限；没有多模型或三轮重复批次。

## 验证、证据与消费

- 已核验34份实际请求/响应、8份产物和9份不可变基线；所有产物通过生产页面校验，基线与产物hash通过。
- 完整before/after差异验证了精确目标、未修改字段保持、布局切换及多轮基线更新。未以只看局部字段代替整页比较。
- `verify_evidence.py`已检查全部出站messages无完整页面、无rows对象、无夹具行canary；全部原始JSON无实际凭据。可提交结果也独立检查了凭据及行canary缺失。
- 原始目录 `/private/tmp/metriccanvas-deepseek-eval-20260915` 权限0700，JSON文件0600。完整请求/响应、程序产物、差异在其中；目录仅本机存在，不是外部持久交付。对外provenance逐文件列SHA256，供本地审计比对。没有把凭据写入日志、文件或模型上下文。
- `first-round.results.json`仅含安全上下文、工具参数/摘要、模型答复、标量状态与hash；结构差异只提交路径及值hash，不提交完整页面或数据行。
- 可消费内容仅model-evals评测目录与本报告；未改公共契约、锁、Skill正文、产品模块、coordination或GitHub票状态。作者和证据提交按顺序消费；回退仅撤销本任务提交，不影响产品基线。
- 未覆盖：数据创建的真实装配/查询执行、真实Relay注册/路由/身份/隔离、普通问数入口、Java保存/冲突/发布、盘古产物通道、固定模型版本。后续需要明确的新授权批次和相应环境，不承诺后台自动续跑。
