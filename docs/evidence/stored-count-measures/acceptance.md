# 现成计数作为页面度量：本地验收

> 交付更新：本能力已随最新 main 基线迁移为 Schema 6.56。以下首次实施记录中的 6.52、旧基线和未提交状态均为历史快照；本次交付复验见文末。

日期：2026-10-23。隔离工作区：`/Users/moon/.codex/worktrees/stored-count-measure/DataDashboard`；基线 `ea40f6641e41e974dd3f1801c4613c5a1a7fcd45`，本次结果为其上的未提交修改。

用户确认的场景是 DQE 从 `output_dims` 返回已存储的项目数量，页面按区域直接绘制柱状图。实现 Schema 6.52 的显式数值度量映射：只允许 `number/money + measure`；不改写查询、推断角色或聚合结果行。普通查询、queryModes、timeModes、平铺/分组字段及带时间粒度的输出列使用相同能力下限。设计依据为 [ADR-0117](../../adr/0117-query-projections-and-page-measure-roles.md)。

| 能力 | 真源与可观察场景 | 分发 |
|---|---|---|
| output_dims 数值显式声明度量 | `packages/page/src/query-output-measures.ts`、`validate.ts`、`version.ts`；`/pages/stored-count-measures` | Schema 6.52、合法夹具和六个新增反例由产品导出器生成 |
| 作者声明、限制与示例 | `PAGE-METADATA.md`、`docs/page-metadata/fields.md`、`queries-and-bindings.md`、`components/barChart.md` | 产品参考、contract-snapshot、local-authoring 参考与独立校验器 |
| 精确知识 | `docs/page-metadata/reference-map.json` 中 `fields.output-measures` | 仓外主题读取同时返回 fields.core、query.core；已检查版本为 6.52 |

## 行为与浏览器

