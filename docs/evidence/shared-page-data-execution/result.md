# 共享页面取数实施与验收

日期：2026-10-14。以下首次实施证据来自原混合工作区；本次独立交付验证见文末。真实Relay/DQE未部署。裁决见[ADR-0105](../../adr/0105-shared-page-data-execution-and-initial-consumption.md)，实施入口见[主计划](../../plan/2026-10-14-shared-page-data-execution.md)。

## 实现结果

- 新增`@metriccanvas/data-execution`，根入口`createPageDataExecutor({gateway}).execute(metadata)`只返回完整页面副本。内部解析参数、执行本轮查询依赖、按生效查询去重、归一化并回填原始字段initial。
- 主页面全部可执行query源取数，含其他Tab、辅助及snapshot详情；query详情按点击上下文执行。每次调用重查，Top5与初始窗口不扩大，完整辅助源核验范围。
- 成功替换，失败保留；旧initial只保留在输出，不驱动本轮下游。空上游短路并写空下游。浏览器已有initial直接使用、缺失补查；采集时间不同不强制整链重取。
- 参数填值入口清除实际条件变化影响的源及依赖下游initial。同值初始化、同条件刷新、仅展示参数变化保留数据。
- 引擎保留交互、缓存失效、取消、代次、分页和compute；旧engine根类型、DQE子路径和执行启动入口兼容。导出仍使用完整取数策略。
- Node程序`metriccanvas-execute-page`以stdin/stdout交付完整JSON，由可信配置供给绝对DQE地址与当前身份。Python创作取数及页面资产保存规则保持。
- 平台Skill新增已有页面刷新参考，未新增模型MCP工具；生成Bundle摘要与产品公开面同步。CI新增独立安装检查，配置不代表远端CI已执行。

## 实际验证

| 层 | 执行与证据 | 结论 |
|---|---|---|
| TypeScript全仓测试 | `pnpm exec vitest run --maxWorkers=2 --reporter=json --outputFile=docs/evidence/shared-page-data-execution/vitest.json`；[机器报告](vitest.json) | 1878通过，0跳过，0失败 |
| 新执行包 | `packages/data-execution/tests`，14项：参数、级联、空集合、失败保留、不以旧结果驱动、未绑定源、缺失补查、筛选失效、参数清理、延迟详情、去重、Node HTTP与嵌套映射 | pass |
| 类型 | `pnpm check`全仓通过；最后共享包和engine再次类型检查通过 | pass；Svelte诊断0错误/0警告 |
| 构建 | `pnpm build`，全部库包、Embed ESM/IIFE和Platform静态构建 | pass；既有大chunk提示不影响退出码 |
| 发布包结构 | `pnpm packages:check`，六个tarball的源码/JS/声明导出、相对导入及发布文件范围 | pass |
| 独立安装 | `node tools/package-build/data-execution-consumer.mjs`，仓外仅安装page/data-execution，Node ESM级联、外部TS消费和已安装CLI通过 | pass；不可达Svelte/ECharts/engine/UI |
| 浏览器 | Chrome Playwright：shared-data-execution、execution、inline-params、detail-views，8项通过，0失败/0flaky | pass；实际DOM及请求序列检查 |
| Python保留路径 | `PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py`，536测试通过；模型评估为scripted-no-model | pass；不是真实DS验收 |
| 分发与文档 | 本轮authoring:contracts:check曾通过，Bundle校验2214 digest checks及ADR索引/公开面通过；最后检查见下文共享工作区变化 | 本次检查曾通过；当前共享工作区契约导出被新增queryResultWhere定义阻塞 |
| 真实集成 | 内网Relay执行进程部署、当前身份接线、真实DQE、Java/门户、真实模型 | not-run；本地HTTP替身不能替代 |
| 远端交付 | Git提交/推送、远端CI、npm发布 | not-run；本次未进行 |

独立安装证据目录：`/var/folders/_7/p5v7g8bs6kb8jy5sm02lbw4h0000gn/T/metriccanvas-data-execution-consumer-hhKkHD`。HTTP测试使用本地协议形状替身与fixture identity，不是公司业务数据。

## 浏览器截图

[SDT回填首屏](browser/sdt-filled-initial.png)：首屏无数据查询，原始initial经过pivot/左关联得到代表处时长0.0及人次3。

