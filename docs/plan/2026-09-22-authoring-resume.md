# 创作架构合并续跑记录

日期：2026-09-22。接续任务 `01a0c6d0-b3e1-7682-957e-cd9f9d4572ba`。状态：源码修复与本地回归完成一批，整体仍未收口；未提交、未推送、未发布。

## 本轮落地

- 保留 5.0–5.4 读取、6.5 兼容输入和当前 6.11；未使用的中间版本拒绝读取。页面参数遵循 ADR-0088，纠正上次中断前恢复两端点引用的错误方向。
- 提取、填值、显式旧绑定迁移和运行时执行共用现行参数解析。已有旧声明不会在提取时丢失；固定原位引用不与筛选器重复控制同一查询目标；受筛选控制的旧绑定在迁移时保留。执行副本清除无法证明对应当前参数的内嵌初始行。
- 结构计划 v1/v2/v3、呈现规则、修订、查询复用和指标关联归入一套实现。取数复用 `create_query_data`，不生成临时整页；页面校验归 `pages/validation/`，参数程序交付归 `pages/parameters/`。
- 更新实际消费者、测试入口、发布契约和页面参数文档；契约及 Bundle lock 由生成器更新。历史归档未改，历史测试输入仅在测试副本适配当前接受版本。

## 验证

- `pnpm check`：全仓 TypeScript/Svelte 检查通过，Svelte 0 errors / 0 warnings。
- `pnpm exec vitest run --exclude tools/dqe-sim/tests/server.test.ts --exclude packages/engine/data-gateway/tests/dqe-http.test.ts`：165 文件通过，1494 项通过、1 项既有跳过。
- Python `unittest` 发现全部创作测试，排除下列 3 项沙箱端口测试后，536 项通过；真实参数程序与 MCP 调用包含在通过范围内。
- TS 两个 HTTP 文件共 14 项因 listen EPERM 未验收。Python 未验收项：`test_content_containers.ContentContainersTest.test_public_stdio_all_17_types_and_complete_subtree_creation`；`test_java_page_assets.JavaPageAssetPortTest.test_real_http_round_trip_over_urllib`；`test_java_page_assets.JavaPageAssetPortTest.test_unreachable_service_is_reported_as_unavailable`。
- 契约检查 current（509 product、4 authoring、1 interface）；Bundle 0.3.0 校验通过。`git diff --check` 与已暂存差异空白检查通过。
- 全仓回归后又删除未消费的旧两端点识别函数，并让显式迁移先规范化历史布局；对应 27 项专项回归与页面包类型检查通过。

## 未完成与环境阻塞

- 后续用户已清理遗留索引锁并标记 6 个冲突文件为已解决。本轮复核 `git diff --name-only --diff-filter=U` 为空，锁不存在；已暂存与未暂存差异的空白检查通过。`MERGE_HEAD=20213dd935b8698bc39d17352742ce2bf468f91e` 仍存在，尚未创建合并提交。工作区仍有未暂存修复和新增迁移文件，不应直接提交当前索引。
- 请求沙箱外运行完整 Python 回归时，自动审批服务返回 HTTP 503（审批模型服务不可用）；命令未执行。这不是安全性否决。端口测试仍需审批服务恢复后复验。
- A11 来源矩阵与 A12 显式分类 runner 已实现，最新验证见下节；完整端口与浏览器门禁仍待运行。
- 真实 Lab/DQE/Relay/Java 与工作台视觉交付未验收。本地 fixture、程序调用与 Schema 通过不能替代生产接线和视觉验收。

下一步：核对并暂存本轮修复及新增迁移文件，恢复端口测试，再完成合并审查和外部联调。


## 授权执行提交策略后的验证（2026-09-22）