实际入口：[各区域项目数量](http://127.0.0.1:5193/pages/stored-count-measures)。Playground 监听 5193，DQE Sim 监听 18229；通过 `lsof` 核对两个进程的 cwd 均来自本隔离工作区。

启动命令：

```sh
DQE_SIM_PORT=18229 pnpm sim:dqe
DQE_SIM_PORT=18229 pnpm --filter playground dev --host 127.0.0.1 --port 5193 --strictPort
```

浏览器使用真实页面声明及本地 HTTP Sim，未替换页面查询或组件。完成以下操作，DOM 记录见 [browser.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/browser.json)，控制台错误为空：

1. 首屏四行：东区 12/9、南区 7/5、零值区 0/0、缺失区 —/3；柱图按同一行集呈现。[全区域截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/all-regions.png)
2. 选择南区，图表两根柱及明细为 7 和 5；清空恢复四行。[筛选截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/south.png)
3. 切换零值区，两个数值显示真实 0。[零值截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/zero.png)
4. 切换缺失区，项目数量保持缺失、已完成数量为 3；再清空恢复。[缺失截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/missing.png)

HTTP 回归直接读取同一 `pages/` JSON，检查 initial 与强制刷新、维度筛选、完整结果读取、实际生成的柱系列，以及请求中 output_dims 不变、output_metrics 始终为空。现成金额及数值字符串/缺失归一化在页面契约测试覆盖。数字编号保留 dimension，非数值 output_dims 不得成为 measure，output_metrics 角色约束与 collapsible 授权继续校验。

时间粒度返回列另有一次失败→修复回归：最初 `存量项目数量(month)` 的角色映射能够绕过旧版本下限；新增测试实际观察到旧版本错误列表为空，再使原始文档能力探测同时识别基础列名和期间列名。对应反例随独立校验器导出。

## 执行结果

| 检查 | 结果 |
|---|---|
| 最终 `pnpm exec vitest run packages/page/tests tools/dqe-sim/tests/stored-count-measures.test.ts tools/dqe-sim/tests/query-modes.test.ts tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/page-reference.test.ts` | 86 个测试文件、888 项通过 |
| `pnpm authoring:check` | 4 个测试文件、74 项通过，含导出隔离；与上一行有重叠，不相加 |
| `pnpm authoring:contracts` / `pnpm authoring:contracts:check` | 最终 1104 product、4 authoring、1 interface 文件生成且无漂移 |
| local-authoring 独立安装 | 整目录复制至仓外；知识/链接/哈希闭合，新页面成功，旧版本及维度 series 被拒绝；最终生成后已重跑对应测试 |
| `pnpm validate pages` | 86 个页面通过，0 失败 |
| `pnpm --filter @metriccanvas/page check` 及最终 `tsc --noEmit -p packages/page/tsconfig.test.json` | 产品源与页面测试类型检查通过 |
| `tsc --noEmit -p tools/dqe-sim/tsconfig.test.json`、`tsc --noEmit -p tests/tsconfig.json`、`tsc --noEmit -p tools/package-build` | 通过 |
| `python3 tools/scripts/adr-index.py --check`、`git diff --check` | 通过 |

## 复杂度

使用 `metriccanvas-ts-ast/1`、TypeScript 5.9.3 的 selfCC；每个函数独立测量，含闭包/回调，不把子树复杂度当作自身复杂度。明细见 [complexity.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/complexity.json)。

| 修改函数 | 前 → 后 |
|---|---|
| queryContractErrors | 9 → 9 |
| queryContractErrors.checkMappedField | 11 → 12 |
| executeLocalDemo | 3 → 3 |
| 版本表测试回调 | 2 → 2 |

新增产品辅助文件的函数最高 7；新增 Sim 文件最高 12；新增页面测试文件最高 5；新增 HTTP 测试文件最高 10。新能力 usedAt、新增契约向量回调和仓外 Skill 测试回调均已测量，最高 1。本次修改及新增函数无超限未关闭项。

同一扫描范围仍有 7 个未修改的存量超限函数，包括 parsePage（31）与 Sim 原有查询分派函数（16–39），已在机器记录中逐项列出，未作为本批重构范围。生成代码来自产品真源，未手工维护分发副本。

## 证据边界

本批完成本地协议、统一执行、HTTP Sim、浏览器和独立 Skill 验收。页面数据为明确的合成数据；尚未更新内网部署，也未执行真实 DQE/Relay、权限、真实业务行粒度或真实模型验收。本批未提交或推送，无远端 SHA 或 CI 通过声明。

## main 交付复验（2026-10-23）

交付前获取 origin/main，基线更新为 `573ee6a9875336bdd525e12179c9e98b139675db`。保留其新增的对象查询、AI 总结与创作期升级能力，本次能力版本由未发布的 6.52 调整到 6.56；产品真源合并后重新生成所有派生文件。修正两处依赖当前版本的测试/演示期望：对象查询参数迁移测试改用 versionPolicy.current，旧页面升级演示与当前写出版本一致。

- 产品与本地 Skill 回归：`pnpm test --exclude tests/authoring-export-isolation.test.ts`，324 个文件、2901 项通过、4 项跳过。该排除项单独运行，不视为免检；初轮旧版本快照失败后，另以 118 项受影响回归确认修正。
- 契约导出隔离：原全量运行中 24 项有 23 项通过；初轮并行验证出现的 2 个超时场景，经 `pnpm test tests/authoring-export-isolation.test.ts -t '无旧链时可运行|拒绝共享 Skill 作者漂移：layouts/dashboard.md'` 独立复跑后 2 项通过、其余 22 项未重跑，覆盖原失败项；重叠不相加，子进程上限仍为 30 秒。
- `pnpm check`、`pnpm build:packages` 通过；页面包在迁移断言修正后再次类型检查通过。
- `pnpm authoring:contracts:check` 通过（1130 product、4 authoring、1 interface 文件）；`pnpm validate pages` 的 89 个页面全部通过，ADR 索引无漂移。
- 在原入口重新加载合入后的页面、选择南区得到 7/5、清空后恢复四行。[浏览器记录](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/delivery-browser.json)、[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/delivery.png)。
- 新基线复杂度记录见 [delivery-complexity.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/stored-count-measures/delivery-complexity.json)：queryContractErrors 10→10、checkMappedField 11→12、executeLocalDemo 3→3、版本测试 2→2、参数迁移测试 4→4；新增函数最高12，本批无超限未关闭项。

远端 SHA 与 CI 结果以本次交付回执为准。原始混合工作区未进行暂存、清理、合并或重置；隔离工作区的预览服务仍供用户查看。本次只交付代码，不代表内网部署或真实 DQE/Relay 验收完成。
