# MC 内容包补全实施与验收

日期：2026-10-24。本文件记录 Git 交付前的本仓实施与本地验收；用户随后已授权提交并推送 main，实际交付 SHA 与 CI 以 Git 和 Actions 回执为准。真实 Relay 部署未验，保留指定工作树和原交接文档。

## 逐项收口

| 主计划项 | 状态 | 证据与范围 |
|---|---|---|
| G01 | 关闭 | 33 模块、155 主题、2032 节点、完整语义/规则/例子同源投影。 |
| G02 | 关闭 | knowledge/node/完整参考/布局/场景均有入口；保留父约束、未展开引用和继续指针，超预算不截断。 |
| G03 | 关闭 | 9 个工具 inputSchema 与实际 FastMCP.list_tools 对账，含外层参数、请求分支、$defs；完整示例按该 Schema 校验。 |
| G04 | 关闭 | 原 Platform Skill 173 段有归属与 MC key；参数/编辑/数据流程保留采用与确认，技术参考从 MC 单向投影。 |
| G05 | 关闭 | 分母来自产品输出图、reference-map、注册工具、能力和原工作流清单；自洽漏类、失路由等反例失败。 |
| G06 | 关闭 | 完整数据上下文说明/Schema/例子、发现/查询字段规范及 31 份创作契约入包；URI 引用可离线定位。 |
| G07 | 关闭 | 19 组件逐项说明 renderable/assembled/data_editable、形状、同源例子及例子能力下限；IOC 自动装配仍不支持。 |
| G08 | 关闭 MC 范围 | 产品组件遍历涵盖 Tab/组合卡/详情视图；多槽、筛选分支和依赖源沿 Schema 扫描；不宣称计算业务语义或未声明意图验真。 |
| G09 | 关闭 MC 范围 | 编译输入/计划摘要及可选 requestId，原样 spec/产物摘要关联；缺可信关联 not_run、错配拒绝。Relay 并发交接另验。 |
| G10 | 关闭 MC 范围 | 公共构建输入树、产品/创作锁、内容和归档摘要分开记录；实际引擎/工具部署身份仍 not_run。 |
| G11 | 关闭 MC 范围 | 独立覆盖/查询/注册/迁移/安装回归和真实产品引擎回放；evaluate 的部署项继续 not_run，不作为完整性证明。 |
| G12 | 关闭 | 包内 README/HANDOFF、声明依赖、授权状态/实际第三方许可证和可执行调用样例；不把平台 wheel 当 MC 包。 |
| G13 | 关闭 | 从同一内存产品图构建并验证派生物后写出；发包先验证暂存树，再确定性归档。不是文件系统事务或运行时激活器。 |
| G14 | 关闭 | 公共源码白名单；内部 Adapter 源码/错误不进入公共 MC 身份；独立变更回归验证。 |
| G15 | 关闭测量项 | 完整安装与冷 CLI 测量，查询/检查按需加载；代码替换要求重载，缓存不成为流程状态；Q7 未冻结 SLA。 |
| G16 | 关闭 | authoring:contracts/check 同步生成和检查；CI authoring/build 纳入覆盖、回归、归档和引擎回放；local-authoring 仍独立安装。 |

W1–W6 已完成本仓职责。W7 已提供随包 HANDOFF 与独立运行样例；实际 Relay 注册、可信上下文、并发/重试、重载、程序/模型双通道、精确预览和标记替换/卡片注入仍由 Relay 对接。Skill 保留采用和流程决定，MC 没有新增保存准入状态。

## 实际检查

维护命令使用 `/tmp/mc-content-completeness-venv`（按 tool/requirements.lock 安装，额外 Radon 6.0.1），通过 PATH / METRICCANVAS_PYTHON 选择；MC 仓外运行使用另建的 `/tmp/mc-content-runtime-only`，仅安装包内 scripts/requirements.txt。

| 命令 / 验证层 | 结果 |
|---|---|
| pnpm authoring:check | 5 文件、175 测试通过；含 local-authoring 独立安装、旧页与隔离导出。 |
| 最后构建输入身份调整后的定向导出隔离 | 5/5 通过，另 25 未在该次定向运行；覆盖无旧仓、漏字段、仅语义变更、工具/内部 Adapter、真实语义新 minor。 |
| pnpm mc:content:check | 生成无漂移、独立覆盖、30 Python 测试及实际诊断夹具一致性通过。 |
| pnpm test tests/mc-content-coverage.test.ts | 6/6 通过；可检出生成器漏选整类、未路由模块、不可达布局、工具分支丢失、新组件未声明。 |
| pnpm validate | 93/93 页面通过。 |
| pnpm exec tsc --noEmit -p tests/tsconfig.json；pnpm --filter playground check | 通过；Svelte 0 error / 0 warning。 |
| python metriccanvas-authoring/scripts/check_bundle.py | 通过，5692 摘要检查。 |
| 公共 Python 固定复杂度门禁 | Radon 6.0.1，15 文件、368 函数，最大 15、超限 0。 |
| pnpm --filter playground exec playwright test mc-content.browser.ts --workers=1 | 3/3 通过，运行该工作树 5183；5173 是主检出，没有拿来背书。 |
| MC 最小 Python 环境 + 仓外解包 | 只安装 scripts/requirements.txt，fastmcp 不存在；verify、知识查询、compile/inspect/关联与实质图表筛选迁移通过。 |
| git diff --check | 通过。 |

