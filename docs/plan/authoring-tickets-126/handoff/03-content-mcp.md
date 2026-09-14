工作项目：/Users/moon/Documents/Code/公司项目/DataDashboard。先只读读取 /Users/moon/Documents/Code/公司项目/DataDashboard/docs/plan/authoring-tickets-126/handoff/common.md 和 /Users/moon/Documents/Code/公司项目/DataDashboard/docs/plan/authoring-tickets-126/development-plan.md，再读取执行仓 AGENTS.md、领域词汇表、相关 ADR，以及 GitHub CCharlesMeng/MetricCanvas 的 #126 和本角色负责票的完整正文、最新评论与依赖。新 worktree 若没有未提交交接文件，从上述原始路径读取；保留原工作区及其他会话改动。遵循 common.md 的独立 worktree、共同基线、所有权、验收和等待约定。

你是 S3，负责 Python 内容编辑和内容 MCP。首阶段任务是 #132（T06）。先读 #129 的当前进度、当前 Python Bundle 和工具测试，准备迁移与验收；待 S2 发布已验收的版本契约且 S0 集成后再实现 #132。你只修改 Python 作者代码，产品快照由 S2 从唯一作者源生成。验证新 layout 写出、约定旧基线读取及跨语言页面校验一致，把提交给 S0/S2，解锁 #133。

M0 READY 后执行 #134（T08），再执行 #135（T09）/#136（T10）/#137（T11）。#134 需要 #128/#132：让模型表达受控意图、Python 对完整既有页面确定性修改，保留未触及内容；独立失败回滚、依赖跳过、合法成功子集可保存。内容工具不产生保存或发布副作用，完整页面和数据通过可信程序传递，模型只得到必要摘要。

优先用现有构造器走通 #134，发布工具入口、编辑结果契约和验收提交，通知 S0/S1/S4 解锁语言闭环。随后补 #135 的 text/fieldText/mapChart、#136 的 tabContainer/compositeCard/aiSummary，以及 #137 的筛选/绑定/表格链接下钻。三项可由统筹在独占操作模块下安排并行，但共享工具注册由你统一合入，不自行启动额外会话。

总目标覆盖当前全部 17 类组件，复用已有十类数据组件和 reportHeader。动态总结须有明确流式需求及有效配置；容器遵守子树限制，缺输入明确失败。手工添加、任意 JSON 路径和查询分页排序不在范围。#137 消费既有 filters/filterBindings，不另造 params 绑定；新版参数由 S2 统一定义。

与 #95 配合：按当前代码和测试复用 #89/#91 已完成的 Bundle、发现、DQE 验真及适配器，不因旧 checklist 开放而重做迁移。两 MCP 角色分离适用于本版创作入口，不把普通问数自动保存策略一并改掉。

每票通过公开 MCP/stdio、页面产品校验与代表性运行结果验证，给出未触及内容、非法操作、部分成功和无保存副作用的反例证据。完成自己的可做工作后按具体依赖等待，不抢写 Platform、生命周期 MCP 或产品生成快照。
