# MetricCanvas 统一创作能力演进方案 — Relay 侧核对提示词与修正指导

版本：v1.0　日期：2026-11-02
用途：方案修正者拿本文件直接修订「MetricCanvas 统一创作能力与 Relay 接入演进方案（内网评审稿 v1.0）」
证据来源：本仓（CDIRelayAgentService）静态取证，无运行进程，R/T/P 层 not_run；涉 MC 产品仓事项标注「需 MC 侧确认」。

---

## 一、你的角色与目标

你是 MetricCanvas 演进方案（内网评审稿 v1.0）的修正者。Relay 侧已按第 14 节 R01–R18 对当前代码完成静态核对，本文件给出：
1. 核对结论（能定的直接定，不能定的标注证据缺口）；
2. 方案中的漏洞清单与最小改法（不改目标，只改表述、归类、批次与接线口径）；
3. 修正时所需的全部本仓上下文（代码定位、工具矩阵、版本链），不需要再回本仓重查。

修正原则：
- 不改变方案第 13 节「已确定」目标（双策略共享产品底座、Relay/公司适配独立、工具先承接再删提醒）；
- 只修正事实归类、内部数字、批次时序、接线描述与 R 系列可回填项；
- 涉及 MC 仓/部署层/真实服务的项目标注「需 MC 侧确认」，不以本仓推断冒充运行态事实；
- 修正后 R01–R18 均应有状态，所有「需调整」给具体建议与影响批次。

---

## 二、核对总结论

**方案作为「设计及兼容评审」框架成立，与当前 Relay 仓现状大体一致，兼容运行的基础存在。** 但有三类问题必须先收口，否则 R01–R18 回填会跑偏：

1. **tool_mc_query / tool_mc_compile / tool_mc_inspect 是同名双提供方（名称冲突），不是「fork 新增入口」**。MCP 注册（platform_mcp.py:371/404/431）与 Skill 包装（scripts/tools.py:110/139/174）同时定义同名函数，SKILL.md allowed-tools 第 17–19 行已列入。第 7.2 节把 6 个入口合并归类为「fork 新增」是错的，R10 无法精确回填。
2. **「9 个公共工具 / 6 个报告另列」是人为分组，与事实不符**。platform_mcp.py 同一 FastMCP 注册中 @mcp.tool 共 15 个（行 215–431）。分歧只在「是否应提升为公共默认」这一政策问题，不在「是否公共注册」这一事实问题。
3. **turn_provider 十工具集合与十五入口的差异已核实**：覆盖缺口正好 5 个——submit_ai_summary_body、list_existing_page_urls（接受 context_ref 但无注入，存在身份缺口）与 tool_mc_* ×3（不接受 context_ref，静态知识无需注入）。第 7.2 节「需核对」项可直接落定。

---

## 三、本仓已核实的关键事实（修正时的必要上下文）

### 3.1 工具注册全貌（platform_mcp.py，同一 FastMCP 注册，共 15 个）

| # | 工具名 | 行号 | 接受 context_ref | turn_provider 覆盖 |
|---|---|---|---|---|
| 1 | read_page_context | 215 | 是 | ✅ |
| 2 | discover_data_context | 221 | 是 | ✅ |
| 3 | query_data | 227 | 是 | ✅ |
| 4 | compose_page | 232 | 是 | ✅ |
| 5 | edit_page | 237 | 是 | ✅ |
| 6 | publish_page | 242 | 是 | ✅ |
| 7 | page_metadata_emit_preview | 281 | 是 | ✅ |
| 8 | extract_page_parameters | 301 | 是 | ✅ |
| 9 | apply_page_parameter_selection | 306 | 是 | ✅ |
| 10 | resolve_page_parameters | 315 | 是 | ✅ |
| 11 | list_existing_page_urls | 258 | 是 | ❌（无注入→身份缺口） |
| 12 | submit_ai_summary_body | 267 | 是 | ❌（无注入→身份缺口） |
| 13 | tool_mc_query | 371 | 否（静态知识） | ❌（无需注入） |
| 14 | tool_mc_compile | 404 | 否（静态知识） | ❌（无需注入） |
| 15 | tool_mc_inspect | 431 | 否（静态知识） | ❌（无需注入） |

