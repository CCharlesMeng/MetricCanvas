# 本地预置页面

仓库根执行 `pnpm dev:assets`，再打开本地平台的 `/manage`。它使用既有开发配置中的 `127.0.0.1:8080`，只接受 `local-dev` / `developer-1` 开发身份，不改真实门户配置。

首次启动从 `pages/` 复制五个完整页面：`demo`、`sales-detail`、`tokens-report`、`flow-analysis-report`、`report-date-filter-example`。前三类包含看板、跨页明细和静态报告；后两类包含多章节查询报告及日期筛选。Tokens 和流水报告预置为发布态，其余为草稿态。查询页面使用原始快照与现有 DQE Sim；同时运行 `pnpm dev:dqe`。

页面修改保存在被 Git 忽略的 `.scratch/platform-page-assets/store.json`，重启继续保留。`pages` 原文件不改写。需要重置时先备份该本地文件，再移走它并重启服务；不要删浏览器中的未知保存或工作副本记录。

这是仅监听本机的开发夹具，支持现有目录分页/状态、当前记录读取、新建、明确保存及当前记录删除。历史目录为空，历史回退未实现；不证明真实 Java、独立发布副本或高级生命周期能力。
