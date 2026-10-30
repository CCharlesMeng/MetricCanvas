# 正式伙伴健康度计算移植

2026-10-30，工作树 `/Users/moon/.codex/worktrees/partner-health-zero-total/DataDashboard`，基线 `279ab136a`。本批在先前未提交的 HTTP Mock 调试修改上继续，只将 probe 的页面计算声明移植到正式 `pages/temporary/partner-health.json`；未新增或调整引擎算子。

## 变更与取数边界

正式 id 保持 `partner-health`。新增11条 `*-overview` 独立查询，以中国区/海外的 `data_site_type` 为范围键；`health-overview` 使用 `unionKeys`、`joinAggregate`、`sumFields` 生成分类和总分。地区部、代表处计算原已存在并保持。5张顶部卡片增加缺项 `--`；总分卡跨度4，与 probe 的完整行布局一致。正式页数据源和 sections 与 probe 语义相等，但不采用 probe id、标题或预览网关。

JSON 没有 Mock 地址。页面入口 `loadPage` 调用 `partnerHealthUnionGateway`，仅 probe id 命中专属网关；场景预览另由 `pageExternalInputs` 的 organization-union 分类接管。旧版内存网关直接构造 Response，因而无 execute HTTP 请求。正式 id 在两个入口均不命中该分类。若内网并非上述 Playground，需要另查实际集成应用，不能单凭 JSON 断言内网故障原因。

顶部 object 查询需要真实DQE按范围返回整体值和 `data_site_type`；不把多条组织记录求和冒充整体分。真实字段、权限、粒度及筛选尚待内网验真。零总数显示兼容依赖前次已交付引擎修复，单独复制JSON不能升级旧引擎。

## 验证

- 先将顶部测试指向正式JSON：9项失败、1项通过，证明正式页缺少顶部计算。
- 移植后：顶部、组织并集、零总数及实际HTTP回归4文件33项通过。覆盖中国区35/海外30、缺项、真实0、负分、空结果和错误；HTTP测试显式注入本地合成服务，仅证明计算及传输链路。
- `pnpm validate`：148/148页面通过。根 tests TypeScript通过，Playground check 0错误0告警。
- `tests/local-authoring-skill.test.ts` 与 `tests/page-reference.test.ts`：42项通过，含仓外复制安装校验；Skill版本1.14.6。协议文档说明同步后使用官方导出器生成知识及锁，MC诊断夹具使用官方命令刷新。
- 浏览器打开 `http://127.0.0.1:5173/pages/partner-health`：服务记录7次不带fixture的标准execute POST。当前上游为本地DQE Sim，返回 `DQE_SIM_UNSUPPORTED_QUERY`，顶部显示 `--`，表格显示“关联数据加载或计算失败”；没有合成业务行。这是默认网关/错误呈现证据，不是内网DQE成功证据。
- 截图：`/Users/moon/.codex/artifact-backups/partner-health-zero-total-20261030/formal-real-gateway.png`。

复杂度使用 `metriccanvas-ts-ast/1`、TypeScript5.9.3、自身selfCC逐函数测量。仅测试断言/输入路径变化：overview测试最大5→5、union测试最大4→4、HTTP测试最大7→7；无新增函数、无超限或引擎代码变更。JSON与文档无可执行分支。

仓内 repair-page-metadata 的 inspect 脚本因基线导入未公开的fileNameErrors不能启动；改用产品 `pnpm validate`、实际parsePage/SourceProgram测试完成校验，不修改旁支Skill脚本来掩盖该基线问题。

## 下方对象查询修正（本轮暂停顶部）

用户提供客户评价的实际对象请求：输出地区部、客户对伙伴的评价得分、国内或海外，按 `filter.fields` 的“国内或海外 = 国内”过滤。本轮只调整下方地区部/代表处的对象查询，保留组织键；通过既有queryModes将界面中国区转换成国内，海外保持海外。补充 `domestic-overseas` queryField映射。其余3类对象沿用相同范围约定，仍须真实DQE确认其字段；顶部候选不改且尚未验证。

