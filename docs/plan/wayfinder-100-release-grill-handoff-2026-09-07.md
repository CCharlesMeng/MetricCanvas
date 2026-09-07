# #100 发布设计 grill 交接

状态：2026-09-07，用户要求挂起并在其他会话单独讨论。#100 保持 OPEN，本会话解除认领。
本轮只有部分决策已确认；发布单元与正式包名尚未裁决，不生成已完成的发布 ADR，不关闭票。

仓库：`/Users/moon/Documents/Code/公司项目/DataDashboard`。
地图：[#95](https://github.com/CCharlesMeng/MetricCanvas/issues/95)。
当前切片：[#100 引擎发布单元与公开 API 门禁](https://github.com/CCharlesMeng/MetricCanvas/issues/100)。
总体背景见 `docs/plan/wayfinder-95-handoff-2026-09-07.md`，但它是历史快照，先刷新 GitHub 状态。

## 已确认的决策

用户第一轮回复“全部 ok”，第二轮明确接受 Q6、Q7、Q8。下列无需重复征求确认。

| 编号 | 已确认内容 |
|---|---|
| Q1 | 首版支持正式渲染、创作、JS 挂载，以及必要的页面校验与数据网关接线；不承诺宿主自由使用内部组件、编排或组合布局。创作所需 `composition` 跨包接口仍纳入兼容检查。 |
| Q2 | Svelte 支持 `>=5.29.0 <6`；发版前验证最低版本和当前使用版本。当前实际已有验证是 5.56.6，5.29.0 尚缺消费验证。Svelte npm 组件交付预处理组件、JavaScript 与类型声明，消费方仍需 Svelte 编译器；JS 挂载宿主不安装 Svelte。 |
| Q3 | JS 同时交付 ESM 和普通 script/IIFE，包含所需框架、图表及样式；两种入口都验收，首版不增加其他格式。 |
| Q4 | 各交付物统一版本发布，配套内部依赖锁定同版本；引擎 SemVer 与页面协议独立。 |
| Q6 | 第一个稳定版为 `1.0.0`；提前联调可用 `1.0.0-rc.N`。稳定版之后公开接口的破坏性变更升级主版本。 |
| Q7 | 首发必须完成公开接口与类型快照、仓外安装和构建、Svelte 最低版本验证、两种 JS 加载验证、创作依赖隔离及现有 CI 检查。修复影响这些检查的真实导出/依赖/类型问题；其他重构按原票推进。已有失败也要明确处理，不能记为全绿。 |
| Q8 | 首版支持 Chrome 和 Edge，发布前分别验证并记录具体版本；Firefox/Safari 暂不纳入支持承诺。 |

## 挂起点：Q5 未决

用户先问“哪来的 7 个包”，得到来源解释后要求另开会话讨论。**没有接受七包方案，
也没有选择三包方案。** 助手此前推荐七包，只是建议，不能恢复为用户裁决。

现有七个 npm 包来自原有六包，加上 #56 新拆的独立创作包：

| 当前名字 | 当前职责 |
|---|---|
| `@metriccanvas/page` | 页面协议、类型与校验 |
| `@metriccanvas/runtime` | 查询、筛选与运行编排 |
| `@metriccanvas/widgets` | 纯渲染组件 |
| `@metriccanvas/runtime-ui` | RuntimeView 与共享布局 |
| `@metriccanvas/data-gateway` | DQE 请求与结果归一化 |
| `@metriccanvas/embed` | JS 加载与 mount/update/destroy |
| `@metriccanvas/metric-canvas` | 独立创作组件 MetricCanvas |

**仓内有七个包，不要求正式发布七个包。** 发布单元、内部源码组织和宿主支持入口是不同的决策。

已讨论的候选：

- 七包锁步发布、宿主以三个主入口消费：复用当前依赖关系，仍须整理导出、构建和类型；
  配套依赖自动安装。七包的跨包导出仍需兼容门禁，不能因未写入教程就称为技术私有。
- 收成三个正式交付物：Svelte 渲染、Svelte 创作、JS 挂载。仓内目录可保持；需把内部
  代码、资源和类型收入交付物并调整引用。创作仍依赖共享渲染，不能复制出第二套渲染实现。
- 新增一个 engine façade 本身不会减少包数或消除类型依赖；若采用，应说明其实际价值。

下一轮先讨论宿主希望如何安装、使用与升级，再定发布数量、正式包名和封装方式。
不要为了降低首次改造量自动选择七包，也不要把“看起来只有三个入口”当成已经只有三个依赖包。

## 已核验的接缝

- 七包当前均 `private: true`、版本 `0.1.0`。除 embed 外，六包从 `src` 导出且无发布构建。
  embed 已有 ESM/IIFE 构建，但 `.d.ts` 仍引用 page/runtime/runtime-ui/data-gateway，
  package.json 也保留这些 workspace 依赖。只将三个包改为可发布不能完成三包封装。
- `runtime-ui/composition` 由 MetricCanvas 与 AuthoringSection 使用；它本身不妨碍三包，
  因为可以由正式渲染包提供受控子入口。真正需要处理的是代码、资产和类型依赖闭合。
- page 在宿主的页面校验、编辑与类型中有真实消费者；data-gateway 的构造器有真实消费者。
  widgets 当前源码消费者均在 runtime-ui 内。不能按包名直接判断哪些内容可删。
- #83 的 `TextBlockLink` 已有 ComponentRenderer 消费者；`alignRowTracks` 当前不由公开
  根入口或 composition 导出。不要照旧“死导出清单”机械删除。
- runtime 仍声明 Svelte peer，但源码没有 Svelte import；这笔依赖欠账需随发布处理。
- 现有 CI 有契约漂移、Python、单测、类型与构建，没有发布 tarball 的仓外消费、API
  签名快照、Svelte 最低版本矩阵或浏览器发布步骤。现有浏览器配置只测 Chrome。
- 现有隔离、导航与创作浏览器回归可复用。公开声明报告必须覆盖类型签名与传递类型，
  只检查导出名字不够；具体工具属于实施选择，不要求用户替工程选工具。

主要代码入口：七包的 `package.json`；`packages/runtime-ui/src/composition.ts` 与
`composition-types.ts`；`packages/embed/src/index.ts`、`types.ts`、`tsconfig.build.json`；
`packages/embed/tests/authoring-isolation.test.ts`；`.github/workflows/ci.yml`。

## 不再重开的边界与新基线

- #96/#97/#98 已决：独立创作包、RuntimeView 正式渲染、无宿主样式配置、宿主加载 document
  并提供 dataGateway；引擎不新增页面仓储/身份端口，不增加自定义元素、iframe 或微前端协议。
- #99 已决并交付：请求头与 Cookie 全归宿主，本仓不新增身份适配器/用户切换器。
- #109 已交付 main：`654ba86`；共享文档对账提交 `657a6f3`。页面协议现为 **6.0**，
  `supportedVersions()` 返回 `['6.0']`；API 采用 URL 与显式参数绑定。详情见 #100 最新
  评论、ADR-0068 与 `docs/reviews/2026-09-07-url-navigation-109.md`，不得冻结旧 pageId API。
- #56 已关闭，创作隔离已交付，不等待 #55。公开面仍包含 composition 及其导航迁移结果。

## 继续讨论与归档

1. 使用 grilling + domain-modeling，先读 CONTEXT.md、ADR README 和 #100 完整正文评论；
   刷新指派与原生 blocked_by，认领后从 Q5 接续。事实由工具调查，未决选择由用户裁决。
2. 补齐发布单元/正式名称、实际产物与类型边界、协议兼容错误信息及可执行发布门禁设计。
   已确认项沿用；若新事实要求调整，显式说明原因。
3. 用户确认完整方案后，现场扫描 ADR 编号再写新 ADR，更新必要契约与基线；不要预占编号。
4. 完整答案回填 #100 评论；新增实施工作先建执行票并连接 #95 的 sub-issue 与必要 blocked_by。
   与 #102 删除、#103 真实异构集成对账。关系 API 使用 issue 数据库 id。
5. 真正完成决策后关闭 #100，重拉 #95 最新正文追加决策索引，并将本交接标记为已完成。
   **关闭的是发布设计决策，不代表已经 npm 发布或真实集成。** #103 未达到终点线继续开放。
6. 按本会话用户已授权的交付流程提交并 push 本票文档；仅提交本票范围，保留其他会话改动。

GitHub 使用 `gh --repo CCharlesMeng/MetricCanvas`；macOS 的网络 gh/git 从开始使用沙箱提权。
本票不直接执行 npm 发布。本地交接可能尚未提交，新工作区可从 #100 的挂起评论恢复全部要点。