[参数覆盖刷新](browser/sdt-parameter-refresh.png)：九月改十月后清除受影响旧initial，先查询主项目B，再用B编号取阶段，显示刷新项目。

## 首次失败与修复

- 原有“参数初始化清除所有initial”“级联无证明整链重查”“不同采集时刻不组合”测试按本次明确裁决更新；对应新正反例已验证。
- 首次默认并发全仓测试出现已有workbench语言修改时序断言失败；该文件独立55项通过，最终限制并发全仓复测通过。未修改该文件。
- 系统Python缺jsonschema/httpx，首次通用authoring:test无法完成；改用锁定依赖的项目虚拟环境后536项通过。未改变依赖锁或把缺环境记为产品通过。
- 产品构建与独立消费者打包并行导致共享临时目录冲突；改为串行后两项通过。未将构建目录加锁改造扩展到本任务。
- 全工作区git diff --check仍含此前独立本地Skill生成文件的空白问题，本次作用域差异检查通过；保留无关改动。

## 外部接入交接

Relay部署方安装本次page/data-execution版本及Node 22+，按每次调用注入绝对端点、当前用户请求头和超时，执行已填参完整metadata并接收stdout完整metadata。源级失败可退出零并保留旧initial，不能用进程退出零推断本轮所有查询成功。调用入口不自动写Java，不新增快照存储。真实接入验收分别核对身份、请求、级联、部分失败、取消/超时及返回页面实际展示。

## 共享工作区后续变化

本任务验证期间，其他任务继续修改同一工作区。新增`resultBindings.where`已进入page类型/Schema/校验及本包共享输入解析；复用的解析实现仍保持Node、浏览器和导出同源，未将其回退。其主计划记录完整生成产物在独立`codex/query-result-where`检出，主工作区分发差异保留。

最后一次`pnpm authoring:contracts:check`在`tools/scripts/page-reference.ts`报告`Unowned reference definition: queryResultWhere`；这发生在本轮原有契约检查通过之后，当前主工作区不能报告全门禁绿色。未修改该任务的生成器归属表或覆盖其独立分发产物。新增协议的分发整合由对应任务收口。

同源核心及新增where的定向回归在该变化后再次执行：6个测试文件、68项全部通过，共享包类型检查通过。全仓机器报告是该次运行时文件状态的证据，不能代表随后并行修改的所有内容。


## 独立交付验证

交付checkout：`/Users/moon/.codex/worktrees/shared-data-execution-delivery/DataDashboard`，基线`8e9b5deee9e9fae9a39366396d2ff91023882397`。本次从实施前工作区快照拆出已确认范围，并保留main后续CI优化；原混合工作区未改写。本交付不包含另一任务的6.19 resultBindings.where、自定义组件及其未提交分发产物，查询结果输入解析提取自main现行实现。

- `pnpm check`：全仓类型检查通过，Svelte 0错误/0警告。
- `pnpm authoring:contracts:check`与`python3 metriccanvas-authoring/scripts/check_bundle.py`：通过，2211 digest checks。当前独立交付不存在原混合工作区的queryResultWhere生成器阻塞。
- `pnpm build`：通过，保留已有chunk大小提示。
- `pnpm packages:check`：六个真实tarball通过。
- `node tools/package-build/data-execution-consumer.mjs`：仓外Node ESM、外部类型、已安装CLI通过，无Svelte/ECharts/engine/UI依赖；输出目录`/var/folders/_7/p5v7g8bs6kb8jy5sm02lbw4h0000gn/T/metriccanvas-data-execution-consumer-QglOjT`。
- `pnpm --filter @metriccanvas/embed exec playwright test shared-data-execution.spec.ts execution.spec.ts inline-params.spec.ts detail-views.spec.ts --workers=1`：Chrome 8项通过。
- `pnpm adr:index:check`及作用域差异空白检查：通过。

首次独立全仓测试与摘要锁生成重叠，隔离测试复制了更新前的Bundle锁，导致2项stale失败；其余1898项通过、5项跳过。锁生成及校验完成后执行`pnpm test tests/authoring-export-isolation.test.ts --maxWorkers=2`，该文件19项全部通过（95.02秒）。两次结果覆盖1900项通过、5项跳过；不称为单次全仓零失败报告。原始全仓机器报告`vitest.json`仍是首次混合工作区证据，不冒充本checkout结果。远端CI按最终提交SHA独立确认。