范围修正同时应用于正式JSON与HTTP Mock验收JSON，Mock回执按请求填写范围列。新增HTTP请求体断言先2项失败，修正后4文件35项通过，148页校验及tests类型检查通过。浏览器已验证两个粒度图表/表格各15条、第二页ORG-01真实0和独有组织，截图与实际请求体保存在 `/Users/moon/.codex/artifact-backups/partner-health-zero-total-20261030/` 的 `lower-object-scope.png`、`customer-eval-region-request.json`。正式页默认网关未变，HTTP Mock是展示证据，非内网成功证明。

复杂度口径metriccanvas-ts-ast/1、TypeScript5.9.3：Mock responseRows自身1→1、字段映射回调4→5，HTTP处理executePartnerHealth9→10、字段映射回调4→5；fetchImpl3→4，新增范围查找回调均1；新增HTTP测试回调自身4，文件最大仍7。无超限，无引擎代码改动。

## 图表页签看似不切换：本地 Mock 数据重复

浏览器复现：图表选中页签和 URL `tab.regional-comparison-tabs` 均切换，两个 ECharts 容器可见尺寸随页签正确交换；切换前两套数据均为 ORG-01…ORG-15 且分数完全相同。表格两页签各自保留分页位置，制造了只有表格变化的观感。

本次为 Mock 增加独立 representative 数据集（REP-01…REP-15、不同分数分布），内存测试网关和 HTTP DQE Sim 按 sourceId 粒度选取。地区部、代表处仍保留1/10/13条来源、15条并集、null/空字符串/0/负数、zeroTotal。正式页面 JSON 和引擎本轮未改。

浏览器实际点击地区部→代表处，横轴从 ORG 切换为 REP，柱形分布变化；图表与表格页签依然独立。截图位于本机 `/Users/moon/.codex/artifact-backups/partner-health-zero-total-20261030/chart-region.png` 和 `chart-representative.png`。只证明本地合成 HTTP 场景，不代表真实内网 DQE 已验证。

回归：4个伙伴健康度测试文件35条通过，`pnpm exec tsc --noEmit -p tests/tsconfig.json`通过。

复杂度按 `metriccanvas-ts-ast/1`、TypeScript 5.9.3 自身CC实测（前后文件 `/tmp/partner-health-tabs-before.json`、`/tmp/partner-health-tabs-after.json`）：内存网关fetchData 11→12；HTTP selectedRows 8→9；并集测试回调3→5；HTTP测试回调7→9；zeroTotal测试及其find回调均1→2。其余函数不变，无新增辅助函数，相关最大值12，无超限未关闭项。

## 图表独立激活与同源复用续验

用户明确本次“切换”是图表上方的地区部/代表处页签。现有正式页面两个粒度的图表和表格分别共用 `health-scores-region` 与 `health-scores-representative`，本轮没有按组件建立两套 Mock，也没有发现需要修改 EChart 重绘代码的证据。此前“本地两粒度样例相同”仅解释原样例无法区分切换结果；不能用它推定真实内网页面故障已经修复。

新增 `tests/partner-health-http.test.ts` 的图表激活回归直接读取正式页面，通过实际 orchestrate 与 HTTP DQE Sim 执行：默认表格/图表均为地区部；只将图表切到代表处，观察请求从未包含代表处到包含代表处；图表x轴与四组series逐项等于共享快照的组织与分类得分；表格随后进入代表处复用同一快照且不重复HTTP；图表返回地区部、再返回代表处仍复用正确结果。回归6条通过，测试TypeScript检查通过。

浏览器在 `state=zeroTotal` 连续执行地区部→代表处→地区部→代表处；每次可见面板组织类别正确、画布1135×265。两边切到代表处后，图表与表格均为REP组织，REP-04感知/总分3.5、REP-06感知-1与满意度4、总分3、REP-12感知9，对应柱形正确。当前本地版本没有复现“选中页签变化但图表保留旧数据”。本次证据仅覆盖本地当前版本和合成回执；真实内网版本、服务返回和现场症状仍未取得。

复杂度：`metriccanvas-ts-ast/1`、TypeScript5.9.3，新增测试回调自身CC4，全部新增子回调自身CC1，其他回调不变；无新增超限项。测量结果 `/tmp/partner-health-chart-activation-before.json`、`/tmp/partner-health-chart-activation-after.json`。没有新增运行时/页面协议行为，因此本轮不生成新的协议或Skill派生物。

## 顶部国内/海外整体请求与共享执行（用户确认后的实现）

