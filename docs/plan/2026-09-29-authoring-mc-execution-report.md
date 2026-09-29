# 9235/9236 反馈：MC 侧执行报告

日期：2026-09-29。状态：主批次 M0–M7 已实现，本地验收完成；内部采用与生产集成未执行。

对应[批准的执行计划](2026-09-29-authoring-mc-execution-plan.md)。实现基线为 `1641ca049b4f4d6f4a9548e01187ef76c2f28808`，代码仍在当前工作区，未提交、推送或发布。本文只记录 MC 侧结果，不把公共模板变更当成内部 Adapter 已采用。

## 实现结果

| 批次 | 已完成行为 | 主要位置 |
|---|---|---|
| M0 | 冻结 20/21/41 行、完整/缺行/未知总数、别名、轮次与进程隔离的专项验收面 | `test-harness/fixtures/execution-improvements.cases.json` |
| M1 | 固定事件标签与阶段耗时；日志处理器异常不影响业务；指纹覆盖真实 import 文件 | `work/diagnostics.py`、`data/metadata_session.py`、`scripts/deployment_fingerprint.py` |
| M2 | 公共模板读取共享 55 秒期限、最多 3 次 HTTP；仅瞬断重试；补取超时保留已成功模型；取消传播；快照总等待期限生效 | `examples/adapter_template/firstparty/dataset_metadata_http.py`、`data/metadata_session.py` |
| M3 | 装配验证使用已授权的完整程序行；模型样本仍有界；完整性相关组件移除不完整 initial；增加 resultComplete/sampleTruncated 区分 | `data/results.py`、`pages/referenced.py`、`pages/composition/page_structure.py` |
| M4 | 规范名优先；歧义别名返回明确错误及有界候选，该项不执行 DQE；同批合法请求可继续 | `data/data_context.py`、`data/executable_units.py` |
| M5 | 私有工作状态记录自动口径说明所有权；移动、删除、来源变化后维护，合并重复说明；人工文字保留 | `pages/scope_annotations.py`、`pages/platform_authoring.py` |
| M6 | 修订总量卡、唯一 match、完整性、精确字段、标题/章节和量级差异指引；专项真实模型与页面复验 | 公共 Skill、`test-harness/model-evals/` |
| M7 | 重新生成 lock；契约、分发与实际 import 校验；隔离部署副本升级/回退演练；采用说明 | `bundle.lock.json`、`EXECUTION-IMPROVEMENTS-2026-09-29.md` |

表中路径均相对 `metriccanvas-authoring/`。另外修复 MC 浏览器验收脚本过时的 SvelteKit 导入，使其使用当前 standalone Vite 配置，并支持本次完整性夹具。

执行中发现并回归修复了一个原有隔离缺口：compose 为读取失败结果做局部处理而使用 `usable=False`，同时绕过了当前查询政策检查。现将“允许读取未就绪结果”独立为 `allow_unready`，仍检查消费政策。专项测试先复现跨政策消费成功，再验证修复后拒绝且不保存。

## 隔离与兼容性

- 未删除 trusted binding 字段，未放宽跨轮次、身份、工作区、版本、精确请求授权、CAS 或未知保存状态保护；未新增进程内全局元数据缓存。
- 多进程测试使用真实独立 Python 进程、SQLite 和本地 HTTP，覆盖同键并发等待与 HTTP 计数、进程重启、binding/source identity 各维度变化、迟到 owner、取消、杀进程后的租约接管。杀进程用例主动推进存储的过期租约以避免等待 62 秒，不宣称测得真实租约时钟耗时。
- 未修改内部 `tool/metriccanvas_authoring/adapters/`。升级/回退演练逐文件核对 27 个内部文件，状态库 sentinel 保留；公共本地补丁冲突时零写入，重复同步为 no-op。
- `scopeAnnotations` 仅为工作记录可选私有字段，不新增页面 Schema 或 StateStore Interface。新轮/历史页面没有所有权记录时保留原文，相关变更提示 `SCOPE_NOTE_REVIEW_REQUIRED`；不会靠文本猜测删除。人工改写后退出自动维护。
- coverage 只添加输出字段，保留原 complete/truncated 的模型证据覆盖含义。totalCount 未知仍未知，不用 len(rows) 伪造完整性。
- 公共模板不是生产配置。升级需排空活跃轮次，公共 Tool、Skill、契约配套安装；同步不是在线原子切换。回退保留状态库及未知保存的 frozen submission/operationId。

