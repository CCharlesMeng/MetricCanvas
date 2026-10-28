# 父子表格 main 集成验收

2026-10-28。本记录补充 [原实现验收](result.md)，其中“未推送、未合入”的结论仅对应 2026-10-27 的本地验收时间点。

## 范围与基线

- 已确认实现：`8a1332ad06962e1cda3fc6de2b89fead98cee976`。
- 集成基线：`a24c4a49173c643d8f7ebf174ad08fffd8ecaecc`，保留 main 已有的地区树筛选、旧页头迁移指导、Report 编排指导与对象记录关联排序修复。
- 集成工作树：`/Users/moon/.codex/worktrees/deliver-hierarchy-main/DataDashboard`。原实现工作树未提交的并行修改没有移入本批。
- Schema 6.70；local-authoring Skill 从 main 的 1.5.2 升至 1.6.0。生成冲突从合并真源重建；Sim 处理器保留两侧全部既有处理路径。

## 集成验证

- `pnpm check`：通过，Svelte 检查零错误、零警告。
- `pnpm build:packages`、`pnpm build:playground`：通过。
- `pnpm validate pages`：128/128 通过。
- `pnpm authoring:contracts`：1268 product、4 authoring、1 interface 同源输出；MC 可观察诊断及报表夹具重新生成。
- `pnpm mc:content:check`：最终通过，包含来源覆盖、33 项 Python 测试及派生夹具检查；首次发现旧诊断夹具漂移后已从真源重建。
- Skill 仓外完整复制：699 文件、0 软链，只用 Node.js 校验，6.70 合法页通过；降为 6.69 后三个新能力均被拒绝。副本在系统临时目录 `metriccanvas-hierarchy-main-m3ef4r9a/metriccanvas-local-authoring`。
- 真实浏览器回验使用本集成工作树的 Playground 5211 / DQE Sim 18367：URL 选上海后自动展开，父华东 1200、子上海 360；地区树改选华东后收起，手动展开共 5 个代表处；保持展开改年度为 2025 后父 960、上海 288。
- 复杂度：`metriccanvas-ts-ast/1`，TypeScript 5.9.3。唯一冲突调整的可执行函数 `executeLocalDemo` selfCC 为 3→3，无新增辅助函数；本次保留原实现函数，原实现新增函数及存量超限说明见 [完整测量](complexity.md)。Skill 仅改版本，无新增工作流分支。

浏览器原始截图 `/tmp/hierarchy-delivery-browser.png`，测试与构建日志 `/tmp/hierarchy-delivery-*.log` 是本机临时证据。生产 DQE、Relay 与生产权限仍为 NOT_RUN。远端 SHA 与对应 CI 的最终结论在交付回复中提供。

## CI 发现的非表格重绘回归

首次 main 集成提交 `81a438bd20f9bc2a28c3c049fc39517261cffb4f` 的 types、build、tests、authoring 通过；compatibility 的 508 项安装消费者浏览器测试中，506 项通过，Chrome/Edge 的同一图表降级用例失败。不能将这次 CI 描述为成功。

`componentSnapshots` 原先无条件读取 `tableRevision`，使图表也订阅表格状态修订；修订后生成的新快照输入触发图表重绘，破坏“绘制失败单次回退，输入未变不重试”的既有约定。现仅表格读取此修订状态，保留层级父行投影响应能力。使用既有 `chart-echarts-option.spec.ts` 直接复现：改动前 `a drawing failure` 在 5 秒后仍为 extended，改动后通过；同文件全部 9 项浏览器测试通过，父子表格 Schema/runtime/export 41 项回归通过，engine 类型检查通过。

同口径实测：`componentSnapshots` selfCC 2→3，内部快照回调 6→6，均不超过 15；无新增辅助函数。产品、MC、Skill 的生成输入与安装内容没有变化，`pnpm authoring:contracts:check` 复核一致，Skill 保持 1.6.0。

首次本地完整 `pnpm test` 为 3391 通过、2 项导出隔离子进程超时、4 跳过；只复跑这两项后均通过。远端首次完整 tests job 通过；本地首次结果不改写为一次全绿。
