# CI 与范围交付

CI 的五个独立任务使用同一 GitHub SHA、Node 24、pnpm 11 和冻结锁文件并行运行：

| 任务 | 保留的验证 |
|---|---|
| authoring | 复杂度、页面文档、中立契约、创作 Bundle、接入与单向同步 |
| tests | 项目 `pnpm test`，含 SvelteKit sync 前置步骤 |
| types | 完整项目类型检查 |
| build | 产品构建、生产/调试归档、qiankun 源码映射、包入口/声明/组件 |
| compatibility | 冻结 Git 树安装、严格 peer、构建与 tarball，仓外 Node/UI/组合消费者及真实 Chrome/Edge |

保留必需状态名 `ci`，它用 `always()` 汇总所有任务，仅在每个任务均为 success 时通过；失败、取消、跳过和缺失结果均拒绝。`tests/ci-workflow.test.ts` 检查整个 job 图与这个完成条件。

兼容性默认完整执行源码 test/check/build；CI 专用参数仅省去由同提交其他必需任务覆盖的源码 test/check。所有独立安装、消费者类型检查、构建、浏览器测试和声明/包检查保持。复用模式及证据详见 [仓外兼容性](../../tools/package-build/README.md#仓外兼容性门禁)。

兼容性产物只包含诊断摘要、日志、tarball、消费者 manifest/lockfile、浏览器结果和失败附件。`node_modules` 和临时源码工作区可由 SHA 与锁文件重建，不上传。各命令的耗时/结果进入 summary，便于后续定位关键路径。

范围交付以仓库 [scoped-main-delivery Skill](../../.agents/skills/scoped-main-delivery/SKILL.md) 为入口。独立修改尽早在隔离 worktree 实施，保存已确认范围及验证输入；提交阶段复用同输入的验收，转移基线或源码变化才重跑相关检查。

```sh
pnpm ci:wait <完整提交SHA>
```

等待器只按该 SHA 发现 CI，运行一个 watcher，再读取一次完整结论；抑制重复步骤输出。失败或取消返回非零，SHA 不匹配或未完成的 run 不会被当成成功。正常等待无需另起 `gh run view` 轮询。测试用模拟 gh 可执行程序验证命令次数、重复输出、已完成 run、错误 SHA 和失败状态。

默认交付完成点保持“远端提交已确认且 CI 已完成”。用户明确选择只 push 或异步通知时，分别报告提交和 pending CI，按授权安排后续。实际服务/部署验收与本地/CI 结果分别报告。