## 验收证据

证据根目录：`/tmp/metriccanvas-mc-9235-9236.PJjKQW`。该目录为本机临时证据，需长期保留时应另行归档；本文没有将其写入公共 Bundle。

| 层 | 结果与口径 |
|---|---|
| 无模型预检 | preflight.json 通过，modelRequests=0，9 个实际工具 |
| 确定性主流程 | scripted/ 六个标准 create/edit 场景通过；三个完整性 scripted 探针通过 |
| 公共测试 | 最终完整回归 501 项，51.984 秒，OK；覆盖 rules/adapters/delivery/evaluation 全部 58 个文件，无跳过 |
| 真实 DS | deepseek-v4-flash；六个标准场景和三个完整性探针在修订后的分批运行中全部通过；不是单次六场景全绿，也不是生产 Java/DQE/Relay 验收 |
| 页面与浏览器 | 完整 41 行页面、复杂报告两份真实模型产物，经本地 HTTP 重开，1440/640 两种宽度通过，报告 errors=[]，各 5 次 DQE 调用 |
| 人工截图核对 | 41 行页面表格与比例一致；640 宽度饼图切片多、标签较密，适合作为完整性探针，不作为高可读性设计范例。复杂报告量级不同的序列分图，所查概况/区域/模型截图未见内容溢出或重叠 |
| 平台静态检查 | svelte-check 0 errors / 0 warnings；平台测试 TypeScript 检查通过 |
| 分发与指纹 | 生成契约 current；Bundle 0.3.1 的 1671 digest checks 通过；本地实际 import 全匹配，bundleDrift=[] |
| 内部真实集成/CI/部署 | not-run；未提交/推送，未触发 CI，未连接内部生产服务或发布 |

真实模型原始运行与复验记录如下，失败记录保留：

| 运行 | 模型调用 | Tokens | 用例结果 |
|---|---:|---:|---|
| [model](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model/report.json) | 24 | 560775 | create-report ✓、create-dashboard ✓、create-complex-report ✗、edit-report ✓、edit-dashboard ✗、edit-add-data ✗ |
| [model-complete](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-complete/report.json) | 6 | 143095 | create-report ✗ |
| [model-truncated](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-truncated/report.json) | 8 | 198389 | create-report ✓ |
| [model-unknown](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-unknown/report.json) | 6 | 143001 | create-report ✓ |
| [model-complete-v2](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-complete-v2/report.json) | 5 | 122402 | create-report ✓ |
| [model-complex-v2](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-complex-v2/report.json) | 5 | 134569 | create-complex-report ✓ |
| [model-edits-v2](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-edits-v2/report.json) | 25 | 548522 | create-report ✓、create-dashboard ✓、edit-report ✓、edit-dashboard ✓、edit-add-data ✓ |
| [model-truncated-v2](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-truncated-v2/report.json) | 6 | 144598 | create-report ✓ |
| [model-unknown-v2](/tmp/metriccanvas-mc-9235-9236.PJjKQW/model-unknown-v2/report.json) | 6 | 144556 | create-report ✓ |

首轮 complex 存在标题不匹配、纯文字章节与量级压平问题；后续两个编辑场景受同一次 600000 token 预算阻塞。修订 Skill，并将已有标题评分要求显式写入测试任务，再拆分真实模型运行。首次 complete 探针误将 20 行模型样本当成程序结果缺行；补充 resultComplete/sampleTruncated 和数值示例后复验正确生成饼图。没有降低完整性、授权或页面评分门槛来获得通过。

