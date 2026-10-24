# 统一页头合并验收

日期：2026-10-20。用户决定：将 DashboardToolbar 的能力并入 IocHeader，后续保留一个页头实现。实现基于 main `616d20a9a25860695ac2233062b1c58113113799`，随后快进至 `97e87e11df51a2e724db48515e55f827933a2c29`，保留其 IOC 示例目录组织。本批为未提交本地改动，协议 6.41。

## 实现与入口

唯一运行路径为 `RuntimeSurface → IocHeader → FilterBar`，删除 DashboardToolbar 组件及其专属分组实现。旧 dashboardToolbar 字段保留兼容读取，经过私有适配接缝进入同一页头；新页面声明 iocHeader。

| 能力 | 完整页面或夹具 | 结果 |
|---|---|---|
| 标题、返回、行内布局、更多筛选、候选失败重试 | `/pages/ioc-opportunity-list` | 一个页头，前四项常驻、六项收纳；失败后重试恢复 |
| 普通布局、既有页面业务内容 | `/pages/ioc-project-overview` | 原页面迁移到 iocHeader，查询与组件内容保留 |
| 紧凑吸顶、说明、窄屏筛选行内部滚动 | `/pages/ioc-opportunity-analysis` | 1440/1024/390 均不撑开页面；窄屏说明换行 |
| 仅选年份、自然年查询、URL 恢复、未来年限制 | `/pages/dashboard-period-filter` | 只显示一个年份框，无模式切换；2024 对应 01-01 至 12-31；未绑定查询不刷新 |
| 只读包含更多筛选，程序写入也受约束 | `packages/page/fixtures/contract-valid/unified-overflow-header.json` | 浏览器及状态行为测试通过 |
| 旧四模式、旧只读、旧紧凑元数据 | 既有 dashboard-period-filter 系列契约夹具 | 兼容读取和浏览器回归通过 |
| 非法字段及版本门禁 | unified-header、period-modes 六组正反契约 | 空列表、重复、默认冲突、非 period 使用、页头冲突、旧版本均拒绝 |

未新增公开页面，仍为 52 个。开发预览为 `http://127.0.0.1:5196`。Playground 启动与操作见 [pages/README](../../../pages/README.md)，协议说明见 [page](../../page-metadata/page.md)、[filters](../../page-metadata/filters.md)、[PAGE-METADATA](../../../PAGE-METADATA.md)。本地创作 Skill 的知识、完整正反例、结构范式、独立校验器及哈希从产品真源导出，同步为 6.41。

## 已执行检查

| 命令或范围 | 结果 |
|---|---|
| `pnpm test` | 284 文件通过，2486 项通过、5 项跳过 |
| 合并后四个聚焦测试文件（consumer fixture closure、page header、filter groups、responsive） | 11 项通过 |
| `pnpm check`、`pnpm build` | 全仓类型/Svelte 检查与构建通过；构建保留既有大包提示 |
| 最新 main 目录变化后的 `pnpm --filter playground check` | 0 error、0 warning |
| `pnpm validate` | 52 页面通过 |
| `pnpm authoring:contracts:check` | 931 product、4 authoring、1 interface 文件一致 |
| `python3 metriccanvas-authoring/scripts/check_bundle.py` | 3266 digest checks 通过 |
| 全仓测试内的 local-authoring 独立安装测试 | 仓外复制后知识链接、索引、哈希、正反页面校验通过 |
| Python 创作工具复杂度检查 | radon 6.0.1，15 文件、368 函数、最大 15，无超限 |
| 源码 Chrome：ioc-header + period-filter | 10 项通过 |
| 源码 Chrome：embed + navigation | 40 项通过 |
| 源码 Chrome：unified-header | 1 项通过 |
| 六个真实 tarball 的仓外安装消费者 | Node ESM 协议与四个完整页面通过，Chrome 41 项通过 |
| 实际 Playground 合成数据浏览器 | 一个页头、更多筛选重试、三档宽度、单年查询、URL 正反边界通过 |
| `pnpm exec vitest run tools/dqe-sim/tests`（新增期间页夹具后） | 12 文件、78 项通过，未知条件及倒置日期继续拒绝 |
| 实际 Playground → Vite 同源代理 → DQE Sim HTTP | 无浏览器响应替换；切换 2024 年返回完整年，未绑定查询只执行一次 |
| `git diff --check` | 通过 |

源码检查先发现并修正了旧断言版本、编辑器删除筛选后遗留的 iocHeader 引用、窄屏紧凑模式撑开页面。上表记录修正后的成功结果。仓外安装脚本最初将 macOS `/var` 与 `/private/var` 等价路径误判为工作区链接，改为双方 realpath 比较后重新完整打包、安装与验收成功。

## 复现与证据边界

启动本工作树 Playground（端口 5196）后运行：

```sh
node apps/playground/tests/unified-header-browser.mjs docs/evidence/unified-page-header
node docs/evidence/unified-page-header/reproduction-installed.mjs
# 另一个终端启动本地 Sim，再验证日常直接访问路径：
DQE_SIM_HOST=127.0.0.1 pnpm sim:dqe
node docs/evidence/unified-page-header/reproduction-sim.mjs
```

前者使用真实页面并注入合成 DQE 响应，固定时钟为 2026-10-20；输出 [results.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/unified-page-header/results.json) 与截图。后者重新构建六个包，打包安装到仓库外，检查无工作区链接并执行浏览器测试；输出 [installed-result.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/unified-page-header/installed-result.json)，安装目录在该结果中记录。

日常访问期间页原先触发 DQE_SIM_UNSUPPORTED_QUERY；补齐严格按 entry + amount/unbound_amount 识别的合成期间夹具，两种测试宿主共用该响应。Sim 浏览器验证输出 [sim-result.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/unified-page-header/sim-result.json)。它证明本地代理/Sim 往返，不代表真实 DQE 验收。

截图：[普通页头窄屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/unified-page-header/list-390.png)、[紧凑页头窄屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/unified-page-header/compact-390.png)、[年份选择窄屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/unified-page-header/year-390.png)。静态导出沿用同一页头并展开全部条件，紧凑模式不裁切静态条件和说明。

本批只验收本地源码、Chrome、合成数据、仓外安装及 local-authoring。真实 DQE、Relay、CloudIOC、门户、DS 模型、Edge、CI 和部署未运行；本地通过不替代这些集成验收。未提交或推送。

## 用户授权交付后的补充检查

用户随后授权提交并合入 main。本次提交已无冲突地接到最新 main `187b9c996bd5523889d740acb74e9826b1ae727e`，保留其目录返回状态功能。补跑含目录状态、日期编辑、页头、期间、版本门禁、消费者夹具和 Sim 的 10 文件 44 项测试全部通过；Playground 类型检查、契约生成一致性及实际页面的合成浏览器/本地 Sim HTTP 往返再次通过。`pnpm packages:check` 六个包的声明、入口、相对导入和 Svelte 组件编译检查通过。此前页头源码及安装消费者输入未改变，其结果继续有效。推送与 CI 最终状态以远端提交及对应运行结果为准，以上“未提交”等表述保留为当时本地验收快照。