- **turn_provider 集合定义**：`workspace/agents/agent_workspace/.relay/plugins/authoring_turn_provider/plugin.py:18-30`，`_METRICCANVAS_TOOLS` 恰为表中 1–10 共 10 个。
- **注入机制**：plugin.py:600-609，`args["context_ref"] = turn_id` 强注入；注释明确「模型不知道可信 contextRef 会猜」「FastMCP 拒绝未知 kwargs（TypeError）」。
- **身份缺口后果**：list_existing_page_urls / submit_ai_summary_body 被调用时 context_ref 为空串，门禁 `AuthoringTurnGate.require()`（work/authoring_turns.py:57）校验 `context_ref == binding['contextRef']` 会失败。修正方案时必须在 I02 批次明确这两个工具的身份注入或门禁豁免。

### 3.2 版本链（R01 直接答案）

| 版本号 | 所在文件 | 加载路径 | 状态 |
|---|---|---|---|
| 6.54 | contract-lock.json:8 | 运行时读取（load_bundle_info 链） | 权威，运行中 |
| 6.11 | bundle.lock.json:3 | 未被运行时读取 | stale，未清理 |
| 6.11 | contract-snapshot/manifest.json:3 | snapshot | 时间点证据 |
| 6.77 | 不在本仓 | — | MC 产品仓页面协议版本，需 MC 侧确认 |

方案第 2.1 节把 6.54/6.77/6.11 并列进「Relay 版本读取链」不准确——6.77 无法在本仓加载。修正为「本仓三源漂移（6.54 权威 / 6.11 ×2 stale）+ MC 仓 6.77 另计」。

### 3.3 状态与交接链路

- **temp_subprocess store（R06 直接答案）**：文件桥。`adapters/relay/context_identity.py`（state 文件名 `relay_authoring_state_{context_ref}.json`，context_ref==turn_id）+ `adapters/relay/file_based_turns.py`（FileBasedCurrentAuthoringTurnPort）。**不是 SQLite**。SQLite 只是未来候选 Adapter，方案 7.4「SQLite 是一种 Adapter」一句需明确「当前实际是文件桥」。
- **state 文件内容**：binding（requestId==runId==session_id、turnId==context_ref）+ documentJson + scope + env + userNo（turn_provider/plugin.py:486-580）。
- **turnId 派生（R04 部分答案）**：基于 trace_id（plugin.py:35-42 注释），同一用户请求内所有工具调用共享同一 turnId；新请求（新 trace_id）开启新轮次。取消/并发/目标切换规则需部署层探针，本仓无法静态判定。
- **preview 链路（R07/R08 部分答案）**：authoring_preview_bridge plugin（on_tool_execute_after 缓存 + on_response_final 注入，`{{RESPONSE_START}}`/`{{PAGE_METADATA_PREVIEW_JSON}}` 标记）；data-agent 风格流式替换由 nl2sql_prefetch 主导（preview_bridge/plugin.py:208,399）。structured_content 被 Core 丢弃的表述与现状一致。
- **工作副本输入（R05 部分答案）**：前端 CONFIG 携带 agent_context（user_id、user_no、workspace_id、page_metadata_id、env），turn_provider 依 page_metadata_id 决定 mode=existing/new；现有编辑轮次完整快照存在 state 文件。DialoguePageRequest 接口与方案第 7.3 节一致。

### 3.4 R16 三对象定位（直接答案）

