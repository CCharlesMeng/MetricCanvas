# 创作版本与旧入口盘点

日期：2026-09-22。状态：本仓旧平台入口、结构计划 1/2 解析及候选存储/提交/恢复链已删除；参数能力已迁入工作稿与临时产物。

本表把名称相似的版本和入口分开记录。`v1/v2/v3` 本身不是删除依据；只有确认生产消费者迁移后，才删除对应路由或实现。

## 版本序列

| 发现位置 | 当前含义 | 处理 |
|---|---|---|
| `pages/composition/page_structure.py`、`section-patterns.json` | 页面结构计划实现与呈现规则，历史实现含 v1/v2/v3 | 统一现行实现；历史版本只留迁移夹具，禁止新建生产输入 |
| `contracts/authored/platform-v2-protocol.md`、`entrypoints/mcp/platform_mcp.py` | Platform 工作稿/内容工具协议序列 | 保留为现行平台协议；文档中明确它不是页面 Schema v2 |
| `pageSchemaVersion`、`packages/page`、`pages/validation` | 页面运行时 Schema 版本及兼容读取 | 保留独立的 5.x/6.x 读取边界，不与结构计划合并 |
| artifact `formatVersion` | 产物信封或局部契约格式 | 按所属信封解释，不命名为结构计划版本 |
| Bundle manifest/lock、`pyproject.toml` | 分发物和软件包版本 | 保留独立递增，并固定 Relay 运行时依赖 |
| Java/DQE/Relay `/v1/` 路径 | 外部服务 API 版本 | 由服务提供方维护，不能作为页面创作版本 |

## 旧入口与消费者

| 入口/符号 | 位置 | 当前证据 | 处理决定 |
|---|---|---|---|
| `metriccanvas-platform-content-v1` / `unified_content_server` | `tool/pyproject.toml`、`entrypoints/compat/` | 启动模块、console script 和旧 MCP 工厂已删除 | 无环境开关恢复入口 |
| `report-metadata-creator` | Relay 侧调查报告中的旧 Skill；本仓有 `skill-compat/platform-authoring-v1` 相关兼容资料 | 旧工具链与统一平台创作重叠 | Relay 路由迁移后删除生产 Skill；历史说明归档 |
| `build_page` | 已删除保存用例、JavaPageAssetPort、指纹和专属端口 | 默认问数只注册 discover_data_context / compose_page；显式 compatibility 拒绝启动 | 旧保存链已退役；保留不保存的普通问数入口 |
| `candidateRef` / candidates 表 | 旧候选存储、提交、恢复模块 | 实现与专属契约已删除，参数工具使用工作稿和 artifact_ref | 发布生命周期的独立候选与参数选择 candidate_id 保留，不属于旧页面候选链 |
| `platform-authoring-v1` | `skill-compat/platform-authoring-v1/` | 整个目录已删除 | 历史说明查 Git 与 ADR，不随 Bundle 分发 |

旧 unified/structure 编排及结构修订专属契约已删除；可信指标关系已迁入现行 query_data 的持久结果，创建/编辑通过 resultRef 消费。原结构测试迁至现行平台工具链，页面规则与格式断言保留。

## 当前不能直接删除的内容

- 页面 Schema 5.x/6.x 读取、规范化和兼容测试。
- 普通问数/探索的临时页面态（discover_data_context / compose_page）；build_page 保存面已退役。
- `page_metadata_emit_preview`、`{{RESPONSE_START}}`、`{{PAGE_METADATA_PREVIEW_JSON}}`，它们是 Relay 预览交付协议，不是旧保存流程。

## 下一步删除顺序

1. 在 Relay 中确认 `define-report`、`report-metadata-creator`、`recall-report` 和普通问数的实际路由与生产配置。
2. 将平台新建/编辑切换到现行内容工具和统一保存用例，保留预览占位符链路。
3. 已删除旧平台 Skill、V1 架构和接入文档、旧 console script 及独立启动模块。分发测试检查安装命令和模块均不存在；不保留迁移环境开关。
4. 已迁移参数消费者至工作稿和临时产物；发布令牌存储独立保留。
5. 已删除旧候选链、专属契约与测试，替换为现行结构、参数和单次保存验证；同步契约导出与锁文件。

本表不把调查报告中的源码推断升级为生产事实。Java 资源权限、Relay 身份注入、前端预览消费和真实 CLI 接线仍须在 C0 事实冻结阶段验证。

## 已完成的内部迁移

- 结构计划只接受版本 3；旧版在查询前拒绝，装配、修订和呈现不再分支解析。结果引用输入直接使用现行章节结构。
- 参数提取、选择与填值使用工作稿/精确产物；临时模板和实例独立持久化并校验身份、轮次、有效期及摘要。旧候选存储、提交、恢复与部署包装已删除。
- 本次保留验证现行平台的 `test_platform_v2.py` 等测试；文件名中的平台协议版本不构成删除有效验证的理由。

验证：迁移后完整 Python 回归 50 个文件、387 项通过；最后补充预算与宿主模板读取后，参数/结构/发布重启定向回归 16 项通过。现行结构样例装配通过，契约与 Bundle 一致性通过。未运行浏览器或真实模型，未声明外部服务联调完成。