浏览器检查：1440/390px 诊断表与排序；经营/用量 Report 显示 50 和 20→30；6.0 升级页保留三地区值与排序；6.44 图表筛选经产品迁移后在 /preview 真正渲染四类图表，点击“海外”产生新的订单范围请求。最后一项使用现有 DQE Sim（合成数据），不能代表真实 DQE/权限验收。截图保存在本工作树 apps/playground/test-results；本轮新增机器原始报告留本地，Markdown 为交付摘要；既有三个诊断 JSON 夹具随生成器更新，继续参与一致性检查。

旧页：产品可读与可迁移分别返回；原始字节/SHA256、existing-dir 拒绝、未知/未来版本、能力下限、6.5/6.6 数组参数、6.13/6.14 页头人工语义均有回归。隔离下一 minor 加入实际可选字段语义，旧页检查/迁移/目标校验通过，原字节不变；未修改本工作树产品 Schema。

## 内容与来源身份

- 内容版本：`1-ebf417635014c58b`。
- 内容 SHA256：`ebf417635014c58bbfa4d967e2eaf9da543ce72f7ac98593deef949595da43a5`。
- 包内 1754 个受摘要保护文件（另有版本清单），来源覆盖 1150 产品项 / 31 创作项。
- 本地归档：`/private/tmp/mc-content-delivery.tar.gz`；SHA256 `7ce0f35dc9209a2a2488b47c5bb5fc65ff9a4861b464203360ca63e5e744d869`。
- Git 基线仍为 6f471f0230b276d5d217e74f8b278c79fc8f732d，detached HEAD；release 标明 uncommitted=true，并锁公共构建输入树，不能当作已提交/远端交付。
- 两次独立暂存归档 SHA256 相同，仓外最小依赖验收使用上述同一内容版本。
- 平台 Python wheel、引擎安装和 Relay 是外部交付物；本包未声称已部署它们。仓库没有总许可证授权声明，包内如实说明，保留实际捆绑依赖的许可证。

## 完整链路耗时

以下性能测量对应交付格式修订前的 `1-996b02a783f7f567`。提交前仅修正生成许可证在无第三方依赖时的末尾空行，并更新构建身份摘要；最终包重新通过 MC 检查、仓外最小环境调用与旧页迁移、两次确定性归档，未重复性能测量。

参考环境：macOS-26.6.2-arm64-arm-64bit-Mach-O，Python 3.14.7、Node v24.11.1；独立最小 Python 环境。安装 1755 文件、19034901 字节；输入 1058789 字节、10000 inline 行。每项 30 个冷进程；p95 为样本排序统计，非生产 p95。期间没有本任务其他长检查并行。

| 操作 | 中位数 ms | 观察 p95 ms | 最大 ms |
|---|---:|---:|---:|
| verify | 128.1 | 135.2 | 139.0 |
| knowledge | 121.7 | 126.9 | 127.6 |
| schema1MiB | 371.9 | 377.8 | 388.3 |
| migrationDryRun1MiB | 346.1 | 356.1 | 357.2 |
| migrationWrite1MiB | 350.6 | 362.9 | 381.9 |

另保留并发测试负载下 10 次测量：检查观察 p95 2134.8 ms，迁移 dry-run 1789.6 ms、写出 544.5 ms。负载可显著影响尾部，不能只引用空闲样本作承诺。

检查 1 秒 / 迁移 2 秒仍为候选，未冻结为 SLA；没有性能准入或运行时保存门禁。CLI 包校验 + Node 产品程序在测量内；网络、模型、Relay、真实 DQE/保存/预览、引擎渲染耗时不在内。迁移 benchmark 分别测独立 dry-run 和写出，不规定使用者每次三连运行。

## 复杂度及外部剩余项

详见 [逐函数测量](implementation-complexity.md)：metriccanvas-ts-ast/1（TypeScript 5.9.3）与 Radon 6.0.1，全部新增 helper/回调/闭包分别检查；本批新增/修改函数 CC <= 15。buildSkillProjections 的函数体未改，存量 CC=52 保持，未关闭；无外部 CodeCheck 复扫。

尚未完成：真实 Relay SDK/tools.py 注册与部署验收、实际引擎/工具产物身份、可信上下文/并发交接、重载、真实 DQE/权限、Java 保存/预览、标记替换及卡片注入。真实 DS 模型不在本次默认范围，未追加。CI 配置已接入；上述本地验收时尚未提交，远端 SHA 与真实 CI 结果须在 Git 交付后另外核实。