| 对象 | 实际定位 | 依据 |
|---|---|---|
| nl2sql_prefetch | 独立 plugin 目录 `.relay/plugins/nl2sql_prefetch/plugin.py` | 真实存在 |
| unified_dsl_execute | **工具名**，非 plugin；被 nl2sql_prefetch 拦截注入（3645-3766 多处 before-hook）；guard_mode_new 白名单内工具 | guard_mode_new/plugin.py:119,165 |
| recall-report | **subagent_visibility 名字**，非独立 plugin | guard_mode_new/plugin.py:115 |

R16 把三者并列问「在哪里」会误导。修正为三类分别作答。

### 3.5 其他已核实事实

- **domain/ 平行副本已删除**（2026-10-13 决策），当前仅 pages/ 活动链路。方案未提但也不应让 R11 回填者误判「仍存在双实现」。建议第 5.2 或 6.1 节加一句声明。
- **Skill 当前形态**：`workspace/agents/agent_workspace/.skills/metriccanvas-platform-authoring/SKILL.md`，allowed-tools 15 个（含 tool_mc_* 三个）；布局标准必选链（选场景+变体 → tool_mc_compile → compose_page → tool_mc_inspect）；aiSummary 两步操作（compose 后单独 edit_page add_ai_summary → submit_ai_summary_body）；publish 流程含「先预览后发布」红线。
- **scripts/tools.py 仅 3 个 tool_mc_***（110/139/174），ToolResponse 风格，与 MCP 注册的 FastMCP 签名（topic/envelope/reference）不同——两处语义可能已分叉，I02 批次须先对账再删。
- **MCP config cwd 指向 /opt/cloud/...（部署路径）**，本仓在 D:/Code/...（开发路径），本地无法用 config 启动服务；R/T/P 层全部 not_run。

### 3.6 2026-11-02 同步后新增事实（Guard 路由已变更，影响方案第 3.1 节表述）

同步 `upstream/feature_2026090792115_build_metadata`（663da7ea → ca6c4b78，仅 RELAY_GUARD.md）后确认：

1. **「自定义分析报告」关键词改路由到 `data-exploration-report`**（RELAY_GUARD.md:73,88,100,180），不再路由到 `metriccanvas-platform-authoring`。
2. **`metriccanvas-platform-authoring` 改为"显式指定才匹配"**：仅用户说"使用metriccanvas-platform-authoring"时路由（RELAY_GUARD.md:74,101,181,202）。
3. 影响：方案第 3.1 节「数据先行当前主要载体 = Relay 已迭代 Skill」的表述需补充——**线上默认入口现为 `data-exploration-report`（含"数据探索"/"自定义分析报告"两类触发）**，`metriccanvas-platform-authoring` 退居显式指定入口。Guard 侧触发面已收窄，方案若主张"线上主载体为 metriccanvas-platform-authoring"，需先与 data-exploration-report 的职责边界对账。
4. 佐证：`recall-report` 是 subagent_visibility 名（guard_mode_new/plugin.py:115），由 RELAY_GUARD.md 第 73-74 行同级路由规则分流；本次改动未触碰 guard_mode_new/plugin.py 本身。

---

## 四、漏洞清单与最小改法（按严重度）

### A. tool_mc_* 归类错误（阻塞 R02/R10 回填）
- 现状：第 7.2 节把 6 个入口合并为「fork 新增」。
- 改法：拆两组。**组1 唯一入口**：publish_page、list_existing_page_urls、submit_ai_summary_body（各仅一个提供方，R10 只问「必须保留否」）；**组2 同名冲突**：tool_mc_query/compile/inspect（双提供方，R02 只问「保留哪条、遗漏能力」）。R02 与 R10 分述。
- 影响批次：I02。

### B. 「9 公共 / 6 报告另列」口径错误（阻塞 R01/R02）
- 现状：第 2.1 与 7.2 数字矛盾。
- 改法：统一为「15 个 @mcp.tool 全部在 platform_mcp.py 公共注册（215-431）」；分歧只在政策（是否公共默认入口），不在事实。删除「Relay 报告另列」表述。
- 影响批次：I00 接收台账。

