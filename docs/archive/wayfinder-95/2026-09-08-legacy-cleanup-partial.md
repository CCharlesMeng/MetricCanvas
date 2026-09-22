# 旧链退出首批（#125）

依据 ADR-0074 和已推送的 `legacy/pre-static-platform-2026-09-08`，移除已核实无主线消费者的 `ioc-data-dev/`（110 个已跟踪文件）与 `packages/server/persistence-mysql/`。MySQL 包没有外部 workspace 消费者；其自有测试随旧实现留在完整历史基线，当前锁文件已移除 mysql2 及专属依赖。保留的页面协议、工作台和 Python 迁移用例继续运行。

旧 Java 的 CI job、Maven 构建、纵切和 tar.gz 交付停止；本地 Java 源码及 dev-cli 依赖尚未清理，其 README 已标明历史状态。根 README 更新私有配置模块与退场目录。当前没有新建外部 Java 服务或猜测 #105 的接口。

验证：清理后的 `pnpm test` 为 178 passed / 5 skipped 文件、1396 passed / 28 skipped 用例；`pnpm build` 的 embed、Canvas 和平台均通过。CI YAML 解析及 job 范围检查通过，锁文件无 mysql2；页面资产和 DQE 的既有浏览器回归仍在。平台产物仍为 Node，不能记作 #104 静态输出。

剩余：旧对话/会话消费，发布治理/模板/ACL，MCP/生命周期/Postgres/旧 Java 适配器，默认 dev-cli，模板播种，以及 #104 的 Node 回退消除和静态 adapter。旧 Java 适配器退场仍要求 #105 已确认接口的消费验证；公共 Chat 和页面产物接入仍分别等 #106/#107/#108。

Canvas 最终去留仍待 #102 的用户单项决策。四份并发文档保持原状，不混入本次提交。默认分支推送遭自动审批拒绝，后续需要用户明确批准确切提交后再执行。
