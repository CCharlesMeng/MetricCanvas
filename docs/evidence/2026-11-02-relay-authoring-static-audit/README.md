# Relay 创作能力报告接收与复核

接收日期：2026-11-02。Relay 报告提交：`663da7ea7f4a662f0e4bec678b7feea02951dc97`。本仓接收时 HEAD：`2133241a6b4f259fc19ff54bfdd9a0dcb9c96e06`，存在并行修改。本目录是时间点证据，不是产品契约真源或正式发行组合。

## 1. 原件与回执

- [报告原文](report.original.md)：附件逐字节复制，未修订任何结论。
- [接收回执](receipt.json)：附件来源、字节数、SHA-256 与报告自述来源。此前中断轮次的附件与本次附件字节相同。
- [报告内 JSON](tool-contracts.reported.json)：仅提取报告 JSON，不纠正其分类与 Schema。
- [当前产品实际注册](tool-contracts.mc-current.json)：本轮使用现有 FastMCP 工厂 `application=None` 离线执行 list_tools，记录完整输入 Schema 与摘要；没有加载内部 Adapter 或调用服务。
- [契约接收核对](contract-intake.json)：工具名差异、缺失引用、说明占位和可观察的结构差异。
- [Bundle 检查](check-bundle.json)：本轮现有检查器退出 0，6,464 项摘要核对通过；原始标准输出/错误另存。

原件 SHA-256：`2ad1f843c7aa360b11ce0f49ef36340f9d163b74433c0dda2ed90623083e0bf9`。

## 2. 采纳结论的证据边界

Relay 报告自述为 S/C 源码与配置取证，未提供实际注册导出、隔离探针或真实服务回执。这里将其作为**外部源码审计报告**采纳：路径和行号是可追查线索，但本轮未取得 Relay 源码字节、进程、安装目录或原始分工附件，不能写成 MC 已独立复验。

可据此推进：拆分候选、版本采用矩阵、接缝设计、兼容场景和任务分工。不得据此确认线上部署、真实 DQE 成功、保存/发布/预览成功、跨轮次隔离或 Skill 行为闭环。

## 3. 需要修正或降低等级的结论

| 报告表述 | 本轮采纳口径 | 后续动作 |
|---|---|---|
| “运行时=6.54，MC=6.77，snapshot=6.11” | 是报告根据源码读取链推导的值，尚非部署观察；snapshot manifest 不被版本读取函数使用，也不能证明 schema.json、catalog、fixtures 不参与校验或构造 | 逐文件核对真正加载的运行代码、Schema/目录/MC 和摘要；不能只改版本字面量 |
| “15 个 MCP 工具已注册、完整 Schema 可直接消费” | 静态列出 15 个入口；本仓本轮实际离线注册 9 个。报告 JSON 有 **6 处未解析引用、2 处 comment-only Schema 占位**，另用 nullable 表达空值，不能充当完整 JSON Schema/实际注册导出 | 报告 JSON 保持原样，精确兼容对账需原始完整导出；不据静态概要生成公共工具事实 |
| “add_result_component + remove_component 等于保留意图换源/补字段” | 是组件新增后替换旧组件的工作流；尚未证明组件/字段身份、列配置、位置、交互、筛选引用和共享消费者均保持 | 保留已有能力，M4 仍补受控增量接数，不以替换流程消除产品缺口 |
| §2.2 “页面先行（新建页面）” | 该例实际是 discover/query → compose，属于数据先行；新建/编辑不是策略划分标准 | 用真实起点和保留约束重新分类两策略，不能据同一工具集推导能力对称 |
| “resultRef 跨轮次复用已实现”，同时又称被 scope 拒绝 | 引用使用取决于完整 binding、元数据版本、策略和授权；同 session 的稳定 turn_id 不能证明逐消息轮次隔离 | 分别查 sessionId、requestId、runId、turnId 和 state key；需实际续轮、取消及迟到探针 |
| “per-turn 隔离”，turn_id 实为 session hash | 文件名描述了保存位置，无法单独证明同 session 不同请求的隔离 | 稳定会话键与本轮请求身份分开，沿公共 Gate 验证；不能仅换文件名后称完成 |
| “进程内 store”，后文又明确 SQLite | 对 temp_subprocess 而言，工作稿/查询/冻结提交必须由跨进程存储承载；内存和 SQLite 不是同一证据 | 以工厂实际装配为准；查询/提交读写范围、CAS、崩溃和 unknown 恢复分别核对 |
| “只发 modelSummary”，Relay 丢弃 structured_content；data-agent 分支却把完整 gzip/base64 previewJson 放进 content | 通道变量名不等于信息边界；程序产物实际依赖文件/plugin 旁路，可能有预览全文经模型的分支 | 精确产物交给可信程序读取/投递；模型保留有界摘要和引用。两种卡片单独验证，不删除仍在承载交接的 spool |
| “page_metadata_emit_preview 是唯一 Relay-extension；其他皆 public-MC” | 产品已公开 preview；Relay 卡片逻辑是对该入口的扩展。publish/list_urls/submit_body/tool_mc_* 相对当前注册是 fork 新增入口，不能直接认定公共默认工具 | 按能力和调用包装分层归属，不按报告 kind 标签自动回迁 |
| “Adapter 层完备，无需增加” | 证明有具体 Adapter 的线索，不证明当前工作副本输入、取消/恢复、程序产物交接均兑现公共 Interface | 本地 Portal/Agent 已有完整工作副本输入；报告描述的 page_metadata_id→Java 读页路径仍是接入缺口 |
| “turn_id/env/去发布逻辑统一由 MC 导出” | turn/session 派生、env→卡片风格属于 Relay；产品参数/期间/文档定义变换可由公共纯能力承担，公司接口响应转换仍内部维护 | 分别消除本层重复，不能把 Relay 特有规则搬入产品来达到单份实现 |
| “page-builder/compat 不存在” | 是 Relay 检出/部署子集的报告结论。本仓仍有 page-builder 注册和 compat 源文件，Bundle 检查覆盖它们 | 不删除产品入口；在部署清单解释是否省略，另核对是否存在悬空可达导入 |

上述不是否认报告价值，而是防止把静态线索变成实施前提。报告没有提供上游共同基线或 Skill 的完整 diff，十次提交的日志也不能还原实际行为改良；已有规则的完整迁移仍须取得作者文件/可比基线。

## 4. 本轮实际推进

1. 原件、接收摘要、原始 JSON 与本仓实际注册已落盘，来源分开保存。
2. 已将真实 Relay 报告作为迁移输入，明确哪些结论接受、哪些需补证、哪些不成立。
3. [接缝规格与首批任务](../../plan/2026-11-02-product-relay-evolution/implementation-seams-v1.md)将整包采用、工具注册消歧、轮次/工作副本、产物通道和共享分析核心拆成可实施批次。

本轮未执行 Git 交付、生成覆盖、内部安装、Relay 改造或真实服务调用。M0 的材料接收与本地对账已完成，干净 main 发行冻结和 Relay 运行采用尚未完成；M1–M6 仍按分项退出条件推进。
