# 下一任务：DeepSeek v4 flash 真实模型行为评测

用户2026-09-15明确授权：先收尾GitHub交付，再自动启动新任务，使用已配置的DeepSeek v4 flash评测。此授权覆盖本次2–3例校准和14例首轮，不扩为多模型或三次重复批次。DeepSeek是受测模型，执行任务的Codex模型不作为被测模型替代。

从包含PR #148的最新main创建独立worktree；产品基线7f998ba8407fd0b988bb6252c05a30b5c80b7c08。先读取common.md、development-plan.md、执行仓AGENTS/CONTEXT/ADR、#126完整正文与最新评论、platform-skills-evidence.md，以及metriccanvas-authoring/test-harness/model-evals/README.md和platform-authoring.cases.json。原工作区及其他任务改动保留。

范围：查找用户已配置的DeepSeek v4 flash入口与准确模型ID，仅输出非敏感配置与可用性结论；不打印凭据，不将其写入GitHub、日志、产物或模型上下文。配置缺失时报告具体缺口，不静默换模型、不安装新的替代服务。真实API调用使用用户现有配置，凭据仅运行内存。先2–3例校准（创建、精确局部修改、澄清/缺基线），确认真实模型工具调用与trace可审计，再跑14例首轮。记录实际模型ID/参数、Skill/工具/基线SHA、token/调用次数/耗时；接口未提供费用则标未知，不编造金额。限制工具循环与输出，持续限流/鉴权失败或异常消耗应停止并交接，不无限重试。

本地直连允许测真实模型+现有Skill+生产内容工具；外部边界使用受控夹具必须显式标注，不能宣称真实Relay注册/路由/身份、Java持久化或DQE联调通过。不得把手工选择Skill当真实Relay路由正确；分项记录已测与blocked/inconclusive。不要让模型转抄完整页面；基线、token、完整产物和diff由可信程序处理。是否需新增运行器先检查现有实现，不重做确定性工具。

每例保留隔离会话、实际工具名和参数、模型答复、状态、产物hash及前后diff，原始trace留受限本地目录；可提交脱敏摘要和可复现脚本。按现有expected逐项pass/fail/inconclusive/blocked，关键违规单列，不擅自定准确率门槛，不把失败重跑覆盖首轮。校准可满足同条件首轮时明确复用，不重复计入分母。失败先归因模型/Skill/运行器/外部环境，产品修复先向S0交接，不擅改其他角色模块。

文件所有权：本任务维护metriccanvas-authoring/test-harness/model-evals/内评测脚本、用例状态/报告，以及docs/archive/authoring-tickets-126/model-eval-evidence.md。不得改公共契约、生成物/锁、Skill正文、产品模块或S0专属coordination.md。未必要新增文件先说明职责。提交作者/证据SHA和消费基线给S0验收，未经本任务额外授权不关闭#126/#95、不改外部服务、不联系提供方。无可执行路径时留下具体缺口和可复制续跑说明，结束有界等待，不承诺后台自动续跑。
