# #126 补充：Platform 双 Skill 与布局基线

作者起点 `6ad16375ba31b985e7ad61ab775d63aac7cc6819`（产品为已合并 main `a6e923187e124c7fd6c7f7c2e78bafd101e3dda6`），代码/Skill/测试提交 `55f598e`，README Skill/布局段落单独提交 `c7e74cfd42cfbb2dfa79a083307844dbf9f8044b`，避免覆盖 S4 生命周期段落。工作树 `/private/tmp/metriccanvas-s3-platform-skills`，分支 `codex/s3-platform-skills`。

## 内容作者与确定性边界

新增 Platform 创建/修改两个 Skill，共享 `skill-shared/platform-authoring.md` 和分别维护的 report/dashboard 基线。描述区分首次创建、明确另建、已有页追加、缺基线与目标不明确；修改 Skill 仅授权 edit_page，旧问数 Skill 主文/授权/路由保持。使用 writing-for-agents 的分支入口、共享真源及完成条件；生成 references 由 S2 独占。

仅 Platform content 的两个创建入口采用新建策略：report 沿用章节结构；dashboard 将自动页头置于 plain，未分组模块用缺省分区及组件标题，需要独立表达的分组标题保留。非图表共卡可用 card，有标题的图表组保留 panel。修改仍继承原布局，set_page_layout 只改根 layout 并给出宽度、工具栏、标题位置、轨道和铺底窄屏回流影响；不改标题/容器/span/数据/手工设置。候选沿既有整页校验原子提交，合法 dashboard+panel/report+backdrop 不被额外拒绝。

本次没有新增 Schema 字段或任意路径操作，不复制 #134–#137 的构造、绑定、查询和校验算法；普通问数 compose 应用未改。目录和 Skill 文本不是 Relay 路由已上线的证据，生命周期 MCP 仍独立。

## 已执行验证

- 作者完整 Python unittest **231/231 通过**，含新增布局领域 5 项及公开 stdio 流程 4 项。复用原精确 ref/hash、部分成功与数据保持测试，更新两处旧预期时保留全页差异断言。
- 四组合：创建/修改 × report/dashboard。真实生产 content stdio 验证创建默认、手工列宽 230 后只改页头、后续新可信基线双向切换、缺基线无产物及非法目标失败；逐份产物完整校验和 hash 验证，模型 text 不含页面/数据。另以实际 stdio + 受控 Data Context/DQE 端口测试两形态 compose_page，验证查询、字段与组件内容相等。
- 当前工作树 Embed 构建，`test-harness/platform_layout_browser.mjs` 在真实 Chrome 跑 **18 场景**：9种产物 × 集成容器1440/640px（浏览器视口保持1600px，以验证容器响应式）。宽容器 report实际1200px居中，dashboard实际1440px占满；窄容器均640px，单元格保持在容器内并转单列。普通编辑、双向切换、页头/模块/章节标题可见；合法 report铺底宽屏absolute、窄屏static回流且高度不低于320px，零pageerror。
- 图表数据装配额外断言 barChart 单元格高度至少270px且canvas/svg实际可见；已目视检查窄看板、报告切换及修正后的数据看板截图。产品 validate-cli **10/10 页面通过**。
- 浏览器首次调试纠正 Shadow DOM 定位及页头与工具栏同名定位，混合数据铺底夹具显式配置产品 createDqeGateway + 本地HTTP DQE协议服务。未改产品运行时绕过接入前置。
- 目视发现带图表分组若强制card，会因RuntimeSection清除chart-cell最小高度而只剩标题；新建策略已保留这类分组的panel，并补真实几何断言。此为新建默认修正，不把card合法Schema分支变为全局非法，也不暗改既有页。原query/dataSources与手工设置分别由全页/字段差异断言保护。

本机证据：`/private/tmp/s3-platform-full-tests.log`、`/private/tmp/s3-platform-browser.log`、`/private/tmp/s3-platform-embed-build.log`、`/private/tmp/s3-platform-evidence/pages` 与18张截图。本机路径不是外部持久交付。

## 分发与安装

S2 准确消费作者 c7e74cf：组合 merge `d09f50ad95db86ef941e5dbabcab53a9afb1a749`（另一父 d10cf5663e521ecd11c0a0835cea71d2a151af02 为协调增量），分发作者 `aa9e79394ef5f64a8145303bd10c23923f6f2a5e`，最终生成组合 `d957d4b1f150399a0a813aa652d802d18c783f52`。本树已 fast-forward 消费，旧 Skill 整目录未变；新增两份自包含参考只由 S2 生成。本组合不含并行 #138，S0 后续集成生命周期后须由 S2 重新生成唯一最终锁，不能直接用本锁覆盖生命周期增量。

- S3 最终组合再次运行完整 Python **235/235 通过**（包含 S2 新增4项分发检查器），导出 **469 product / 4 authoring / 1 interface** 无漂移，Bundle **1890 摘要通过**，diffcheck通过。
- 离线重建最终 sdist，安装到 `/private/tmp/s3-platform-evidence/final-installed`，生产 content stdio 从该安装目录启动，四组合创建/编辑、双向切换、缺基线、非法目标与铺底保留通过。对应4项流程中，3项从安装包生产 content 入口执行，第4项数据 compose 使用仓内实际 stdio 及受控数据端口；不把后者写作生产 DQE 联调或安装包数据适配验证。未修改共享Python环境。
- 三份 Skill 目录分别实际复制到独立证据目录，旧目录272文件、新建/修改各275文件（SKILL+274参考），均为普通文件，逐文件相等；共享作者/双布局投影相等，链接与锚点局限在各自目录，旧主文与 a6e9231 逐字一致。Skill 目录独立分发与 Python sdist 是两个验证面，不把源码目录复制冒称 sdist 内含完整 Skill。
- 采用 S2 固定组合两文件19项 shuffle seed126 结果、tests TypeScript 检查与旧配置临时副本生成/check/Bundle证据；包含入口缺失/重复、跨目录链接、坏锚点、缺锁、共享漂移/投影缺失及旧单入口兼容反例。S3未重复这些相同生成器测试。
- 后续分发增量未改变已浏览器验证的运行代码；沿用作者18场景真实Chrome证据。最终日志位于 `/private/tmp/s3-platform-evidence/final-python-tests.log`、`final-build.log`、`final-installed-tests.log`、`standalone-skills.log`，检查脚本为同目录 `check_standalone.py`。

## 真实模型与外部边界

`test-harness/model-evals/platform-authoring.cases.json` 提供 **14 个全部 not_run** 的用例，涵盖四组合、用户指定优先、模糊澄清、已有页新增、缺基线、目标不明、双向切换、手工语言多轮、明确另建及普通问数隔离；README记录每例trace/diff判定、分母/关键违规与独立状态，不自设准确率门槛。

尚缺本轮真实 Relay 评测入口、隔离身份、模型版本/参数、双Skill注册回执、真实受治理服务配置、可导出trace的基线/产物通道及评测账户预算。因此**未执行真实模型评测**，确定性231项和本地HTTP浏览器不证明模型路由/目标命中准确率，不冒称Java/Relay/生产服务联调通过。#126补充的真实模型验收仍待完成。
