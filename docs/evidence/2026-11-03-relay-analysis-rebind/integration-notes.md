# A 线集成接缝

来源树：`/Users/moon/.codex/worktrees/relay-analysis-rebind/DataDashboard`，基线 `2172df5450a09803685773ae5bc65df766168c98`。`source-manifest.json` 为唯一 A owned 源码 allowlist，包含旧 A28 中仍存在的文件、新位置及本轮增量。先验 SHA 再复制；按 `remove` 删除旧六个作者模块，不复制整个目录。

- `metriccanvas-authoring/core/page/` 归 A；`core/presentation/` 及公共 `field-resolution` 下沉归 B。B 依赖快照只用于本地验收，不属于 A owned；以 B 最终 manifest 为准。
- `tools/scripts/mc-content-page.ts` 中 `inspect` 导入需改成 `../../metriccanvas-authoring/core/page/inspect`。此共享文件由主控修改。
- `buildInputSources`/reference-map 纳入独立 authoring core、各 Node 入口及已用产品规则；清除旧 `packages/page/src/authoring` 引用。按产品真源重新生成；禁止手改哈希。
- 独立 Skill 投影增加 `['local-authoring-association', 'associate-data']`。入口 `tools/scripts/local-authoring-association.ts`，官方构建函数 `localAssociationOutputs(root)` 复用现有 `localValidatorOutputs` 和许可捕获。不能在目标端构建，不引入 Python或运行时 npm 安装依赖。
- 根开发依赖 `ajv: ^8.17.1`，实际锁定 8.20.0，由主控合并 package/lock；A 本地已通过正式 offline install，未靠 core/node_modules 或其他工作树 node_modules 软链。
- `authoringPageProgramOutputs` 合并旧 `OPERATIONS` 与新增 `page.analyze`、`page.rebind`、B `page.presentation`。旧描述值保持。A 的 `extensionSelfTests()` 为固定正反例，只在构建时准备当前字节/Schema 身份；不能自动录制新的期望状态。
- 两个原时间跨进程用例仅将默认 5 秒预算改为 20 秒：requires-context 与 month-boundary；不改变断言。合跑前失败耗时约 5.95/5.78 秒，单独原预算 17/17 通过，month-boundary 实测 4.928 秒；主控另已确认 6.82 秒超时堆栈。
- 页面协议字段增减为零。主控将新增文档 `docs/page-metadata/authoring-analysis-rebind.md` 接入 PAGE-METADATA、reference-map 与 local 同源知识；新场景 `/pages/authoring-analysis-rebind` 及 README 已在 manifest 内。

Node 程序不读取真实结果库、不授权、不发请求、不保存；Relay 拥有真实结果/queryRef 核验、权限、CAS、Java 保存与未知状态恢复。本轮交付不含 commit/push、CI、部署或真实 Relay 成功声明。
