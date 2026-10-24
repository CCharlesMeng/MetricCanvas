# 写出、读取与迁移

当前写出版本与完整可读集合来自 protocol/version-policy；能力下限逐条由产品实现探测，不能以版本字符串相等代替。最新包面向 manifest.alignedWith 的配套产品；精确旧知识使用对应历史包，最新包不保存每版完整快照。

| 受影响输入 | 产品可读与迁移事实 | 回归与处理 |
|---|---|---|
| 当前页面 | 完整 normalize/parse 通过才 readable；无修改不强制迁移 | inspect_schema；产品合法/非法夹具 |
| 5.0—5.4 旧导航 | 读取边界转换 page/setParams；显式升级复用该规则，原件不变 | legacy navigation 回归；目标路径须真实引擎/部署核对 |
| layoutForm 旧布局 | 某些 6.x 版本不可直接读取，显式升级可按产品布局规则转换 | schema-upgrade-demo；不可只改 schemaVersion |
| 6.44 及之前图表筛选 | 读取沿产品兼容边界；显式升级为组合卡 + filterGroup，保留图表 id、外部跨度、筛选/查询 | chart-filter 四类图表回归及目标校验；非版本号替换 |
| 6.5/6.6 数组参数 | 读取与迁移分别诊断；有旧写入语义时不自动迁移 | /params 给出明确人工处理项，保留固定值与 initial |
| 6.13/6.14 reportHeader.filterIds | 旧自动期间语义不自动写成当前 asOf.value | 需人工确认期间文本组合与无选值文案；迁移 blocked 不等于旧页必然不可读 |
| 未声明、未知、未来版本或降级 | 不猜版本，不提供未实现的迁移 | 明确 needs_review/blocked，原件保留 |
| 使用新能力却声明旧版本 | 先检测原始能力下限 | 不用提升版本掩盖原有错误 |

原始文件先检查；需要迁移时直接 dry-run 或显式写全新目录，按需求选一种，不默认连续跑三遍。写出保留 original 原始字节及 SHA256，目标文件以页面 id 命名，migration.json 记录变更。status=ready 且 output 存在表示已写出；ready 本身也可能是 dry-run，须看 output。已有输出目录拒绝覆盖。结构成功仍需受影响渲染/交互回放，真实 DQE/保存/Relay 单独验收。

本次为内容、检索和检查能力增补，没有修改页面 Schema 或工具 MCP 签名。inspectionSpec formatVersion=1 增加可选 correlation 事实；旧 spec 仍能检查，缺关联证据显示 not_run；内容摘要变化后旧 spec 明确拒绝。工具默认摘要继续不输出大 Schema；需要时 includeSchema=true 或 pointer 局部读取。IOC 组件知识完整，可自动装配集合保持产品既有边界。