用户确认顶部无需地区部投影，直接获取国内/海外整体得分，并希望三个区块统一请求、各自消费对应数据。本轮仅改变正式页和probe的12个顶部数据源（11项查询与health-overview计算）；筛选器、组件区块、下方数据源不变。

- 顶部4项既有对象类型投影为“得分字段、国内或海外”，条件为 `filter.fields: [{field_name:"国内或海外",value_list:["国内","海外"],operator:"="}]`；不投影地区部/代表处，不使用data_site_type。
- 其余7项保留既有指标DQE、月度时间与区域绑定，输出维度为国内或海外，条件同时取国内/海外。没有猜测7个新的对象类型。
- 每范围应为唯一整体记录。unionKeys/unique关联和sumFields先分别计算每范围的四项分类与总分；随后已有pivot/selectField在5张卡上选择当前按钮范围，避免跨地区部相加。两个范围原始记录都保留在查询快照中。
- 三个区块使用同一个SourceProgram及DQE网关；图表与表格仍共享同粒度快照。真实本地HTTP执行三个粒度共33个不同查询，按现有并发上限形成7批（5/5/5/5/5/5/3），不承诺单个HTTP覆盖整页。顶部切换中国区→海外→中国区不重发顶部11项查询；下方既有查询分支按声明随范围变化。
- 正式页依旧依赖集成应用注入的真实网关；probe经带fixture选择器的实际HTTP返回合成数据。没有新增引擎、Schema或通用批量协议。

实际请求与快照在本机 `/Users/moon/.codex/artifact-backups/partner-health-top-object-20261030/http-requests.actual.json`、`computed-snapshots.actual.json`；其中抽出的客户评价顶部请求为`customer-overview-request.actual.json`。浏览器中国区35/20/--/17/-2，海外30/4/15/14/-3；全部缺项时总分0、分类--；真实全0时5卡均0。截图为同目录china.png、overseas.png、missing.png、zero.png。

验证：伙伴健康度及local-authoring/page-reference共6文件80项通过；148个页面文档全部通过；测试TypeScript检查通过。产品compute参考和PAGE-METADATA同步，local-authoring版本1.14.7，导出器生成协议知识、参考和锁文件。完整authoring/MC检查结果见本节后续收口。真实内网返回的每范围唯一整体记录、中文维度的指标端支持、权限与期间仍需现场回执验证，当前Mock不替代真实服务证明。

复杂度：metriccanvas-ts-ast/1，TypeScript5.9.3；Mock overviewRows 2→2、其选择回调2→1（改为读取原始条件）；HTTP overviewRows自身3→3、其选择回调2→2。新增测试isOverviewItem自身5，合批测试4，顶部缓存切换测试2，新增子回调均1；现有测试新增raw快照断言不增加分支。相关所有函数最大自身CC12，无超限未关闭项。前后测量`/tmp/partner-health-top-both-before.json`及`/tmp/partner-health-top-both-after.json`。

补充：浏览器empty与error场景五张卡均为--，不伪造0或部分总分；截图empty.png、error.png。MC覆盖、33条内容测试及诊断夹具检查通过；契约导出检查通过（1317 product、4 authoring、1 interface）。

收口：按AGENTS.md限定Skill默认范围，只验收local-authoring。完整`pnpm authoring:check`脚本因包含其他Skill/历史Bundle隔离测试而中止，不计为通过；收窄的5个local-authoring/page-reference文件共197项通过（包含仓外独立安装、工具、升级及页面校验）。伙伴健康度及参考回归80项通过，MC覆盖/内容33项及夹具通过，契约导出一致性通过。对应日志在`/tmp/partner-health-top-local-authoring.log`、`/tmp/partner-health-top-regression.log`、`/tmp/partner-health-top-mc-check.log`、`/tmp/partner-health-top-contracts-check.log`。未执行真实内网DQE，未提交或push本轮改动。

## 全球与具体组织视角（最新用户规则，替代此前范围联动说明）

本节以用户最新确认的三个区块边界为准，覆盖上文旧的下方queryModes、中国区/海外联动及代表处懒加载描述。正式与probe页面数据源、组件声明同步，schemaVersion经已有升级器从6.74升级到6.77；未修改引擎或Schema。

