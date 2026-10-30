# partner-health 零总数显示兼容

2026-10-30，基线 `50ba76eba`。独立工作树 `/Users/moon/.codex/worktrees/partner-health-zero-total/DataDashboard`，原主工作区保持不变。用户报告内网 DQE 返回后页面无数据，并要求兼容有返回行但 `total_count: 0` 的情形；未取得内网原始响应，因此以下证明该条件的复现和修复，不宣称确认了内网全部故障原因。

## 失败与修复

使用正式 `pages/temporary/partner-health.json`，把独立 Mock 的所有 DQE 响应总数置0，业务行保持不变。首次运行 `pnpm test tests/partner-health-zero-total.test.ts`，地区部、代表处两项显示断言均得到 `error`，期望为 `ready`。严格完整读取原本抛出错误，测试按该既有接口断言拒绝。

| 现象 / 位置 | 原因 | 修复和边界 |
| --- | --- | --- |
| `health-scores-region` / `health-scores-representative` 返回错误 | `unionKeys` 的依赖计数检查拒绝零总数；对象查询跨源关联也再次执行严格计数检查 | 页面显示显式允许无窗口、声明完整结果的普通查询基于已有行计算；不改原始计数 |
| 有效行无法到达图表和表格 | SourceProgram 与浏览器 orchestrator 均会重新求值计算图 | 两个入口应用同一计算策略，避免执行成功后又被渲染阶段拒绝 |
| 零总数容易被当作已验证的完整结果 | 有返回行不能证明服务返回了全部组织 | 保留 `TOTAL_COUNT_MISMATCH` / `completeness: unverified`；并集总数仅为实际生成行数，严格完整读取不启用该兼容 |

非零总数矛盾、非法计数、请求上限、重复或非法组织键、查询失败、取消和迟到回执规则保持。对象完整导出仍拒绝矛盾计数，原始对象回执仍不能作为严格查询结果绑定输入。正式页面 JSON 和查询定义未修改，内网需更新运行时。

## 验证

- 初始业务和边界回归9文件82项通过；补充对象主源/辅助源同时零总数及结果绑定隔离后，新回归文件4项通过。覆盖两个组织粒度、15行并集、分类和总分、真实0/负数/缺项、异常计数、重复键、空结果、查询窗口、筛选取消与迟到响应。
- local-authoring、工具与页面参考3文件74项通过；与新回归同批为4文件78项。测试包含仓外复制、知识哈希和独立校验器检查。另将完整 Skill 复制到 `/tmp/partner-health-zero-total-skill.*`，正式页与 Mock 页均独立校验通过；Skill 版本1.14.1，当前基线 Schema6.77，没有新增页面字段或升级 Schema。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`；Playground check（0错误0告警）；145/145页面校验；Playground生产构建通过。
- 官方导出与一致性检查通过：1317 product、4 authoring、1 interface。系统 Python 缺 fastmcp 的首次生成失败；改用主仓已安装的项目 `.venv/bin` 后完成，没有改生成器或跳过检查。
- 浏览器 `http://127.0.0.1:5173/pages/partner-health-union-null-probe?state=zeroTotal`：地区部/代表处图表和表格均显示15个组织，第二页包含 ORG-15 与真实零值 ORG-01；ORG-03 缺项显示 `--`、总分0，ORG-06总分6；顶部中国区35切换海外30。正常场景无 console error，保留计数告警。
- `state=empty` 仍为空态且无组织行；`state=truncated` 不显示部分组织得分，当前基线表格显示“关联数据加载或计算失败，结果暂不可用。请重试。”。截图和 DOM 文本在本目录，按仓库忽略规则保留本地证据。

协议同步：`PAGE-METADATA.md`、`docs/page-metadata/compute.md`、`docs/page-metadata/data-sources.md` 与 Mock 页 README；local-authoring 知识及契约锁通过官方导出器生成。本实施验收记录形成时尚未提交、推送或运行 CI；真实业务 DQE、部署和真实 DS 模型未验收。后续提交与 CI 以对应 Git 提交和运行记录为准。

## 复杂度

使用 `metriccanvas-ts-ast/1`、TypeScript5.9.3，自身圈复杂度逐函数测量，包含回调和新增辅助函数。原始报告位于 `/tmp/partner-health-zero-total-complexity-before.json`、`/tmp/partner-health-zero-total-complexity-after.json` 及测试基线报告。

| 函数 | 前 → 后 selfCC |
| --- | --- |
| computedSnapshots / visit / collectDependencies | 2→2 / 5→5 / 9→9 |
| computeSnapshot / completeDependency | 6→8 / 8→10 |
| hasZeroTotalRows | 新增6 |
| SourceProgram.read | 11→11 |
| orchestrator.start / publish | 26→26 / 2→2 |
| Mock fetchData / fetchImpl / responseTotal | 11→11 / 5→3 / 新增4 |
| 新回归辅助函数与回调 | 全部≤3 |

存量 `orchestrator.start` 超限26保持不增长；本次仅传递显示策略，不拆生命周期函数以免扩大风险，后续治理入口为 `packages/engine/runtime/src/orchestrator.ts`。同文件 `refetch` 17未修改。无新增超限项。

## 交付基线更新

推送前远端新增 `750ccc72c` 的 embed 验收入口修复，已承接该提交。冲突仅在生成锁和摘要；保留双方源修改并通过官方导出器重新生成。local-authoring1.14.1 已被该远端提交使用，本次交付递增为1.14.2。复验零总数业务回归、独立 Skill、类型和生成一致性；主工作区并行修改不纳入交付。
