# report-date-filters · Alpha Tests

## 每条 AC 的可观察判定

用例及冻结判据见 tasks.md 与 dev-baseline.md。测试证据、浏览器截图与真实接缝分层记录。

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT-1 | PROVEN | 本地 CUA 浏览器 | BE-1；implemented-C-wide/mobile/320.jpg | 当前依赖哈希 | 1440 右对齐；390/320 换行，封面无覆盖 |
| AT-2 | PROVEN | 本地 TS + CUA | ts-regression；BE-2 | 当前依赖哈希 | 四形态、公历、非法草稿保留旧期间 |
| AT-3 | PROVEN | 本地 TS + CUA + MCP | ts-regression；authoring-regression；BE-3 | 当前依赖哈希 | 原子生成/复用、可信身份、确认前无控件 |
| AT-4 | PROVEN | 本地合成网关 + CUA | BE-4；export-complete.jpg | 当前依赖哈希 | 159 行、全部 Tabs、静态图表、无日期输入 |
| AT-5 | PROVEN | 本地 embed + CUA | BE-5；embed-timeout/wide.jpg | 当前依赖哈希 | 53 行、DOM/并发/失败/准备及消费取消、上限与超时清理 |
| AT-6 | PROVEN | 本地 Python/TS/MCP/类型/构建 | authoring-regression；ts-regression；contract-check；bundle-check | 当前依赖哈希 | 正式属性面板组件新增/修改/删除及非法回滚，纯函数、创作 MCP 主流程；完整平台保存和部署接缝未运行 |

## 扩散承接

契约生成要求参考手册覆盖全部读取能力，已有 6.12 字段/分支缺口阻止新增 6.13 分发。补充 reference-map 说明、合成合法组件/计算/列动作样例，以及受现行详情展示闭集拒绝的分支反例；不改变 6.12 运行行为。受影响证据纳入创作契约生成与 conformance 验证。

## 计划外承接

| 项 | 原因 | 证据 | 状态 |
| --- | --- | --- | --- |
| 6.12 手册覆盖与 Python 语义一致性 | 旧缺口阻止 6.13 源驱动分发 | conformance、authoring-regression、contract-check | 已完成 |
| 预览默认 JSON 类型边界、窄屏表格分页换行 | 既有类型错误及真实 320 窄屏溢出妨碍验收 | playground-check、BE-1 | 已完成 |

## 人工验收记录

| 项 | 记录 |
| --- | --- |
| 本轮设计批准 | 2026-10-11 用户“可以，审批通过，执行”；实现浏览器结果由本地 CUA 核验，不作为真人测试签字 |

## Deferred

| 项 | 边界 |
| --- | --- |
| 集成应用 PDF 编码器 | 用户批准的外部职责；本轮引擎只交付静态 DOM，不宣称 PDF 产物验收 |
| 真实 Relay/Java/DQE/DS 与生产 | 本地确定性主流程已验；真实服务与模型、部署不在本轮验证范围 |
