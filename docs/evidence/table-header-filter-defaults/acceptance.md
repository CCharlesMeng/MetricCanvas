# 列头筛选默认选中值实施与验收

日期：2026-11-03。实现位于本任务管理的隔离工作树，基于提交 `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`；未提交、未推送、未合入主工作区。主工作区的并行改动保留。

## 已实现的声明与行为

页面 Schema 6.82 仅增加 select 叶子列的 `filterable.defaultValues`。数组保存固定字符串或有限数值原始值，空数组与省略初始不筛选；显式字段仍检查能力版本。静态 main 绑定、字段类型、重复值、字典成员、远程 queryField、数据源独占和按需组合查询的成员冲突均有诊断。日期范围、数值范围、动态引用和行内子表筛选未开放。

共用列投影下沉至 data-execution，首次有效读取前原子建立初始视图；TableSession 区分声明默认与当前状态，UI 不保存第二份默认状态。恢复的空视图、用户清空、候选缺项、列隐藏重显、组织父子表完整重置、共享完整结果本地隔离、自动页大小、initial、执行回执及冻结导出按[主计划](../../plan/2026-11-03-table-header-filter-defaults.md)处理。作者默认意图与消费者会话态的区别记录于 [ADR-0128](../../adr/0128-table-header-filter-declared-defaults.md)。

## 页面与可观察结果

| 入口 | 数据环境与观察 |
| --- | --- |
| `http://127.0.0.1:5202/pages/table-header-filter-defaults` | 内联合成6行。第一表默认待审批且数值编码1，显示A001/A003；同源第二表独立显示A002/A005；第三表 archived 无匹配，仍可取消选中项。清空和隐藏重显不补回；Excel 默认2行、清空6行、重开页面恢复2行 |
| `http://127.0.0.1:5202/pages/table-header-filter-defaults-query` | 经默认网关、同源HTTP代理和18402端口DQE Sim读取已有合成夹具。首请求携带区域=东区，第一页R001/R003，翻页保持条件；默认Excel14条，清空后28条 |

Playground 5202 的进程工作目录已核对为本隔离工作树的 `apps/playground`。浏览器未拦截或替换接口；验收期望从原始Sim夹具计算。Chrome覆盖1440px与390px、候选缺项、查询分页及实际下载的Excel；无页面异常。见[浏览器回执](browser/result.json)、[宽屏](browser/defaults-1440.png)、[窄屏](browser/cleared-390.png)、[查询清空状态](browser/query-cleared.png)。

## 检查结果

| 检查 | 结果 |
| --- | --- |
| `pnpm test --exclude tests/authoring-export-isolation.test.ts` | 437文件，3908项通过，4项按原配置跳过。随后补充单列多值默认与另一列AND的定向回归，运行时默认值套件12项通过。耗时导出隔离回归由下述skills检查单独承接 |
| Page、data-execution包类型检查；engine Svelte/测试类型检查；根tests类型检查 | 通过；Svelte无错误、无警告 |
| `pnpm build:packages`、`pnpm --filter playground build` | 通过 |
| Chrome与HTTP/DQE Sim | 11组观察通过；回执含26次实际HTTP请求，含候选、分页和完整导出请求 |
| 生成与分发 | 1359项产品输出、4项创作输出和1项接口输出从隔离产品真源生成；Schema6.82、local-authoring1.18.0 |
| `PYTHONDONTWRITEBYTECODE=1 pnpm mc:content:check` | 通过：生成一致性、来源覆盖、51项分发回归及诊断示例一致性 |
| `pnpm skills:check`及原预算定向复验 | repair类型与16项通过；authoring原运行233项通过，末项临时新版本生成90秒超时。按原90秒预算独立复验，36.75秒通过；234项均获得通过结果。见[完整命令回执](checks/skills-check.log)及[末项复验](checks/isolation-retry.log)，未提高预算、未重跑已通过项 |
| 独立local-authoring安装 | 最终归档仓外安装5项检查通过：版本、两张完整页、缺映射拒绝和精确知识读取；见[安装回执](standalone-install.json) |
| `pnpm adr:index:check`、`git diff --check` | 通过 |

最初一轮分发检查与生成发生交叉，临时副本资源失配；已丢弃该轮结论，在生成冻结后重新检查。旧示例版本、公开导出快照及知识读取预算的失败均已修正并定向复验。没有放宽测试预算、Schema或完整性校验。Python维护检查使用Bundle锁定venv，并在整个命令链设置PYTHONDONTWRITEBYTECODE=1，避免末端夹具脚本导入自身触发MC字节码防护。

## 复杂度与保留项

工具：`metriccanvas-ts-ast/1`，TypeScript5.9.3；比较相同提交基线与最终源码，逐个函数测selfCC，含回调、闭包及全部新增辅助函数。完整原始结果见[基线](complexity-before.json)和[实施后](complexity-after.json)。

| 函数或职责 | 前 | 后 |
| --- | --- | --- |
| columnDefaultPaths | 新增 | 1 |
| columnDefaultErrors | 新增 | 10 |
| tableHeaderDefaultErrors | 新增 | 1；内部闭包另测 |
| initialTableViews | 新增 | 7 |
| defaultTableView | 新增 | 1；内部闭包另测 |
| 共用tableColumnPresentation | 原运行时7 | 共享执行层7，运行时兼容转出 |
| createPageDataExecutor.execute | 12 | 13 |
| controller.local | 3 | 7 |
| controller.reset | 8 | 8 |
| orchestrate.start | 26 | 25 |
| parsePage | 31 | 31 |

全部新增函数selfCC不超过15。修改的存量超限函数start已拆出页大小纠偏职责并下降；parsePage仅接入独立校验职责、未增加分支，保留以避免改变完整有序诊断。扫描还列出未修改的refetch17和buildSkillProjections52，不将它们算作本次治理已关闭。

## 证据边界

本仓协议、引擎、合成页面、真实浏览器及模拟服务HTTP已验。真实内网DQE、Relay、权限服务、目标部署和真实DS模型均未由本批验收；没有执行Git提交、push或CI。保留该工作树与5202/18402预览服务供复核，不清理其他任务的工作树或分支。