### C. turn_provider 覆盖缺口未定（阻塞 R03、I02）
- 现状：7.2 只写「需核对」。
- 改法：按 3.1 表直接落定——10 个覆盖 + 2 个身份缺口（list_existing_page_urls / submit_ai_summary_body）+ 3 个无需注入（tool_mc_*）。I02 必须给这两个身份缺口一个明确处置（注入、门禁豁免或工具改名），不能留给部署层默认。
- 影响批次：I02 注册。

### D. 版本三源口径混乱（阻塞 R01）
- 改法：按 3.2 表改写第 2.1 节版本行为「本仓 6.54 权威 / 6.11 stale / MC 仓 6.77 另计」，R01 拆成「本仓可答部分（加载链）+ 需 MC 仓部分（6.77）」。

### E. 批次编排断层（阻塞 I07 启动判定）
- 现状：第 11 节 I07 责任跨线但未出现在任一推进顺序；I08 位置与「不阻塞 I05」语义矛盾。
- 改法：给两条线时序图：Relay 线 I01→I02→I03→I04；产品线 I05→I08→I06；I07 挂在 I08 与 I06 之后的 Relay/产品协同点；「I08 前置」改为「I08 与 I05 并行、I08 不阻塞 I05、I07 被 I08 与 I06 共同阻塞」。

### F. R16 三对象误并列（阻塞 R16）
- 改法：按 3.4 表拆三类。F5 限制本仓无前端，标「未知/未运行，需 MC/前端侧」。

### G. store 现状未写明（阻塞 R06）
- 改法：R06 直接答「当前 store = 文件桥 relay_authoring_state_{context_ref}.json，SQLite 是未来候选非现状」，删除「SQLite 是一种 Adapter」的暗示性表述或改为明示候选身份。

### H. 保留「domain/ 已删除」声明（辅助 R11）
- 改法：第 5.2 或 6.1 节加一句「domain/ 平行副本已于 2026-10-13 删除，当前仅 pages/ 活动链路」。

---

## 五、R01–R18 回填底稿（修正时可直接引用）

| 编号 | 状态 | 回填内容 |
|---|---|---|
| R01 | 认可（需调整） | 6.54=contract-lock.json:8（运行时权威）；6.11=bundle.lock.json:3 + contract-snapshot/manifest.json:3（stale，未清理）；6.77 不在本仓。证据：三文件 grep pageSchemaVersion。 |
| R02 | 需调整 | tool_mc_* 同名双提供方：platform_mcp.py:371/404/431 vs scripts/tools.py:110/139/174。签名语义已分叉（FastMCP vs ToolResponse），运行态生效方本仓不可判，需隔离装配 list_tools。建议 I02 先对账再选保留方。 |
| R03 | 认可（已落定） | turn_provider 覆盖恰 10 个（plugin.py:18-30）；缺口 5 个=2 身份缺口（list_existing_page_urls、submit_ai_summary_body）+3 静态知识（tool_mc_*，签名无 context_ref，无需注入）。 |
| R04 | 部分认可 | turnId 派生自 trace_id（plugin.py:35-42），同请求同 turnId，新请求新轮次；binding requestId==runId==session_id。取消/并发/目标切换需部署探针（未知/未运行）。 |
| R05 | 部分认可 | 完整工作副本=state 文件（documentJson 字段）；前端 CONFIG 传 agent_context；大小限制/摘要校验需传输层确认（未知）。 |
| R06 | 认可（需调整） | 实际 store=文件桥（context_identity.py + file_based_turns.py），非 SQLite。CAS=原子写 + gate 校验（authoring_turns.py:57）。 |
| R07 | 认可 | structured_content 被 Core 丢弃属实；previewJson 经文件桥/preview_bridge；data-agent 流式由 nl2sql_prefetch 主导（preview_bridge:208）。 |
| R08 | 认可 | 匹配=context_ref==turn_id==state 文件名（context_identity.py:34-38）；清理规则需部署层确认。 |
| R09 | 未知 | unknown 冻结记录存 state；恢复能力与重发保护需 Java 侧确认（未知/未运行）。 |
| R10 | 需调整 | 拆两组：3 唯一入口（publish/list/submit）均有真实用例；3 冲突入口（tool_mc_*）先对账再保留。 |
| R11 | 部分认可 | 无公共基线可比 diff；当前 Skill 正文=metriccanvas-platform-authoring/SKILL.md；改良点=布局标准必选链/aiSummary 两步/publish 红线；domain/ 已删。 |
| R12 | 未知 | 字段映射/格式建议需 MC 仓描述与脱敏样例（本仓不可静态取）。 |
| R13 | 未知 | 呈现约定边界样例需 MC 仓；本仓无格式器向量。 |
| R14 | 未知 | 候选 JSON 当前工具尚不接受（方案已声明）；支持范围需 MC 产品侧冻结。 |
| R15 | 未知 | 本仓无独立只读分析工具注册；scanPageData/scopePageData 在 MC 仓，接 read 分支建议成立但需 MC 侧暴露评估。 |
| R16 | 需调整 | 拆三类：nl2sql_prefetch=plugin；unified_dsl_execute=工具名（被拦截注入）；recall-report=subagent 名（guard_mode_new:115）。F5 本仓无前端→未知。 |
| R17 | 未知 | 本仓无安装脚本；wheel/MC/Node 路径、CRLF/digest 问题需 MC 仓/部署侧。 |
| R18 | 未知 | 无热更新机制可见；整包切换/回退、active/unknown 清点需部署层。 |

