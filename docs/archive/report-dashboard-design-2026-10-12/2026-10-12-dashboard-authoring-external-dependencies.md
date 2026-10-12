# 概览与列表生成：Relay、Java 与数据能力交接清单

日期：2026-10-12。配套 [编码计划](2026-10-12-dashboard-authoring-coding-plan.md)。这是 MC 消费端提出的依赖与验收请求，不是外部服务已经实现的接口声明。当前未取得生产 Relay/Java/DQE 调用证据，所有“可用”结论需提供方实证。

整体流程以 [文本设计、数据推导与架构冲击](2026-10-12-authoring-flow-and-impact.md) 为准。内部Agent只支持文本：新增R6设计输入与跨轮恢复依赖，不要求Relay接入图像识别或多模态模型。未绑定数据的设计要求留在创作期，不改变Java页面资产保存职责。

computed重点补充见 [数据准备到目标呈现的缺口方案](2026-10-12-dashboard-computed-gap.md)。R2需覆盖计算依赖新增的查询及完整性，R3/D2需覆盖键、粒度、可加性和业务规则。Java页面资产保存compute声明，不默认执行计算。Python创作验真接入TS算子的求值方式尚待裁决，不能假设Relay已有JS执行环境或新计算服务。

MC 交付公共契约、编译与验证、接入示例和本地 HTTP/程序替身。内部团队维护 `adapters/`、Relay 插件及服务部署。Java 服务由提供方维护，本仓不编写 Java 服务实现。建议先确认各项负责人与可用事实，随后编码和接线并行推进。

## 1. Relay：必要接入及行为变化

| ID | MC 的当前消费事实 | 外部需要提供或同步什么 | 对编码的影响 | 必须回传的验收证据 |
|---|---|---|---|---|
| R1 工具与 Skill 切换 | 同一服务九工具；`platform_mcp.py` / bundle-info / bundle.json 当前工具协议 2.0 | 采用新主版本输入、Skill 与 Bundle；更新实际工具缓存及路由；旧请求不再生产消费 | C01对账，C10/C11生产切换；不新增服务名或 report/dashboard 工具 | 实际工具列表/Schema摘要、Skill/公共/内部提交号、版本一致性；旧输入拒绝，新报告与两页可运行 |
| R2 精确数据计划授权 | `AnalysisAuthorizationPort.authorize(binding, request, version)`；QueryResults 规范化后逐单元授权，执行前先核对整批有效单元 | 计划审核包含明细字段/实体粒度、分页/排序及范围；规范请求与 `requestSha256` 同源；更新内部白名单和确认映射 | C02/C03及真实查询；方法同名不等于兼容 | 一项变更字段/请求/版本/身份后授权拒绝且 DQE调用0；正确请求有真实确认事件关联及执行记录 |
| R3 业务规则确认与事实 | 现有 MetricRelationsPort 只支持 primary/change/time，不能传通用ratio；数据提供方和用户确认是不同来源 | 若需要人工确定ratio或业务映射，由可信程序记录具体内容/来源/身份/轮次或修订/版本回执；外部物理能力由元数据或提供方事实供给 | C01新事实消费契约、C03/C05；不是把confirmed布尔加入工具输入 | 确认前unknown，明确确认后只使被确认规则有效；错范围/旧回执拒绝；模型自报origin=user不能授权 |
| R4 单意图串行单页轮次 | CurrentAuthoringTurnPort 和 work/result绑定单页；前端 LanguageResult只接当前binding | 同一业务请求分别准备目标new轮次和来源existing轮次；明确切换驱动与父请求关联；来源回填前精确读取，取消/身份变化拒绝迟到回执 | C08；单页创建可先做，一条指令自动跨页不能仅靠Skill | 一条“创建并关联”意图贯通两个目标作用域；每次保存对应正确页/轮次；不串预览、不丢来源修改、不发双页事务 |
| R5 双通道与工作台显示 | MCP模型摘要与完整artifact分离；`relay_preview.prepare`回执精确artifactRef/ref；保留两个占位符 | 消费新组合/完成度摘要；完整产物不回模型；更新预览缓存/占位符替换和前端回执映射；跨页只展示当前授权产物 | C06/C08/C10/C11；preview ready仅表示程序接收 | 真实工作台渲染正确修订；交错/取消/旧artifact不替换当前页；预览失败只重交付，保存调用数不增加 |
| R6 文本设计与跨轮恢复 | authoring-turn/1.0为闭集单页绑定，无设计来源/计划修订；既有discovery task不是通用设计状态 | 传递自然语言/Markdown/结构文本及程序可核验来源、版本；澄清后在新轮恢复相关约束；冻结作用域、预算、确认及失效规则。优先复用可信请求上下文，实际能力需对账 | C01/C01a/C03a/C10/C11；独立可信上下文或binding升级需A9裁决；不默认新必填Adapter/新MCP工具 | 全程无图片依赖；澄清后固定项仍有效；错身份/旧版本拒绝；设计推断不被视为用户确认；口径变更使旧证据失效 |

