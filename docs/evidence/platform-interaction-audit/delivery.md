# Platform 交互审计整改交付验收

日期：2026-10-26。用户授权先提交代码并 push。交付工作树为 `/Users/moon/.codex/worktrees/platform-interaction-audit/DataDashboard`，最终基线 `9263fb54b03667cb4eb3682f967f28deda0e14c7`（`origin/main`）。原主工作区中的其他任务修改保留，未全量搬入或暂存。

## 交付范围

先行五项：P1-2 条件摘要与按需编辑、P1-3 标题与组件共用工作副本及显式保存、P2-1 页面管理对话框与页面属性分开、P2-2 目录选择定位和持续切换组件、P2-4 按需解释不可用形态。另包含浏览器验收暴露的 IocHeader 卸载后异步测量保护，及验收夹具的样式隔离。

P1-4 多步撤销/重做、P1-5 编辑/预览连续性保留专项，本批没有实现。P1-1、P2-3、P2-5 未获采纳。完整清单见[执行计划](../../plan/2026-10-25-platform-interaction-audit.md)。

迁移基于当前 main 的实现：保留表格置顶行的通用 JSON 编辑，以及图表字段/常量选项；条件控件按 `presentation` 目标划分，不能把全部 JSON 控件都当作条件。补齐当前 `tableColumn` 条件目标的业务标签及回归。验收页升级到当前 Schema 6.64，并增加表格回归组件。未新增协议字段或升级产品版本。

迁移初次基线 `29aeaceb4326792b9d0da7b56292c732de91da0f` 存在 schema-upgrade-demo 仍为 6.63 的断言失败；修正已由并行提交 `9263fb54b` 合入 main，本批基于它继续，不重复提交该文件。能力标识同步保留 main 的 `pie-legend-table`。派生契约、MC 内容和 Skill 镜像均在最新真源上重生，没有手工合并哈希。

## 本地复验

| 检查 | 结果 |
|---|---|
| `pnpm test`：12 个 Platform 定向文件，含条件、属性、工作副本、保存协调、图表与表格置顶行 | 93 项通过 |
| `pnpm test`：local-authoring-tools、local-authoring-skill、local-authoring-upgrade、page-reference、page version | 5 文件、162 项通过，包含仓外独立安装与版本/哈希一致性 |
| `pnpm check` | 全工作区通过，Svelte 0 错误/告警 |
| `pnpm build` | 5 个产品包、embed、Platform 构建通过；保留既有大包提示 |
| `pnpm authoring:contracts` 与 `pnpm authoring:contracts:check` | 1236 product、4 authoring、1 interface 一致 |
| 当前基线 `authoring-export-isolation` 的“无旧链时可运行” | 1 项通过；其余 29 项未在该定向命令中执行 |
| `git diff --check` | 通过 |

生成及涉及 FastMCP 的检查显式使用现有 Python 环境 `METRICCANVAS_PYTHON=/Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python`，未安装额外运行环境。

复杂度口径 `metriccanvas-ts-ast/1`、TypeScript 5.9.3；Svelte script 与模板函数分别实测。`savePageTitle` 5→4、`submit` 11→11、`measure` 2→3；新增主要函数最大 12，全部修改/新增函数及回调均不超过 15，无本批未关闭项。完整列表见[提交基线复杂度](delivery-complexity.md)。

## 浏览器复验

- 隔离工作台 `http://127.0.0.1:5186/flow/create?page=platform-interaction-audit&resource=resource-platform-interaction-audit`：键盘修改标题后处于未保存且已本机保护状态，`sendCount=0/infoWrites=0/assetWrites=0`；显式保存后进入已保存修订，Chat 替身记录 confirm-save。
- 目录选择表格后定位并持续显示组件切换入口。表格置顶行通用 JSON 输入 `{` 时拒绝且不修改文档，原有表格属性仍可见：[表格回归](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/platform-interaction-audit/delivery-table-properties.jpg)。
- 条件高级输入 `{` 时在对话框内解释错误，取消后表格没有新增条件：[非法规则拒绝](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/platform-interaction-audit/delivery-condition-rejected.jpg)。
- Playground `http://127.0.0.1:5187/pages/platform-interaction-audit`：初始条件文字可见，清空“区域”后隐藏，表格和其他图表继续显示：[清空后截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/platform-interaction-audit/delivery-playground.jpg)。

首次验收的摘要、基础表单、复杂条件、组件定位、管理窗口及形态原因截图仍见[首次实施记录](result.md)。页面资产、数据和 Chat 均为本地合成夹具；真实云宝、Java、DQE、Relay、门户与真实 DS 模型未复验，构建通过不代表生产部署。

Git 推送与精确 SHA 的 CI 结论以本次交付回执和对应 GitHub Actions 为准；本文随提交保存的是本地证据，不预先声明远端 CI 通过。
