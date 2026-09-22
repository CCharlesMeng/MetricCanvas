# Skill 完整测试依赖盘点

日期：2026-09-22。范围：metriccanvas-platform-authoring 的九工具、现行真实模型 runner、Java/DQE/Relay 模拟和工作台交付。此次只检查源码并运行无模型 preflight，没有调用外部模型或真实 Java 服务，没有新增模拟实现。

## 结论

当前可以验证独立规则、适配器协议和单场景模型调用，尚没有覆盖全部 Skill 工作流的统一模拟环境。406 项 Python 回归通过是上一轮的局部/组合测试证据，不代表完整 Skill 环境已经就绪。

新增 Java 原始指标查询有 httpx.MockTransport 和平台工厂的发现→查询组合测试，但现行 run_platform_v2.py 没有使用它：runner 直接注入 FakeDataContextPort / FakeDqeExecutionPort，并直接构造 PlatformAuthoring。即使环境变量指向新的 Java 元数据接口，这个 runner 也不会改走它。

## 依赖矩阵

| 依赖 | 当前模拟/实现 | 完整测试仍缺什么 | 优先级 |
|---|---|---|---|
| Java query-dataset-from-lab | test_dataset_metadata_http.py 覆盖批量 POST、身份、部分失败、失效与发现→查询；使用 MockTransport | 可复用的本地 HTTP 路由，并让完整 runner 通过正式 JavaDatasetMetadataProvider 调用；数据集/指标/维度与 DQE 夹具一致 | P0 |
| DQE 执行 | 有真实 HTTP DQE Sim；完整 runner 使用固定 FakeDqeExecutionPort 返回值 | 将 runner 接入真实 DQE HTTP Adapter + Sim；错误指标、维度、筛选和时间必须拒绝，不能无论请求如何都回同一数据 | P0 |
| 查询源描述 SourceDescriptionPort | DescriptorFixture 生成固定测试 logicalId/projectionId | 与同一套语义模型、查询及结果列绑定的模拟提供方；覆盖别名、单位、字段缺失与版本不一致 | P0 |
| Java 当前页面、条件保存 | Service 内存替身；KnownLifecycleHttp 有独立 MockTransport 测试；前端另有 route.fulfill | 同一 HTTP 服务维护页面资源/修订；支持 GET、POST、PUT、base_revision_id 冲突、已写入但回执丢失、重启读回；连接正式 Adapter | P0 |
| 可信创作轮次与身份 | Turns 固定一个 new 轮次；Identities 固定 alice/w | 测试宿主从 Java 模拟页建立 existing 基线；多轮、切页、切账号、取消及迟到结果统一控制 | P0 |
| 分析计划确认 | runner 只接受预设 approvedPlan，并在用户消息中声明已确认 | 用户确认/修改/拒绝事件模拟器；授权与本轮 request/version 绑定，覆盖自主计划、澄清和修改范围 | P0 |
| Relay 预览与检查点 | Preview.prepare 直接返回 ready；模型摘要/程序产物由 runner 手工分流 | 保存 artifact、两个标记替换、工作台实际消费、过期产物隔离与失败后只重试交付的集成模拟 | P0 |
| 参数提取/选择/填值 | 有真实 TS 参数程序、SQLite 与 VerifiedFixture 的独立 MCP 测试 | runner 注入 ParameterDependencies；验证记录关联实际 DQE 证据；覆盖选择确认、填值、临时实例执行与渲染 | P0，若要覆盖九工具 |
| 工作存储 | runner 已使用 SqlitePlatformState | 无需再模拟存储；完整场景增加同库重启、并发轮次和冻结提交验证 | 已具备基础 |
| 业务/组件与布局配置 | 页面构造器和真实 Schema 校验已使用；场景数据范围很小 | 扩充固定场景数据和每项业务/布局验收，避免一个区域报表代表所有 Skill 行为 | P0 |
| 维度取值 GET dataset-detail/query | YAML 已有；新元数据适配器并不调用该接口 | 参数/发布等需要取值时补对应数据与调用路由；原始语义元数据不能替代真实枚举值 | 按场景 |
| 模板检索、实例执行、发布 | 有独立生命周期/发布和前端测试；九工具不提供检索或发布 | 若完整测试包含 Skill 委托的平台步骤，需要模拟提供方和用户确认；不能只测参数解析就声称模板闭环 | 按范围 |
| AI 总结 SSE | DQE Sim 有 SSE；其他测试有 summary 配置；当前 runner 未注入 summary_config | 若场景包含 aiSummary，则接通生成配置、SSE 及实际渲染 | 按场景 |
| 模型服务 | apps/platform/.env 存在且三个必需配置项非空；未读取/输出密钥值 | 模型质量测试应调用实际选定模型；不把 scripted mock 视为自主执行证据。配置存在不证明凭据有效或服务可达 | 执行时验证 |

