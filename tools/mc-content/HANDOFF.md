# Relay 接线与验证

本目录为独立 MC 内容与程序包，不是可直接启动的平台 MCP 服务，也不内嵌渲染引擎。Python >=3.12、Node >=22 和 scripts/requirements.txt 是运行依赖；完整平台工具服务、可信身份/工作上下文、DQE、Java 保存与 Relay 预览 Adapter 是外部前置。平台 wheel 是单独交付物，不能当作本目录的安装替代。

调用样例（可信程序执行，不添加模型参数）：将本目录 scripts 加到 Python 模块路径，导入 mc_content.query_content/compile_layout/inspect_assembly/inspect_schema/upgrade_page。先 verify，按 index 页定位，再用 knowledge/table.width 或 tool/edit_page 的 includeSchema/pointer 读取。模型只取得有界知识与检查报告；完整 artifactEnvelope 继续留在程序通道。

并发关联由调用程序记录 requestId、编译原始输入、compileInputSha256、原样 inspectionSpec、artifactRef/ref/binding 和完整产物 SHA256。inspect_assembly 可接收 correlation（见 README）；省略则 correlation=not_run，不把绑定/字段检查冒充并发关联验证。MC 内容哈希与源码树身份见 manifest、runtime/source-identity；实际引擎/工具源码及构建摘要由部署提供，targetVersions 只检查传入字段。

替换整包后启动新进程或完整重载模块，禁止旧内存代码混用新资源；旧 spec 与新内容明确拒绝。Relay 需单独验证：tools.py/加载器注册与权限、可信上下文注入、结构化双通道、并发/重试关联、热重载、预览精确引用、标记替换/卡片注入、真实 DQE、保存、渲染和回执。此处是调用说明，不是已完成这些部署验收的证明。

Skill 保留采用、模板选择、用户确认与交付决定。MC 不提供批准/豁免状态，不改变既有保存工具行为。

包内 `examples/program-call.py` 是已运行的独立调用样例，可验证编译输入、原样 spec 和产物摘要关联；它不依赖或假设 Relay SDK。`runtime/source-identity` 锁公共构建输入（产品源码、公共 Python、MC 作者源、生成器、例子、契约和依赖锁）的相对路径/SHA256，排除内部 Adapter。外部 release 记录同时给 Git 基线、是否未提交、内容和归档摘要；只有完成提交与实际部署后才能补相应固定 SHA/部署结论。
