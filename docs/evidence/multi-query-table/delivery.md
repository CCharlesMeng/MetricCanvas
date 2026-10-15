# 多查询表格范围交付（2026-10-15）

目标为 `origin/main`，交付基线 `25f7340dd5b295414cfede6a5ecfd02b44bf5bef`。交付分支 `codex/multi-query-table-main`，独立检出 `/Users/moon/.codex/worktrees/multi-query-table-delivery/DataDashboard`。提交及远端 SHA 以本文件所属 Git 提交和交付回执为准。

从开工快照提取本次增量，在远端已交付的共享执行、6.19 where、6.20 查询窗口、6.21 表格工具区和试验场目录上合并；保留远端动态版本策略及带符号格式族。未引入原混合工作区中未交付的 customBlock，也未改动平台打包和无关文档。原工作区不切换、不暂存、不覆盖。契约与完整 Skill 从交付检出重新生成；早期实施截图和日志属于此前混合检出的历史证据，以下是交付基线上的复验。

本次包含 6.22 组合查询源、统一 SourceProgram/QueryRunner、TableSession 与表格/导出控制器、纯计算迁移、TS Node Bridge、Python 装配、协议及 Skill 分发、双排名页面、固定排名 Sim 及验收规则。仅通过显式文件清单暂存。本次 Git 交付不包含部署或真实 DQE/Relay 验收。

| 验证 | 结果 |
|---|---|
| `pnpm test` | 226 文件；2016 通过、4 跳过（共2020） |
| Python 完整 harness | 535 项完成，1 项跳过；无真实模型调用 |
| Python 规则复测 | Bridge 路由与 Python 校验路径分离后，153 项通过 |
| `pnpm check` | 全仓 TypeScript/Svelte 通过，Svelte 0 错误/0 警告 |
| 浏览器 | 双排名、跨源范围、搜索/导出、共享执行和 where 共11项通过 |
| `pnpm build:packages`、embed build、`pnpm packages:check` | 通过 |
| `pnpm validate` | 19/19 pages 通过（不包含未交付的自定义组件页面） |
| `authoring:contracts:check` | 631 product / 4 authoring / 1 interface 当前 |
| Bundle | 2349 摘要核对通过，未携带未交付自定义组件知识 |
| Radon 6.0.1 复杂度 | 15 个模块、358 个函数，最高15，超限0 |
| 真实 DQE/Relay | NOT_RUN；保持原预检和执行步骤中的环境阻碍 |

交付检出修正两项门禁问题：浏览器合成网关的数值过滤改用类型收窄；Python 公共校验入口独立路由到产品 Bridge 或既有 Python 路径，使新增路由不挤占既有函数的复杂度上限。校验语义及排名口径不变。

首轮 CI `38676235261` 的 compatibility 在加载新增浏览器用例时失败：消费方缺少 `packages/data-execution/tests/fixtures/offices.json`，尚未进入该场景的断言。补充到既有消费方资产复制白名单；按真实复制清单在仓库外建立资产目录，新增用例的两份 JSON 输入均闭合并可解析，脚本语法检查通过。产品代码、协议及页面未改变，完整安装消费方以补充提交的 CI 为准。