## 已复现的启动/验收问题

1. 无模型 preflight 已运行，modelRequests=0，但 introspection.status=fail：`edit_page: legacy identity/token input exposed`。preflight.py 仍把 page_id 列为禁用参数，与当前必填页面断言冲突。应只禁止旧 token/身份自报，并验证 edit_page.page_id 必填。该问题是预检过期，不是 edit_page 新参数有误。
2. preflight 同时列出已经移除的 platform-create/platform-edit Skill 文件缺失；它仍混用了历史 suite/provenance。现行完整验收应独立于这些历史路径。
3. platform-authoring.cases.json 的部分预期仍是 platform-create/platform-edit，且 run_platform_v2.py 不消费该用例集。不能把用例文件存在算作覆盖完成。
4. 当前 runner 只有“已确认计划的新建区域运营报告”，固定 new 轮次；只加载 create/data-analysis/tools/scenarios，没有加载 edit、parameters 或 execution 检查点。它不能代表修改、参数、多轮澄清与取消。
5. 公共 stdio 的 create_production_platform_server 只装配 data_context/dqe，未注入 current_turns、store、授权、生命周期和预览等提供方。只启动 MCP 能列工具，但不能直接完整执行；需要单独的测试组合根，不能拿生产缺提供方的入口当模拟环境。
6. platform_v2_browser.mjs 只读 artifact.previewJson，并在 fetchData 时主动抛错；它能验证现有样例的渲染与几何，不能验证保存后重开页面、渲染期 DQE 查询、筛选或翻页。

无模型预检报告保存在本机 `/tmp/skill-dependency-audit-preflight-20260922.json`。文档所述 Python 环境和 runtime dist 均存在；未检查浏览器启动或模型网络可达性。

## 建议补齐顺序与完成判据

1. 修正现行 preflight/用例集，建立一个可从 stdio 启动的本地测试组合根，禁止导入后隐式走真实外部服务。
2. 同一份场景数据支撑 Java 语义查询、DQE、源描述和有状态页面资产模拟；通过正式 HTTP Adapter 执行，保留请求日志与故障注入。
3. 接入轮次、用户确认、Relay 产物交付和参数依赖；先用确定性脚本完整跑通九工具所需场景，证明测试设施可用。
4. 再做真实模型 Skill 测试，覆盖新建、修改、配置问答、取数变更、partial、冲突、未知保存、预览恢复、参数三工具、多轮与取消。
5. 工作台用保存后的 document 重开并实际调用 DQE；另查 previewJson 的首屏交付。逐场景保存工具轨迹、HTTP 请求、页面文档、保存/预览回执和浏览器证据。

完整通过须同时有：授权目标正确、请求与结果口径对应、未授权内容保持、保存回执匹配、预览实际消费、异常无多余写入、参数实例正确执行和页面可读。Schema 合法、工具调用次数和模型最终输出两个标记不单独构成完整通过。

## 代码依据

- [模型 runner](../../metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py)
- [预检](../../metriccanvas-authoring/test-harness/model-evals/preflight.py)
- [新 Java 查询测试](../../metriccanvas-authoring/test-harness/tests/test_dataset_metadata_http.py)
- [固定依赖夹具](../../metriccanvas-authoring/test-harness/authoring_fixtures.py)
- [内存 DQE 返回值](../../metriccanvas-authoring/test-harness/adapters/fakes.py)
- [源描述夹具](../../metriccanvas-authoring/test-harness/tests/test_source_mapping.py)
- [参数 MCP 测试](../../metriccanvas-authoring/test-harness/tests/test_page_parameters_mcp.py)
- [独立预览渲染检查](../../metriccanvas-authoring/test-harness/platform_v2_browser.mjs)
- [平台组合根](../../metriccanvas-authoring/tool/metriccanvas_authoring/bootstrap/platform.py)
- [DQE Sim HTTP 路由](../../tools/dqe-sim/src/server.ts)
