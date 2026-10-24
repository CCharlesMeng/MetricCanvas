# 独立筛选按钮组与旧声明迁移验收

2026-10-21。本仓实现、旧配置迁移、页面文档和独立 local-authoring 分发已完成；本地检查见下表。提交、远端 SHA 和 GitHub CI 结论另由交付回执核对，不将本地通过当作 CI 或真实服务验收。

## 输入与决策

- 基线：`13a651791cfbe05ed8f6053afce02dbfe4e9999d`；隔离检出为 `standalone-filter/DataDashboard`（managed worktree，detached HEAD），原工作区的并行修改未纳入。
- 页面协议：6.45。用户明确选择统一迁移和移除旧 `chart.props.filter`，并批准本次次版本例外，见 [ADR-0115](../../adr/0115-standalone-filter-groups-and-controlled-migration.md)。这不是零使用例外，也不授权删除其他已发布字段。
- 锁文件 SHA256：`63f17f9b6cf5abb75bdcb9217e01bdba3d12ef2578403e256beb4316376d72a0`；源码、契约和分发摘要见 [输入记录](inputs.json)。
- Node 24.11.1、pnpm 11.13.0、Svelte 5.56.6；本地 Chrome，1440/390 宽度。

## 功能到交付物

| 能力 | 页面与产品文档 | 实现与分发 |
|---|---|---|
| Dashboard 独立固定单选、一控多、带符号指标卡 | [filter-group-page](../../../pages/filter-group-page.json)、[声明与边界](../../page-metadata/components/filterGroup.md) | filterGroup Schema、组件目录、固定选项校验、统一筛选状态及 filterBindings |
| 页头条件控制筛选控件和内容各自显隐 | 同页的 scope、channel-filter、trend；[统一条件](../../page-metadata/conditions.md) | 复用集中 presentation 求值，组合自身、声明和祖先条件；隐藏保留值和查询绑定 |
| 组合卡内独立组及四类图表迁移 | [迁移页](../../../pages/chart-local-filter-page.json)、[组合卡](../../page-metadata/components/compositeCard.md) | 保留原页面 ID、筛选器 ID、default、value、查询绑定和原列跨度；组合卡按布局层提供绘图空间 |
| 旧字段诊断、布局与版本边界 | 产品契约 filter-group 正反例与扫描测试 | 旧字段明确拒绝；Dashboard 正文/组合卡之外拒绝，新成员不能绕过 6.45 门禁 |
| 文档与独立安装 | [本地创作入口](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/SKILL.md) | 从产品真源生成知识、完整样例、校验器、版本与哈希；仓外复制安装和全部契约向量等价验证 |

只有 query 的 filterBindings 决定影响范围，不按控件位置推导范围，也不维护第二份组件列表。一个筛选器只放置一个按钮组，不在页头重复展示。首批不开放动态候选、级联、多选、空选、Report 或详情视图。静态导出显示捕获的所选 label，保留同一展示投影。

## 实际检查

| 检查 | 结果 |
|---|---|
| `pnpm validate` | 62/62 页面通过 |
| `pnpm check` | 全工作区 Svelte/TypeScript 通过，无错误与警告 |
| `pnpm build`、`pnpm packages:check` | 产品构建与六包打包/入口/声明检查通过；平台保留既有体积提示 |
| `pnpm test --maxWorkers=4` | 302 个文件通过；2609 通过，5 个既有跳过 |
| `pnpm authoring:contracts:check` | 973 产品、4 创作、1 接口文件一致 |
| `python3 metriccanvas-authoring/scripts/check_bundle.py` | Bundle 0.3.1，3394 项摘要检查通过 |
| Python 创作接入与能力目录 | CI 相同的 deployment 13 项、能力目录 6 项通过；新组件明确登记为不参与数据单元自动组装、无数据编辑槽位 |
| local-authoring 仓外安装与导出隔离 | 完整 Vitest 套件包含复制 Skill 至仓外、链接闭合、全部正反例与校验结果等价验证 |
| `pnpm adr:index:check`、`git diff --check` | 通过 |
| 嵌入浏览器三套件 | 33/33 通过；包括四类迁移图表、控件状态、只读、URL、异常与迟到响应，以及 Report/Dashboard、四种容器、宽窄屏的组件呈现矩阵 |
| 实际 Playground 浏览器 | 1440/390 两项通过；切换一控多、隐藏恢复、查询范围、URL 与卡内独立组 |

本地并发回归中，一项未修改的 authoring-language 测试曾在固定 10ms 等待后读到中间状态；该文件单独重跑 55 项通过。保留原测试与产品逻辑，降低测试并发后重跑完整套件；最终结果以上表为准。

首次 CI 暴露了 Python 创作接入能力表遗漏，已补齐 `filterGroup` 声明并重新生成 Bundle 摘要。另一个失败是契约向量测试的外层 5 秒预算短于其独立进程 20 秒预算；保留全部向量与断言，批量读取输入，并将外层预算调整为 30 秒。修复后 local-authoring 20 项通过。远端最终结果以修复提交的 CI 为准。

## 可观察结果与视觉复核

1. “直营 / 加盟”同时改变订单和收入两个查询及其指标卡、趋势图，其他对照和卡内区域保持原状态。
2. 页头切到海外时，按钮组和趋势分别隐藏，指标卡继续保留原已选口径；切回国内恢复选择，不额外清空或扩大查询范围。
3. 卡内区域独立切换；重新加载 URL 后两组分别恢复。非法/多值 URL 回退默认项，查询加载、空结果和失败不移除控件。
4. 四类旧图表迁移后仍有实际 canvas。视觉复核发现的卡内画布塌缩已修复：布局层通过纯组件的 minHeights 接口保留现有图表最小高度，不新增页面像素尺寸字段；compactRing 保持既有固有尺寸。浏览器明确断言每个迁移画布高度大于 200px，不能只凭标题或查询文字判定可见。
5. 生成的组件样例保留其查询依赖的固定筛选控件，避免把固定候选误作动态候选请求；普通组件呈现矩阵单独剥离 Dashboard 专属控件与对应绑定。

截图：[实际 Playground 宽屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/standalone-filter/playground-wide.png)、[窄屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/standalone-filter/playground-narrow.png)、[迁移四图宽屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/standalone-filter/migrated-charts-wide.png)、[窄屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/standalone-filter/migrated-charts-narrow.png)。

实际 Playground 入口为 `http://127.0.0.1:5187/pages/filter-group-page`，DQE Sim 为 18328；没有替换原 5173 服务。合成数据与本地网关往返不证明真实 DQE/Relay、真实 DS 模型、线上权限或生产部署验收；这些未运行。