保留 `{{RESPONSE_START}}` 和 `{{PAGE_METADATA_PREVIEW_JSON}}`。不把计划确认、业务规则确认、目标创建授权和发布混为同一个“确认”。已有 Java 发布仍按人工明确动作执行。

R4 不是要求创建长期工作流服务。本批无持久下钻待办；单个 MCP 调用只使用一个合法单页轮次。是否由 Relay 驱动全部子轮次，或由 MC 工作台通过现有程序端口依次准备并启动，需要 C01/C08 冻结具体接线。当前 `createAuthoringLanguage` 在 active 时拒绝再 start，`validateDelivery` 校验单个 binding，直接广播目标页通知给来源页工作台会被拒绝。不能删掉这些门禁来“打通流程”。

R6与R4分开：设计澄清恢复解决当前创作要求的连续性，不等于持久下钻待办或多页事务。若原始文本和计划身份走独立可信上下文，必须绑定当前身份/请求/轮次；若需要在authoring-turn内表达，显式升级契约及消费端。不能向闭集1.0静默加designRef，也不能用模型聊天总结冒充程序恢复结果。未取得接线证据前，跨轮恢复标为未完成。

## 2. Java 页面资产：既有依赖与条件性改动

提供方真源为 [platform-java.yaml](../../../service/platform-java.yaml)，公共消费参考为 [KnownLifecycleHttp](../../../metriccanvas-authoring/examples/adapter_template/firstparty/lifecycle_http.py)。对照资料：

- 集合 `POST /rest/cdi/cdinl2databuilderservice/v1/user-page-metadata`：新建，传 `page_id`、对象形式 `page_metadata_definition`、`is_draft:true`。
- 资源 `GET/PUT .../user-page-metadata/{page_metadata_id}`：按资源 ID 读取/更新；PUT 传 `base_revision_id` 和 `is_draft:true`。
- 响应 `page_metadata_definition` 为 JSON 字符串；成功还需 `page_metadata_id/page_id/revision_id/revision_number/is_draft`，定义与提交相符。

这里的 URL 和字段来自仓内 YAML，不证明生产端点、认证、限制或并发语义已通过。引用的 YAML 中 OpenAPI `operationId` 是接口名称，不是保存幂等键或远端操作查询能力。

| ID | 本批依赖 | 是否默认需要 Java 改接口 | 若不满足怎么处理 | 必须回传的验收证据 |
|---|---|---|---|---|
| J1 完整 Page 保存与读取 | 透传当前作者版本的 query/filterBindings/compute/组合卡/Tab/地图/布局；隐藏字段及Page参数完整保留 | 不默认。若服务端校验版本滞后、字段裁剪或大小限制，则提供方兼容调整 | 不能删字段过检、降低Schema版本或转静态；真实保存阻塞 | 两页实际定义POST/GET/PUT无损，确认大小限制和校验区间；原页71,625/36,754字节仅作测试下界，不是请求上限 |
| J2 服务端原子修订检查 | current_match读当前资源，PUT服务端原子检查base_revision_id；冲突不覆盖 | YAML已有字段，仍须真实语义核验；若无原子性需后端修正 | MC本地CAS或GET后PUT不能替代；安全回填及并发编辑阻塞 | 两请求同基线竞争只一个成功，另一个明确冲突；资源/页不混用；修订前进且相同权限范围读取 |
| J3 单次保存回执与unknown | 明确成功/拒绝/未知；请求发出后超时不再发送 | 不要求新增幂等键、operation lookup或历史精确读取 | 持久保留unknown及原操作；公共recover只核对本地已留回执，不恢复为成功 | 断开保存响应后写调用仅1；重启和再次调用不重发。无明确原操作证据时状态仍unknown |
| J4 目标资源与消费方式 | 按权限查找/读取目标、取得page/resource/current revision；参数与实际页面一致 | 优先复用现有列表/GET；若不能授权定位目标，列提供方缺口；不默认新增URL解析接口 | 模型不能猜ID/路由；目标不可读或当前消费模式不可用时不关联 | 可读和拒绝目标分别验证；Page参数与源绑定相容；草稿/发布消费规则及真实地址可访问 |

真实 URL、门户前缀、草稿/发布消费模式由平台/集成应用提供，不归 Java 自动生成。保存草稿不代表地址已对外发布；不通过自动发布来满足导航。

