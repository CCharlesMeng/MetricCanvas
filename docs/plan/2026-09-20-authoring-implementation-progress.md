# 页面创作架构实施记录

日期：2026-09-20。基线为交接时已有工作区，保留此前方案、结构计划、页面参数与格式等未提交修改；未 reset、清理、提交或推送。开工时 tracked diff 备份位于 `/private/tmp/metriccanvas-before-implementation.patch`。

依据：[最小流程](2026-09-20-authoring-minimal-flow-and-skill-plan.md)、[模块架构](2026-09-20-authoring-module-architecture.md)、[Relay 影响](2026-09-20-authoring-relay-impact.md)。

## 第一批：真实复用接口与批次规则

实现：

- 从 compose 抽出独立查询执行用例，保留现有规格、版本、源描述、字段核对和错误语义。该用例返回程序执行结果，不对模型开放业务行。
- 章节装配直接构造数据源；新增图表直接构造数据源与组件；删除临时整页装配与页头拆取。
- 新旧 MCP 入站直接调用共同 compose 应用用例，不再以旧 MCP 工具作为内部业务调用。
- 暴露明确组件构造接口，替换跨模块私有函数导入；未把可渲染、可构造、可编辑三种能力强行合并。
- 同步与异步编辑共用批次规则，集中验证 ID、操作 Schema、前置依赖、回滚、完整页面有效性及 partial/unchanged 状态。
- 保留单组件新增的原 full-row 布局及 baseRevision 页面一致性检查。

本批不是模型协议切换：旧工具名、候选存储和保存策略继续服务现有消费者，普通问数没有自动保存。

## 第二批：Platform v2 单份工作稿与工具内保存（接手时已在工作区）

本会话开工时工作区已存在该批实现，此前未记录在本文；下列内容为本会话读码与整轮测试核对后的描述，不代表本会话编写。

- `application/platform_authoring.py` 为五个业务入口的用例：read / discover / query / compose / edit，外加程序侧 `recover` 与 `preview`。
- `work/state.py` 持有每轮单份工作稿、预算与 compare-and-swap 版本竞争；`assets/drafts.py` 冻结提交内容后只发一次，恢复只读取冻结记录、不重发。
- `delivery/preview.py` 区分 `document` 与 `previewJson`，产物用精确 `artifactRef` 关联，保留 `{{RESPONSE_START}}` 与 `{{PAGE_METADATA_PREVIEW_JSON}}`。
- `data/query.py`、`data/results.py`、`data/semantic_catalog.py` 提供受授权的有界证据与结果引用；`pages/referenced.py` 按结果引用装配与局部编辑。
- 入站 `adapters/inbound/platform_mcp.py` 与组合根 `platform_server.py`，存储 `adapters/outbound/platform_state.py`；协议说明 `contracts/authored/platform-v2-protocol.md`；v1 Skill 冻结在 `skill-compat/platform-authoring-v1/`。

## 后续依赖与明确未完成项

1. P0/P1：真实 Lab 语义摘要访问、详情身份映射、实际 Tokens 请求与响应贯穿对账；不能用其他指标详情补单位。
2. P2：受身份与版本约束的结果引用、模型证据投影、共享预算、独立查询注册面。当前查询内核仍消费兼容 Page Build Spec，不是目标纯取数协议。
3. P3/P3a：合并新建模型入口，结果引用装配与编辑，单份工作稿、冻结提交快照、工具内单次保存及恢复迁移。
4. P4：正式 Skill 与工具 Schema、安装资产整体切换；现有 Skill 不提前调用未注册工具。
5. P5：真实模型轨迹、页面业务与视觉检查、Relay 工作台交付验收。

Relay 的 compose_page_result 注入实现、edit 关联、卡片替换协议尚未取得；本批没有修改或验证真实 Relay/Java 部署。保留 `{{RESPONSE_START}}` 与 `{{PAGE_METADATA_PREVIEW_JSON}}` 的目标约束。源码测试只能证明本仓行为，不证明外部接线或保存回执。

## 验证

本批新增 `test_shared_authoring_capabilities.py`：取数不装配页面、章节/新增组件不造临时整页、入口不创建兼容 MCP Server、同步/异步 partial 与 unchanged 一致、失败数据操作隔离、跨页基线拒绝。

- 完整创作测试：454 项通过（29.846 秒，含本机 HTTP 与 MCP stdio 测试）。初次运行暴露两处随模块迁移需要更新的测试引用，已迁移；回环端口测试需在沙箱外运行。
- 最终非法输入保护补充后，新增能力测试与原 compose 回归共 21 项通过（0.219 秒）。
- 使用现有生成器 `node --import tsx tools/scripts/export-authoring-contracts.ts` 更新派生产物；导出检查为 481 product / 4 authoring / 1 interface。
- Bundle 完整性检查、`git diff --check` 通过。完整测试日志：`/private/tmp/metriccanvas-implementation-tests.log`。
- 未进行真实模型、Lab、Java 或 Relay 联调，也没有以测试夹具替代业务/视觉验收。