- A11：新增 SOURCES.md，说明真源、派生产物、生成入口、离线副本必要性和片段/完整反例边界；ARCHITECTURE、README 增加入口。
- A12：69 文件显式分类，统一 runner 接入 `authoring:test` 及已有 CI；新增清单覆盖及漂移失败测试。rules 层 133 项通过。全量 541 项中 538 项通过、3 项端口权限错误，未默认排除任何测试。
- 全仓 `pnpm check` 与 `pnpm build` 通过。打包验证通过（四个发布包）；12 个页面文档全部通过。打包检查与页面校验使用 `node --import tsx` 运行同一脚本，避免 tsx CLI 自带 IPC listener 在沙箱中报 EPERM。
- TS 非端口回归 1493 通过、1 跳过、1 失败；失败是退役 `QueryParamReference` / `isQueryParamReference` 后公开面快照未同步。用 `UPDATE_PUBLIC_API=1` 重生成，随后以普通模式运行公开面 6 项全部通过。未降低断言；先前全量结果与本次专项结果分别记录，不伪称再次跑过全量。
- 导出检查 current（509 product / 4 authoring / 1 interface）；Bundle 1683 项摘要检查通过。
- 源码备份：`/tmp/metriccanvas-precommit-20260922-110628/` 保存 A11/A12 之前的 tracked/staged/unstaged patch 和新增文件包。
- 再次请求 `git fetch origin`，自动审批服务返回 HTTP 503（审批模型不可用），操作未执行，并非安全性否决。远端 refs 仍为缓存；未创建提交、未推送、未创建 PR，不宣称 main 可合并。

## 本次续跑审计（2026-09-22）

- 复核 `git diff --name-only --diff-filter=U` 为空；`git diff --check` 与 `git diff --cached --check` 通过。966 份 JSON 与 3125 份 Python 文件均可由标准库解析；测试清单自检 2 项通过。
- 计划中的 pnpm 门禁未能启动：pnpm 发现依赖目录需要重建，沙箱内访问 npm registry 返回 `ENOTFOUND`；请求沙箱外 `pnpm install --frozen-lockfile` 时自动审批服务再次返回 HTTP 503，未执行安装。随后 Python 创作 runner 仅能报告 `jsonschema`、`fastmcp`、`yaml` 等依赖缺失，不能作为源码失败证据。
- 暂存也未能执行：`.git/index.lock` 创建被当前沙箱权限拒绝；请求沙箱外执行同一份显式 `git add` 清单时审批服务返回 HTTP 503。故当前仍未创建提交、推送或 PR，两个明确排除的临时文件仍未纳入。
- 恢复条件不变：审批服务可用后先按本记录的显式清单暂存，再恢复依赖与端口/浏览器门禁，最后复核最终树和合并提交；不得把本次环境阻塞误报为代码或测试通过。

## 快速复核（2026-09-22）

- `gh auth status` 在沙箱外成功，GitHub Keychain 凭据可用；这只证明该命令的审批路径正常。
- 沙箱外 `pnpm install --frozen-lockfile` 曾被自动审批服务以 HTTP 503 拒绝；之后依赖目录已由手工操作恢复，当前 `node_modules/tsx` 可用。
- 新增 [`tools/scripts/manual-authoring-generation.sh`](../../tools/scripts/manual-authoring-generation.sh)：依赖就绪后直接运行生成器、Bundle 校验和漂移校验；`--check` 只读校验，`--tests` 追加 Python 创作测试。脚本不自动安装依赖、不清理工作区，也不覆盖手工改动。

## 当前续跑验证（2026-09-22 14:17）

