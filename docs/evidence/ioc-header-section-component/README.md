# IOC Header 分区组件：实现与验收

2026-11-02。Schema **6.81**，独立 local-authoring **1.18.0**。实现基于 main `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`；本记录冻结于提交前；Git交付结果以包含本记录的提交及对应远端CI回执为准。

## 实现

- `sections[0].components[0]` 使用普通 `id/type/layout/props` 组件结构；每页最多一个，span固定12，跨满实际列轨；允许同section正文。其他位置、嵌套、背景、半宽及混写旧根字段拒绝。
- `packages/page/src/header-binding.ts` 统一识别声明、来源及原始路径。IOC模式来自新组件或旧根级IOC，不能由旧工具栏是否可见推断；隐藏不改变页级输入、只读、筛选认领或候选门禁。
- ComponentRenderer复用现有IocHeader；RuntimeSection提供无卡壳、全宽布局。紧凑吸顶通过同一实例在运行时内部定位，保留页面样式作用域；显隐与卸载清理浮动层和控件弹层。
- 默认导航放在整个首分区之后；自定义sectionsContent仍整体调用一次，新文档按声明传递分区，旧文档回调正文参数不增加虚拟分区。
- 静态导出复用组件入口；新Header按条件和既有分组展开规则导出。旧根级仍导出，旧工具栏仍不导出。旧根级兼容分区不参与作者的新声明，也不写回历史修订。
- 显式升级搬迁合法旧根级IOC，保留原分区条件、确定性避冲突id及原件；旧工具栏的Region/返回/导出不等价时明确blocked，不猜数据或上下文。
- 画布标题编辑处理props.identity.title；日期编辑处理props.filterIds，固定宽度不能被普通缩放改坏。新页面无声明不补工具栏。
- 旧非法文档的结构校验联合从同一产品Schema派生，避免新分支改变旧有序错误列表。没有维护第二份字段规则。

新增一个组件判别值，业务属性净增0，作者开关净增0；根字段仍供兼容读取，新作者示例写组件。DQE请求、数据源、分页、结果关联和approver-name绑定均未改变。

## 页面与浏览器

预览运行于保留的 `/Users/moon/.codex/worktrees/approver-params-delivery/DataDashboard`，端口5189已核对进程cwd。正式源与生成物在干净工作树 `/Users/moon/.codex/worktrees/ioc-header-section/DataDashboard`，不包含之前临时调试页或其来源指纹。

- [混排、权重列轨及显隐](http://127.0.0.1:5189/pages/ioc-header-section-placement)：选择团队乙，隐藏/恢复首分区，标题与URL保留B。
- [分组](http://127.0.0.1:5189/pages/ioc-header-section-groups)：Header跟随概览隐藏；页级导航仍可切回。
- [紧凑吸顶](http://127.0.0.1:5189/pages/ioc-header-section-sticky)：滚动、下拉与回顶保持单实例。
- 定制、ShadowRoot、嵌套滚动及导出驱动：`/preview?prototype=ioc-header-component`。

`PLAYGROUND_BASE_URL=http://127.0.0.1:5189 node apps/playground/tests/ioc-header-component-browser.mjs`：**15项通过，页面异常0**，详见[browser.json](browser.json)。[宽屏](placement.png)、[窄屏](narrow.png)。

商务决策id2只在原预览工作树回放：新Header及两行响应正常显示。与原候选逐项比较dataSources/filters/params/strictURLInputs及页头属性一致，仅移动组件外壳和版本；不提交用户原始响应，不将回放称为真实DQE验真。

## 验证

干净工作树执行：

| 检查 | 结果 |
| --- | --- |
| `pnpm check` | 全工作区类型/Svelte检查通过，0错误、0警告 |
| `pnpm test --exclude tests/authoring-export-isolation.test.ts` | 435文件；3905通过、5按原配置跳过 |
| 隔离导出定向复验 | 4项通过、其余27项未选；覆盖基线、模型产物、作者文件保留、私有Adapter/工具Schema |
| `pnpm validate pages` | 163/163通过 |
| `pnpm build:packages` | 五个产品包构建通过 |
| `pnpm authoring:contracts` | 从干净真源生成1409产品、4创作及1接口文件 |
| `pnpm mc:content:check` | 生成一致性、完整来源覆盖、52项Python测试及诊断夹具检查全部通过 |
| 仓外独立Skill | 整目录复制后版本及三个新页校验通过，含权重列轨；见[回执](standalone-skill.json) |

另在预览工作树执行 `pnpm skills:repair:check`：工具类型检查及16项CLI/独立发行回归通过。正式安装目录由产品真源再生成；没有调用真实DS模型。

首轮全量测试在开发中捕获旧目录/计数断言及未收口来源摘要，均已修正并在上述最终范围复验。完整隔离导出矩阵不计入“3905通过”；本批对相关四项单独复验，不把测试选择跳过当成全矩阵成功。

旧契约差分：166个旧合法样例无新增拒绝；457个旧非法向量除原“未来6.81”现已合法外，有序type/path/message保持（支持版本文案增加6.81）。见[差分](legacy-differential.json)。

## 复杂度

口径 `metriccanvas-ts-ast/1`、TypeScript5.9.3；覆盖57个TS/JS文件及提取的Svelte脚本，包含新增辅助函数、闭包和回调。新增函数自身CC最高10，无新增超限。模板新增回调另核对，不把脚本AST当成模板覆盖；分支行为由浏览器和回归验证。Python测试方法用Radon6.0.1独立测量，新增最高2。详见[明细](complexity.json)。

| 相关函数 | 前 → 后 selfCC |
| --- | --- |
| `iocHeaderErrors` | 7 → 8 |
| `resolveTexts` | 19 → 6 |
| `parsePage` | 31 → 23 |
| `timeExtensionErrors` | 61 → 55 |
| `editReportDate` | 42 → 38 |
| `RuntimeSurface/run` | 48 → 48 |
| 新 `resolveHeaderBinding` / `mapIocHeader` | — → 8 / 3 |

剩余存量超限：parsePage、timeExtensionErrors、editReportDate已下降但未完全拆至15；run仅替换IOC声明读取，异步候选与会话流程保持，未扩大重构。后续按既有复杂度计划继续处理。扫描命中的未修改函数不算本批新增问题；生成脚本以真源而非压缩产物测量。

## 边界

本地实现、静态校验、合成浏览器、响应回放、独立分发与真实部署分别记录。内网须先部署支持6.81的引擎，再使用新组件JSON；集成应用的返回上下文、真实DQE和实际部署采用版本未在本批验证。保留旧原件及旧根级兼容读取。下方result.json中的Git状态是提交前验收快照，不代替后续交付回执。