- 区域筛选使用已有单选层级树，逻辑层级region-dept/representative对应中文地区部/代表处。树内原子提交层级和具体组织，移除单独层级控件；旧level筛选隐藏保留兼容。region.values为空即全球，不因保留的region.level误判为已选组织。
- 全球展示中国区/海外按钮及5张整体卡，图表两页签；顶部11项整体查询不绑定region。切换中国区/海外仅通过pivot/selectField切换已取得的整体结果，22项下方查询不消费该筛选、不带国内/海外条件，图表表格及缓存保持。
- 选择具体地区部时，5张卡复用health-scores-region；选择代表处时复用health-scores-representative，不把组织得分纵向相加。卡片通过已有visibleWhen按values/level选择，当前始终仅5张可见。组织分类sumFields使用ignore保留全缺null，真实0保留，总分仍使用zero。
- 具体组织下图表只保留代表处页签；若原先选中地区部，现有呈现逻辑自动使用可见代表处。表格地区部/代表处页签始终展示并独立切换，图表表格共用同粒度快照。
- 全部下方及两个详情查询的region绑定用levelQueryFields下推中文组织条件。组件隐藏不会自动停止取数，具体组织卡片消费两套结果后初次加载即统一请求33项查询；跨区块复用同一SourceProgram和HTTP合批网关。
- probe的平面层级候选及查询用父子关系来自mock.json；本地HTTP处理器和内存测试网关根据编码后的DSL过滤组织。REP-04/05/06为ORG-06子节点，REP-06只保留自身；该合成父子关系不是实际业务组织证明。正式JSON不含Mock地址，真实候选适配、字段、唯一整体粒度、权限和期间待内网验证。

浏览器实际点击验证：全球中国区35→海外30时下方表格文本完全相同；选ORG-06后顶部6/-2/8/--/--、图表REP-04/05/06；选REP-06后3/-1/4/--/--且图表仅REP-06；清空恢复全球按钮和两套图表页签。先在全球选图表地区部后再选ORG-06也正确回退代表处；表格两个页签一直可用，并能独立切到3个代表处。使用实际本地execute HTTP及zeroTotal回执，不冒充真实内网成功。

本机截图在 `/Users/moon/.codex/artifact-backups/partner-health-scope-20261030/`，department.png、representative.png、global-overseas.png。页面回归5文件44项通过，含作用域条件、卡片实际得分、缺项、真实0、并集、实际HTTP条件及顶部切换不新增任何HTTP。文档更新PAGE-METADATA、compute、页面README；local-authoring升为1.14.8并按官方导出器生成知识及锁。

复杂度口径metriccanvas-ts-ast/1、TypeScript5.9.3，逐一测量修改及新增函数（含所有闭包和测试回调）：gateway.fetchData自身12→10，fetchImpl4→6；HTTP selectedRows9→9，executePartnerHealth10→10；新增organizationDimensionValues4、matchesOrganization6、selectOrganizationRows1，其子回调最大2；新作用域测试回调11，HTTP文件最大9→9、overview最大5→5。全部自身CC≤15，无未关闭超限项；前后完整数据在/tmp/partner-health-scope-before.json、/tmp/partner-health-scope-after.json。JSON条件不伪造函数测量。

兼容性收口：普通Dashboard层级单选沿用现有fetchDimensionValues各层平面候选，在单下拉内按层级分组，不声明treeSelection:level，因此全球空选择不会要求新版fetchFilterCandidates而阻止execute。Mock父子映射仅用于验证查询过滤。真实组织候选仍须现有宿主映射提供。本轮不迁移为IOC页头。

## 提交集成

用户授权提交并push后，将本批补丁接到最新origin/main（0f6a9e9c15335cf4db00ed4a0e9e3545fbd17873），保留上游对象查询与候选修正。业务源文件无冲突，派生契约/知识/锁/诊断夹具按合并真源重新生成；local-authoring为1.14.8。交付前重新执行受影响伙伴健康度、local-authoring、页面与类型检查，CI按最终远端SHA另行核对。

集成补充：上游apps/playground/tests/partner-health-dqe.test.ts保留标准对象filter.fields请求断言，只把旧的28项页面查询覆盖数更新为当前35项（整体11、地区部11、代表处11、详情2）。该测试37项通过，修改回调自身CC最大3→3，无新增函数；完整测量在本地/tmp/partner-health-delivery-dqe-before.json和after.json。合并冲突按resolving-merge-conflicts流程保留双方真源后生成，未放宽对象协议断言。