- 依赖目录现已可用：`tools/scripts/manual-authoring-generation.sh --check` 成功，导出仍为 509 product、4 authoring、1 interface，Bundle 1683 项摘要校验通过。
- `tools/scripts/manual-authoring-generation.sh --tests` 已完成生成与 Bundle/漂移校验；Python 依赖已由手工操作安装到隔离 venv。当前完整 runner 已实际执行。
- `pnpm check`、`pnpm build` 均成功；Vitest 非两个端口测试文件共 165 个文件、1494 项通过、1 项跳过。
- 手工生成脚本现在支持 `AUTHORING_PYTHON=/path/to/venv/bin/python`，并在帮助/缺依赖提示中优先给出 venv 用法，避免触发 macOS PEP 668 的系统 Python 限制。
- 冲突文件仍为 0，`git diff --check` 与 `git diff --cached --check` 仍通过；`MERGE_HEAD` 仍存在，尚未提交、推送或创建 PR。端口测试、Python 创作测试及真实 Lab/DQE/Relay/Java/浏览器联调仍待网络与审批服务恢复后完成。
- 本次直接复跑两个被排除的 HTTP Vitest 文件，14 项全部因沙箱禁止 `listen(127.0.0.1)` 而超时，并报告 `listen EPERM`；这确认是执行环境门禁，不能归因于实现回归。
- 请求沙箱外重跑同一组端口测试时，自动审批服务再次返回 HTTP 503（模型不可用），命令未执行；仍不是安全性否决，也没有新的代码失败证据。
- 使用已安装的隔离 venv 重跑完整创作 runner：541 项中 538 项通过；剩余 3 项仍为 `127.0.0.1` 端口绑定 `PermissionError`。申请沙箱外重跑时审批服务再次返回 HTTP 503，未执行。
- 分层复核：`evaluation` 层 37/37 通过；其余非端口项全部通过，失败集合仅为上述 3 个需要本地监听的测试。
- 尝试继续暂存时，沙箱内 `git add -n -u` 也无法创建 `.git/index.lock`；沙箱外 `git add -u` 再次被自动审批服务 HTTP 503 拒绝，未执行。当前未创建提交、推送或 PR。
- 新增 [`tools/scripts/manual-authoring-merge.sh`](../../tools/scripts/manual-authoring-merge.sh)：默认按显式清单暂存并审计，保留 `ioc-data-dev/` 与 `packages/embed/single-option-check.mjs` 两个排除项；仅传 `--commit` 才创建 merge commit，脚本永不推送。


## 无沙箱续跑与发布门禁（2026-09-22 15:35）

- GitHub 凭据、`git fetch origin` 与推送 dry-run 均成功，未再遇到 503；当前环境不经过自动审批，不能据此宣称审批服务本身恢复。已有合并提交 `e495e3ab`，包含最新远端 main。
- 页面文档 12/12；契约 509 product / 4 authoring / 1 interface；Bundle 1683 摘要检查；Python 完整 541/541（包括此前 3 项端口测试）通过。
- Vitest 完整 167 文件、1508 通过 / 1 跳过（包括此前 14 项 HTTP 测试）。修复创作语言测试的固定 10ms 等待，改为等待保存入口与执行事件，保留同步锁断言。
- `pnpm check`、`pnpm build`、`pnpm packages:check` 通过；浏览器修复后再运行 `pnpm check` 通过。
- 嵌入浏览器发现并修复分组参数保存值错误屏蔽独立 URL 筛选的回归。保留旧数组显式 value 的优先级；分组参数按现行 URL 规则消费。旧示例升级到 6.11；维度参数测试改为列表，验证 URL 显式覆盖及无 URL 时保存值；指标卡白底断言与既有样式提交对齐；Tab 测量等待实际数据行。
- 嵌入浏览器 52 项：修复后整套 51 项通过，剩余报告用例修正旧白底断言后单独复验 1/1 通过。搭建画布浏览器 10/10 通过。
- 复用既有 PR #154，更新其最终范围与验证依据；远端 CI 与合入状态以 GitHub 为准。未跟踪的 `ioc-data-dev/`、`packages/embed/single-option-check.mjs` 继续保留在提交之外。
- 真实 Lab/DQE/Relay/Java 接线仍未验收，本地 HTTP 夹具与浏览器回归不代表生产验收完成。

### PR 必需检查修复

- 首轮 CI 检出浏览器测试来源摘要尚未再生成，已刷新参考索引及对应锁。
- 第二轮只剩 Bundle 锁漂移：锁中收录了 Git 忽略的 16 个 `test-harness/model-evals/local-runs/` 本地评估产物。生成器现排除该路径，保留磁盘原件；隔离导出测试默认模拟干净检出，并增加带本地产物的回归，16/16 通过。
- 再生成后契约检查 current，Bundle 1667 项摘要通过。先前 1683 是含本地评估产物的历史计数，不再作为当前交付清单。