`supported_fields` 是 Java 从定义抽取的指标/维度摘要（YAML有此字段）。对 compute派生字段、隐藏导航字段、多源字段的抽取应核验；若该摘要只是辅助显示，可以由定义消费避免假设，若真实执行或权限依赖其正确性则属于提供方必须修复项。不能把布局策略或模型业务编排塞进 Java。

Java参考实现只声明 current_read/single_save，lookup/read/history 返回 CAPABILITY_UNAVAILABLE。`assets/drafts.py:recover` 读取冻结 submission及已留回执，不调用远端 operation lookup。因此本批正常新建/编辑不以自动解除unknown为前置。逻辑原型中“核对后成功”仅模拟外部已有明确回执，不能作为 Java 已有能力。

文本设计、未解析数据要求与计划修订不塞进page_metadata_definition；Java只保存最终合法Page。设计计划持久化若成为单独产品需求，再审存储/服务所有权，本批不默认给Java增加设计资产或计算求值接口。

## 3. Java 元数据与 DQE：与页面资产分开对账

Java 数据集元数据真源为 [dataset-detail-java.yaml](../../../service/dataset-detail-java.yaml)。DQE执行经已有 `dsl/execute` 及内部认证接线；它与 Java页面资产不是同一项能力，也不由 Relay伪造数据事实。

| ID | 必要事实或执行能力 | MC 可以独立完成什么 | 提供方/治理方配合及门槛 |
|---|---|---|---|
| D1 全量字段与实体粒度 | 概览关键查询20度量；列表30维度+15度量；字段类型、单位、映射、身份、权限及机会点实体键 | 独立data request、共同派生和字段验证；用可信夹具覆盖规模 | 实际能取得所有字段并保持预期行粒度；output_dims 是否分组合并及度量聚合按真实DQE确认，不能仅加projection字段宣称支持记录查询 |
| D2 筛选/层级/计算事实 | 筛选专用目标、region编码/行业级联、boolean真值、日期/金额字段；计算链需要的跨源键、粒度、可加性、单位与完整性，含四ratio定义 | 对已有事实投影；建立能力引用与负向验证；按目标形状规划现有算子链 | 缺事实需治理或明确规则确认；物理字段/编码/完整性不能通过设计描述或确认制造；元数据缺事实需另由真实提供方接入，不假定当前Java端点已有 |
| D3 查询分页排序/筛选 | 初始limit5、offset变化、上游排序编码、表头条件、过滤后的匹配totalCount、稳定翻页粒度 | 派生并保存当前Page支持的查询定义；运行期复用正式网关和统一运行时 | 真正执行分页/排序/表头筛选，至少两页验证；仅返回首屏行或静态totalCount不算通过；真实编码缺口单列，不修改协议伪装支持 |

现有语义投影的维度卡能给出规范名、来源身份、filterDimension/timeGranularities，但 values与metricCompatibility可能unknown；单个静态查询成功也不能证明任意层级、级联或所有筛选值可用。

## 4. 可并行推进与生产门槛

| 外部事项未完成 | MC仍可做 | 不能宣称完成 |
|---|---|---|
| Relay新Schema未部署 | 公共契约、纯编译、正式MCP+可信程序替身、报告回归 | 生产工具切换和实际用户计划授权 |
| 业务规则/编码供给缺失 | 元数据已覆盖部分、缺口投影、拒绝探针及partial | 完整生产概览及全部层级/比率正确 |
| 单意图跨页编排未接线 | 单页新建、已有目标验证、来源页导航操作 | 一条用户指令自动跨页完成 |
| 文本设计来源/跨轮恢复未接线 | 当前轮要求归一化、映射和负向编译验证 | 澄清后可信恢复、旧版本失效和正式跨轮创作完成 |
| Java服务端条件更新未确认 | 本地CAS和HTTP合同向量 | 真实并发编辑安全与生产回填 |
| Java未提供operation lookup | 正常单次保存、unknown保留与不重发验证 | 自动判断未知操作已保存或安全重试 |
| DQE真实分页/排序未证实 | Page声明、仿真查询和本地浏览器交互 | 生产列表分页与全量筛选正确 |

## 5. 对账回传模板

每项回传以下信息即可；不要回传凭据、真实业务行或私有错误原文。

```text
依赖ID：R* / J* / D*
负责人及提供方：
公共提交 / 内部提交 / 部署版本：
可用能力及契约来源（现有 / 需调整 / 不支持）：
真实端点响应摘要与安全关联ID：
已执行场景及调用数（DQE / Java保存 / 预览）：
结果：pass / fail / blocked / not-run
未完成项、影响的编码任务与下一步：
```

外部接口不是 MC计划里的既成事实。公共正反例、本地HTTP替身、真实模型与真实生产联调分别保存证据。外部新增必需方法、确认归属、跨页轮次协议或Java保存/发布所有权变化，先完成具体Interface对账与定向grill，再实施。
