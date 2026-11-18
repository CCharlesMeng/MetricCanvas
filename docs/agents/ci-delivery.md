# CI 与范围交付

## 每次变更的必需检查

PR 和推送到 `main` 时运行 `CI`。各任务使用同一 GitHub SHA，工作区使用 Node 24、pnpm 11 和冻结锁文件。

| 任务 | 验证 |
|---|---|
| architecture | 新增循环和跨层依赖 |
| authoring | 复杂度、页面文档、中立契约生成一致性、Skill 工具类型 |
| tests | 常规 Vitest 分三片并行，含 SvelteKit sync 前置步骤 |
| types | 完整项目类型检查 |
| build | 产品构建、Embed 逐文件体积和分包闭合、Chrome 挂载与 ES/global 接入冒烟 |

GitHub 必需状态 `ci` 汇总以上任务。失败、取消、跳过或缺失均使汇总失败。`tests/ci-workflow.test.ts` 检查两个工作流的任务归属与汇总规则。

## 定期全量和交付前验证

`CI full` 每天北京时间 02:17 针对默认分支运行，也支持手动对候选 ref 触发。它用独立的 `ci-full` 汇总严格检查以下任务。

| 任务 | 验证 |
|---|---|
| tests、types | 完整 Vitest 和类型检查，包含隔离导出、创作时序和 Skill 归档回归 |
| authoring-distribution、mc-distribution | Skill、创作 Bundle 和 MC 内容的打包、Python 回归、来源与归档回验，MC 在 Linux/Windows 独立安装 |
| relay-release、relay-distribution | 正式及历史冻结消费者回放、实际归档回验，以及 Linux/Windows 原生消费 |
| platform-distribution | 平台静态产物、生产/调试微前端归档、qiankun 源码映射、盘古配置、页面试验场回放、包入口与声明、取数 Node CLI |
| embed-distribution | Linux/Windows 原生构建及归档、挂载、ES/global 复制接入和 Webpack 5 矩阵 |
| compatibility | 冻结 Git 树、严格 peer、实际 tarball、仓外 Node/UI/组合消费者与 Chrome/Edge 全量回归，含 Tiny OS 比图 |

平台、Embed、Skill、MC 和 Relay 的 GitHub Actions 发行候选归档从 `CI full` 获取。发布前对同一个候选提交确认 `ci` 和 `ci-full`，核对结果与归档名称及来源回执内的 SHA。修复只在全量任务覆盖的场景时，也可手动触发 `CI full`。

全量工作流中的仓外兼容性使用 `--source-checks=ci`，由同一工作流同一提交的完整 `tests` 和 `types` 承担源码检查。相关命令与证据详见 [仓外兼容性](../../tools/package-build/README.md#仓外兼容性门禁)。

兼容性产物只包含诊断摘要、日志、tarball、消费者 manifest/lockfile、浏览器结果和失败附件。`node_modules` 和临时源码工作区可由 SHA 与锁文件重建，不上传。各命令的耗时/结果进入 summary，便于后续定位关键路径。

范围交付以仓库 [scoped-main-delivery Skill](../../.agents/skills/scoped-main-delivery/SKILL.md) 为入口。独立修改尽早在隔离 worktree 实施，保存已确认范围及验证输入；提交阶段复用同输入的验收，转移基线或源码变化才重跑相关检查。

```sh
pnpm ci:wait <完整提交SHA>
```

等待器只按该 SHA 发现 CI，运行一个 watcher，再读取一次完整结论；抑制重复步骤输出。失败或取消返回非零，SHA 不匹配或未完成的 run 不会被当成成功。正常等待无需另起 `gh run view` 轮询。测试用模拟 gh 可执行程序验证命令次数、重复输出、已完成 run、错误 SHA 和失败状态。

默认交付完成点保持“远端提交已确认且 CI 已完成”。用户明确选择只 push 或异步通知时，分别报告提交和 pending CI，按授权安排后续。实际服务/部署验收与本地/CI 结果分别报告。