---

## 六、修正时需方案侧决策的 grill 点（不替你决定，列出待决）

1. **tool_mc_* 冲突处置**：保留 MCP 方关闭 Skill 方 / 两方都保留显式选提供方 / 改名区分——I02 前必须定，影响 SKILL.md allowed-tools 与 guard_mode_new 白名单。
2. **list_existing_page_urls / submit_ai_summary_body 身份缺口**：turn_provider 扩展注入集合 / 门禁豁免这两工具 / 改走其他身份路径。
3. **是否清理 bundle.lock.json=6.11**：清理属整包字节变化，需走第 10 节回退链，不能只删文件。
4. **I07 的双策略接续验收**：挂在 I08+I06 之后还是独立并线——决定第 11 节表末「两条线」段的措辞。
5. **「9 公共」口径改「15 全公共」后**，第 7.2 节「不按报告的 public-MC 标签直接提升为公共默认入口」一句仍保留（政策），但删除「Relay 报告另列」的事实表述。

---

## 七、交付物与验收

修正后的方案需满足：
1. R01–R18 全部有状态；「需调整」项均给出具体 Interface/职责/支持范围修改与影响批次；
2. 第 2.1、7.2、11、14 节四处在本次核对中标记「需调整」的段落全部改写；
3. 没有把本仓静态实现描述为线上已成功；没有以「不在报告里」推导能力不存在；
4. 涉及 MC 仓/部署层/真实服务的项目保持「需 MC 侧确认」标注，不冒充运行态事实。

本文件对应本仓证据可复核路径（不再重查）：
- 工具全貌：`workspace/agents/agent_workspace/local_mcp_servers/metriccanvas_platform_content/tool/metriccanvas_authoring/entrypoints/mcp/platform_mcp.py:215-431`
- turn_provider：`workspace/agents/agent_workspace/.relay/plugins/authoring_turn_provider/plugin.py:18-30,485-619`
- 状态文件桥：`adapters/relay/context_identity.py:34-38`、`adapters/relay/file_based_turns.py`
- 预览桥：`workspace/agents/agent_workspace/.relay/plugins/authoring_preview_bridge/plugin.py:208,399`
- 版本链：`contract-lock.json:8`、`bundle.lock.json:3`、`contract-snapshot/manifest.json:3`
- Skill：`workspace/agents/agent_workspace/.skills/metriccanvas-platform-authoring/SKILL.md:4-19,35-75`