最终源码相较真实 DS 复验只增加了恢复期限保留成功模型路径和同源口径说明去重，已由专项测试及最终完整回归验证；没有再次花费真实模型调用重跑这两个确定性分支。

浏览器首次执行因验收脚本仍导入已移除的 `@sveltejs/kit/vite` 失败，修正为当前 Svelte Vite 插件与实际 aliases 后重跑通过。最终回归首次误用系统 Python 3.14，缺少 jsonschema 等依赖导致装载失败；该失败保留于 harness-release.log，随后使用仓库 Tool 虚拟环境完整复跑，不将环境失败计为测试通过。

## Relay/内部采用要求

详见[公共采用说明](../../metriccanvas-authoring/EXECUTION-IMPROVEMENTS-2026-09-29.md)和 [Relay handoff](../../metriccanvas-authoring/RELAY-HANDOFF.md)。需要内部配合：

1. 定向采用公共元数据模板逻辑，保留内部认证、端点与投影；不能整目录覆盖内部 Adapter。
2. 确保可信轮次与共享持久 CAS 跨 oneshot 稳定；身份/撤权来自可信上下文与授权，不能靠重复 HTTP 偶然发现。
3. DQE 传递真实 totalCount 与分页事实；补足 name/caption/返回列及单位币种契约证据。
4. 部署方负责日志收集；真实 14 秒时延仍需 Relay 启动、装配、基线核对、DQE、保存与交付分段数据。本次没有给出生产提速百分比。
5. 发布时使用未来实际公共提交 SHA 做同步预览、安装与指纹核对。演练的 candidateFixtureCommit 只是临时 Git 仓库的候选快照，不能当成可发布提交。

## 未实施的候选批次与工作区边界

C1 显式排序输入扩展仍需 Authoring 输入与授权摘要设计；C2 币种补足需要真实治理事实；C3 revision 0 接受规则需要 Java 保存契约。三项依照原计划作为独立候选保留，未暗中默认 CNY、补时间维度或放宽保存。

本轮没有修改同期其他任务的 IOC 文档、RuntimeSurface、compute、table-state 及对应测试；这些共享工作区变更保留，未混入 MC 公共分发。浏览器与平台检查反映执行时共享工作区，不能当作仅本补丁的隔离 CI 结果。

## 最终校验记录

- [最终测试日志](/tmp/metriccanvas-mc-9235-9236.PJjKQW/harness-release-venv.log)：`PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py`，501 tests，OK。日志最后的 UNSUPPORTED_SKILL_PROTOCOL 是验收中的预期拒绝分支，modelRequests=0。
- `pnpm authoring:contracts` 后执行 `pnpm authoring:contracts:check`：510 product、4 authoring、1 interface 文件 current。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：1671 digest checks 通过。
- `python3 metriccanvas-authoring/test-harness/run_tests.py --check`：rules=14、adapters=7、evaluation=1、delivery=36 文件，清单无遗漏。
- `git diff --check`：通过；内部 adapters 路径无 tracked diff。
- [本地实际导入指纹](/tmp/metriccanvas-mc-9235-9236.PJjKQW/deployment-fingerprint.json)：bundleDrift=[]，所有检查模块 matchesBundle=true；该证据明确为 dirty 本地工作区，不代表内部部署指纹。
- [最终同步演练](/tmp/metriccanvas-mc-9235-9236.PJjKQW/sync-rehearsal.json)：升级 29 写/0 删，回退 23 写/6 删，27 内部文件逐字节保留；候选临时快照 `a351c5dec94bd9e9f074825ff0e8fd75e1a5fc28` 未发布。
- [完整结果浏览器报告](/tmp/metriccanvas-mc-9235-9236.PJjKQW/browser-complete-v2/browser-report.json)、[复杂报告浏览器报告](/tmp/metriccanvas-mc-9235-9236.PJjKQW/browser-complex/browser-report.json)：均 ok=true，1440/640，errors=[]。
