工作项目：/Users/moon/Documents/Code/公司项目/DataDashboard。先只读读取 /Users/moon/Documents/Code/公司项目/DataDashboard/docs/archive/authoring-tickets-126/handoff/common.md 和 /Users/moon/Documents/Code/公司项目/DataDashboard/docs/archive/authoring-tickets-126/development-plan.md，再读取执行仓 AGENTS.md、领域词汇表、相关 ADR，以及 GitHub CCharlesMeng/MetricCanvas 的 #126 和本角色负责票的完整正文、最新评论与依赖。新 worktree 若没有未提交交接文件，从上述原始路径读取；保留原工作区及其他会话改动。遵循 common.md 的独立 worktree、共同基线、所有权、验收和等待约定。

你是 S2，负责本版页面协议、产品契约作者源、生成产物和统一运行时/Embed 接入。先执行 #129（T03）：依据 ADR-0051 冻结 layoutForm→layout 的版本和兼容读写规则，建立新旧文档公开校验和渲染等价证据。接受范围、双字段冲突、唯一写出和旧数据迁移必须明确，不能无说明替换 6.0。

#129 验收进入共同基线后，通知 S3 开始 #132。你执行 #131（T05）浏览器消费迁移，S3 并行迁移 Python；工作台涉及的最小修改与 S1 协调，共享 Schema/导出/生成快照由你唯一维护，S3 提供源修改需求和测试证据。

#131/#132 都验收并进入共同基线后执行 #133（T07）收口。保留已承诺的旧文档读取能力，只删除过渡内部形式；验证跨语言契约、现有四交付物和打包/支持版本门禁。把 M0 所需全部证据交 S0。

收到 M0 READY 后执行 #143（T17）→#144（T18）。#143 使 params 支持受控维度单值/多值及显式查询目标/筛选初值绑定，默认来源唯一；filters 保持页内可变，URL 只初次读取，后续筛选不被原始 params 覆盖。不新增 dimensionValues/globalParams 根字段，不扩成表达式系统。

#144 还依赖已就绪的 #128/#130：消费执行结果和精确预览、实际取值、内嵌初始行、错误结果及最后筛选记录。复用现有字段映射和错误隔离；服务端权限/参数提取权威在 Java，你验证消费契约和反例，不实现替代服务。完成后给 S0/S1/S4 发送解锁 #145 的执行/预览契约及基线 SHA。

与 #95 配合：保留现有正式渲染与创作隔离、版本门禁、Svelte 和 ESM/IIFE 消费通道；#103 真实异构消费及 #104 真实部署由原线接续。你交付适合续跑的版本产物和验证场景，不把仓外测试消费者当作真实内网验收。每次参数协议演进通知 S3 同步消费，其他会话不能手改生成物。
