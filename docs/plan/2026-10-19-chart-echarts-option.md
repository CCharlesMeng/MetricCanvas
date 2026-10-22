# 图表 ECharts 隐含透传：讨论结论与实施主计划

更新：2026-10-19。状态：**P0–P6 本地实施、分发与完整验收完成。** 产品实施、场景、文档与 Skill 已同步；[验收证据](../evidence/chart-echarts-option/result.md)已落盘。用户随后授权提交并推送 main；部署不在本批范围。

决策真源：[ADR-0110](../adr/0110-hidden-echarts-presentation-options.md)。本文件是唯一执行入口，就地更新任务和证据，避免另起同主题分稿。

## 1. 已确认讨论

| 决策 | 最终结论 |
|---|---|
| Q1 隐含的含义 | `props.echartsOption` 正式纳入协议；面板不展示，AI 默认不主动使用；完整高级文档与独立 Skill 可查阅 |
| Q2 透传职责 | 补充呈现，保护数据、系列结构、坐标系和点击行身份；不支持完整图表接管 |
| Q3 代码执行 | 只接受 JSON，允许 ECharts 模板字符串；不执行函数、函数字符串或表达式 |
| Q4 覆盖优先级 | 同一允许路径透传优先，包括显式模板；布局与导出必要约束最后执行 |
| Q5 数组合并 | 对象递归合并；series 按 `props.series` 声明序补丁；轴补充已有项；普通数组替换，不能借空数组删系列 |
| Q6 几何与导出 | 允许 grid 边距作为输入，引擎保留防裁切修正；导出冻结动画、去掉缩放并展示完整范围 |
| Q7 校验范围 | JSON + 产品保护规则 + 实际异常；不维护完整 ECharts Schema，不保证发现静默忽略的未知属性 |
| Q8 首批范围 | barChart、lineChart、pieChart；mapChart 延后，gauge 等其他组件不新增入口 |
| 后续修正：保留降级 | 扩展失败后清理实例，用基础配置回退一次；基础也失败保留标题和容器、绘图区留空 |
| 后续修正：诊断渠道 | 所有本能力诊断仅 console；不新增页面文字、toast、tooltip 或失败按钮文案；校验器仍返回完整结构化错误 |
| 导出失败 | 导出视图降级或基础绘制失败就终止 PDF/PNG，不下载文件；只向 console 输出原因 |
| 编辑生命周期 | 普通编辑保留；跨类型清除并 console 提示，撤销恢复；透传子树不参与页面文本引用解析 |

曾讨论但已撤回的方向：取消降级、在图表原位显示错误、在页头显示图表导致的导出失败。不得在实施时按早期回复恢复这些行为。页面文档中的配置也不能因降级被删除或修改。

## 2. 当前实现证据与改动理由

以下是 2026-10-19 工作区的静态核对，不是新功能已完成的证据。

| 当前落点 | 事实 | 实施要求 |
|---|---|---|
| `packages/page/src/schema/components/charts.ts` | 三类图表 props 均 strict，类型从 Zod 推导 | 正式增加可选 JSON 对象及版本能力，不能只在组件里接未知字段 |
| `packages/engine/widgets/src/components/*-chart/options.ts` | 数据快照与属性被确定性翻译成 option | 保留基础构造，新增共享合并，不复制三套透传规则 |
| `bar-chart/options.ts` | `seriesEntries` 按 stackOrder 重排 | 补丁按源声明索引匹配，再随同系列绘制 |
| `shared/EChart.svelte`、`shared/chart-presentation.ts` | 几何派生与 setOption 不在统一异常处理内；负责尺寸、销毁、点击、静态导出 | 捕获范围须覆盖构造、合并、几何与应用，而不只是 setOption |
| `page-param.ts`、`filter-text-value.ts`、`text-value.ts` | 文本引用按对象形状递归扫描 | 精确排除三类组件的 `props.echartsOption` 子树；不能全局按同名键跳过 |
| `RuntimeSurface.svelte` | parsePage 失败会直接展示错误列表 | 新选项错误仍拒绝，但只 console/结构化返回；不能漏进 invalid 页面分支 |
| `report-view.ts`、`ReportHeaderView.svelte` | 导出读取 DOM 错误标志；Surface catch 会赋页头可见错误 | 新增可识别的图表错误分类，在截图前独立检查，并绕过该类可见提示 |
| 平台 `document-edit.ts`、Python `component_editing.py` | 切换类型会重建 props；普通编辑通常深复制保留 | 明确清除与 console 影响记录，复用撤销事务；同类型不清除 |
| `tools/scripts/export-authoring-contracts.ts` | Schema 派生文档、契约与独立 Skill | 从隔离检出的产品真源生成，不手改派生文件 |

另有现存饼图问题：`pieOption` 会过滤缺失数值，但点击仍按原始 `rows[dataIndex]` 映射，缺失行夹在中间时可能错行。把“扇区生成与点击使用同一有效行投影”作为 P2 的前置修复，直接验证本能力承诺的数据身份不变量，不扩展到无关图表重构。

## 3. 推荐实现形态

### 3.1 两个纯模块与现有绘图入口

- 页面协议侧新增 `packages/page/src/chart-option.ts`（拟定）：JSON 与保护规则、系列/轴数量规则、错误分类和精确 JSON Pointer。页面协议包不依赖 ECharts 运行时代码或完整 ECharts 类型树。
- widgets 侧新增 `packages/engine/widgets/src/shared/chart-option-extension.ts`（拟定）：无副作用合并、声明序映射、诊断上下文；不负责查数据、页面状态或展示错误 UI。
- 在私有 `EChart.svelte` 的既有生命周期内增加三图使用的惰性构建入口，把生成、合并、frame 和 setOption 纳入同一次尝试；地图及其他现有消费者继续走原 option 路径。具体内部参数在 P2 冻结，不把 ECharts 实例或新绘图 API 暴露到集成应用。

不要序列化基础 option 来“深复制”：内部合法 formatter 函数会丢失。合并不修改基础对象；回退时重新生成干净的基础配置。点击回调与 ResizeObserver 仍由原绘图入口管理。

### 3.2 输入与合并规则

```json
{
  "echartsOption": {
    "legend": { "bottom": 0 },
    "series": [
      {},
      { "lineStyle": { "width": 3 } }
    ]
  }
}
```

此片段只表示第二个已声明折线系列的补丁，不是完整页面。完整合法样例在 P5 放入 `pages/` 并由验收直接消费。

1. 仅对象、数组、字符串、有限数值、布尔和 null；根必须为对象。JS 调用入口同样拒绝函数、undefined、循环引用及非 JSON 实例，不能先 stringify 后把非法值丢掉。
2. 对象递归合并；叶值替换。null 是显式值，不发明“null 删除属性”的另一套语法；受保护的对象/集合位置不允许用 null 绕过检查。
3. series 补丁长度不能超过已有系列，成员必须为对象；`[]` 表示无系列补丁，`{}` 表示该项不变。bar/line 的序号是页面声明序；pie 只有第 0 项。
4. xAxis/yAxis 归一为既有轴集合后逐项补丁：对象只对应第 0 轴，数组按既有轴索引；不能增加轴或改变类型/归属。无该轴的图表不能通过透传创建轴。
5. color、radius、渐变色阶等其余普通数组整体替换，不套用系列数组规则。基础配置、页面文档与输入对象均不被修改。
6. 三图选项子树排除参数/筛选/parts 收集、能力探测、物化与参数提取；普通字段位置保留原行为。

### 3.3 保护规则的最小范围

P1 把下表落实成一份产品真源规则，协议校验与运行时防御复用，具体路径在编码前用表驱动用例冻结。内部不维护完整 ECharts Schema。

| 分组 | 规则 |
|---|---|
| 允许的根入口 | 优先开放 color、backgroundColor、textStyle、grid、legend、tooltip、xAxis、yAxis、series 及声明式动画外观属性；根入口采用小型显式集合，不等于完整 ECharts option |
| 数据与身份 | 拒绝 series.data、类别轴 data、dataset、encode、dimensions、dataGroupId，以及更改系列 id/name、数量、类型和排序的声明 |
| 结构与交互 | 拒绝 stack、坐标系/轴归属、事件与实例操作、关闭现有点击行为的声明；不新增 markPoint/markLine/markArea 数据入口 |
| 间接绕过 | 拒绝 baseOption、options、media、timeline、新坐标系、visualMap、geo、graphic、toolbox 等本批无一致性实现的入口；dataZoom 继续由引擎生成 |
| 行为与资源 | 拒绝链接、外部图片/资源、额外下载、原始 HTML/CSS 注入与回调位置；formatter 仅开放已明确支持字符串模板的位置，不能因值是字符串就接受函数专用位置 |
| 合并对象 | 拒绝原型修改相关键；按对象自有属性构造，不使用不受控的通用 deep merge |
| 几何 | 仅补充一个既有 grid 的边距等已支持呈现属性，不增坐标系；与标签空间修正同时验证数值/百分比，不能把百分比当零后静默覆盖 |

允许入口内部只做产品所需形状和禁用路径检查，其余 ECharts 属性仍可能被库忽略。最终支持范围必须在高级文档写实，不能宣传“任意 ECharts option 全量透传”。若实现发现必须开放上述之外的执行或结构入口，停在冲突处重新确认，不能扩大已确认范围。

### 3.4 单次回退与 console 诊断

```text
有效输入 → 生成基础配置 → 合并扩展 → 必要几何修正 → 应用 ECharts
                              发生异常 ↓
             warn + dispose → 重新生成基础配置 → 新实例绘制一次
                                            失败 ↓
                               error + dispose + 保留空绘图区
```

基础生成本身就失败时，没有可用扩展结果可撤回，直接进入基础失败处理，不重复同一个必失败步骤。捕获应使用结构化结果或惰性调用，不能让 `$derived` 在捕获范围之外先抛错。

一次“有效输入”包含配置、数据及实际影响基础 option 的呈现输入。用当前输入的降级状态防止 resize/静态 observer 导致循环重试；resize 只重绘当前已选模式。真正新输入可重新尝试扩展；配置删除恢复默认。销毁、卸载和迟到回调须清理引用，不能在已销毁实例上 resize/setOption。

诊断至少包含 `code`、组件 id/type、`stage`、`path`、原始 `cause`。建议固定代码：`CHART_OPTION_INVALID`、`CHART_OPTION_DEGRADED`、`CHART_RENDER_FAILED`；名称在 P1 冻结。原因不能定位到叶子时，path 指向当前组件的 `props.echartsOption`；不直接输出全部查询行或整个页面文档。相同输入和阶段不因 resize 刷屏。warning/error 均不形成 DOM 文案。

协议校验返回仍是结构化失败；运行时识别本能力错误后输出 console/invalid 事件，阻止非法选项渲染，同时不把它们送进可见错误列表。若只有这类错误，不残留通用校验失败标题；若混有其他错误，仅原有其他错误按既有规则展示。创作侧也避免把本类错误拼进可见 message。

### 3.5 导出与编辑

沿用 `data-export-chart-error`，另附内部错误分类或结构化状态；不靠解析用户错误字符串识别降级。导出视图重新判断当前静态绘制结果，任何降级/基础失败都在截图和下载前终止。错误检查必须先于 ready 判断并覆盖 ready 后阶段，不能只在等待循环内部检查。Surface 对此类错误只 console，不赋可见的 `reportExportError`；其他现存导出错误保持原行为。finally 释放 busy、导出实例、Worker/对象 URL 等原有资源。

普通编辑、保存、重开保留透传；切换到不同组件类型明确清除，console 记录组件和丢弃路径，复用现有可撤销事务；同类型操作不清除。Python 工具继续返回机器可读 dropped 路径，前端不转成页面提示。当前属性面板与普通创作编辑白名单不新增此入口。

## 4. 实施顺序与文件范围

| 阶段 | 任务和主要文件 | 完成条件 |
|---|---|---|
| P0 基线与隔离 | 核对当前版本、已有修改与工作树附件；创建/复用适合本批的隔离检出；冻结允许路径与验收矩阵 | 不带入并行未提交能力；记录基线 SHA 与实际 ECharts 版本。当前观察为 Schema 6.31、锁定 ECharts 6.1.0，仅供实施时复核 |
| P1 协议与纯校验 | `packages/page/src/schema/components/charts.ts`、拟新增 `chart-option.ts`、`validate.ts`、`errors.ts`、`version.ts` 及必要内部导出 | 三图接受，其他组件拒绝；保护/越界精确路径；分配实施时下一可用 minor，不预占 6.32；旧文档保持读取 |
| P1b 不透明解析 | `page-param.ts`、`filter-text-value.ts`、`text-value.ts`、`resolve-page-params.ts` 及参数提取消费者 | 子树内形似 param/filter/parts 的对象不误解析、不误算版本；外部真实文本引用仍正确 |
| P2 合并与实例恢复 | 三图 Svelte/options、`shared/EChart.svelte`、`shared/chart-presentation.ts`、拟新增共享扩展模块；饼图有效行投影 | 顺序、非变异、几何、完整捕获、一次回退、基础失败空图、resize 不循环；饼图缺失值后点击仍对应原行 |
| P3 运行时与导出 | `runtime-ui/src/ComponentRenderer.svelte`、`RuntimeSurface.svelte`、`report-view.ts` 与内部错误类型/导出测试 | 传诊断上下文；校验、绘制、PDF/PNG 失败只 console；导出无下载且释放 busy；其他错误行为不变 |
| P4 创作与切换 | 平台 `document-edit.ts`、`property-edit.ts`、实际 message 消费者、历史事务；Python `pages/components/component_editing.py` 及测试 | 面板仍隐藏，普通修改保留，跨类型清除、console 提示、撤销精确恢复；Python/TS 一致 |
| P5 场景与协议说明 | `pages/capabilities/chart/chart-echarts-option-page.json`（拟新增）、Playground catalog、`pages/README.md`、`PAGE-METADATA.md`、`docs/page-metadata/`、reference-map、契约向量 | 一个正常完整页面作为直接验收输入；非法场景用协议 fixtures，故障恢复用可控注入；共用高级说明不复制三份规则 |
| P6 分发与验收 | authoring 产品导出、契约快照、本地 Skill 作者说明/生成知识/校验器/哈希、`tools/package-build/compatibility.mjs` 测试复制闭包 | 隔离检出生成并核对差异；仓外安装校验闭合；浏览器与安装消费证据齐备，才标实施完成 |

P1/P1b → P2 → P3 → P4/P5 → P6；P5 页面设计可提前，但最终自动验收读取落盘页面。控制复杂度：不引入通用插件系统、不新增对外 ECharts 实例接口、不重做平台错误总线、不增加面板编辑器、不扩展地图。

## 5. 验收矩阵

| 编号 | 必测行为 | 证据层级 |
|---|---|---|
| A01 | 三图合法配置、普通数组替换、空补丁、模板覆盖、删除扩展恢复默认 | page + widgets 单元、完整页面浏览器 |
| A02 | series 按声明序对应 stackOrder；双轴索引与饼图唯一系列；不新增系列/轴 | 纯函数与既有 bar-chart-order 回归 |
| A03 | 数据/结构/包装入口/资源/原型键拒绝；JS 非 JSON 输入拒绝；精确 Pointer | 产品校验与合法/非法契约向量、独立校验器 |
| A04 | param/filter/parts 碰撞不解析；不误报相应能力版本；真实文本引用继续工作 | page 参数、文本、版本与提取测试 |
| A05 | 构造、合并、几何、setOption 分别注入异常；dispose、单次回退、基础失败空图 | 绘图宿主测试 + 浏览器；不依赖某个属性恰好抛错 |
| A06 | resize 不重复扩展尝试/日志；新数据/配置可重新尝试；卸载无迟到绘制 | 宿主行为/浏览器 |
| A07 | warn/error 详情完整，无页面文字/toast/tooltip/失败按钮；校验器返回详情 | 浏览器 console/DOM、结构化回执；含混合错误分流 |
| A08 | 正常 PDF/PNG 保留静态样式；静态渲染降级终止、无下载、busy 释放、仅 console | 导出集成和下载事件；同时验证 ready 后错误不会漏拦 |
| A09 | 标题/宽度/排序/保存保留；跨类型清除并 console 说明；撤销恢复 | TS/Python 编辑测试、平台浏览器 |
| A10 | 饼图缺失值穿插、真实零和重复类别点击映射正确 | 共享投影单元 + 点击浏览器 |
| A11 | 窄宽容器、标签旋转、grid 数值/百分比、图例换行与长标签不产生静默几何误算 | 完整页面宽/窄屏与导出浏览器 |
| A12 | 面板无入口、构造器不主动添加、知识完整、独立安装可校验、安装消费者可渲染 | 构造测试、生成检查、仓外 Skill、包兼容验收 |

内联数据场景明确标为演示，不要求接真实 DQE 才能验证本功能。运行时降级采用测试专用故障注入；不得在产品里按页面 id 特判或加入故障开关。不能把确定性构造测试等同于真实模型已证明不会主动使用；真实 DS 复验如另行要求，按[DS 模型验收](../agents/skill-ds-model-acceptance.md)单列。

## 6. 命令与完成门槛

本轮仅文档检查：

```sh
pnpm adr:index
pnpm adr:index:check
git diff --check -- docs/adr docs/plan
```

产品实施后按阶段执行定向测试，既有入口示例：

```sh
pnpm exec vitest run packages/page/tests packages/engine/widgets/tests packages/engine/runtime-ui/tests
pnpm validate pages
pnpm check
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm exec vitest run tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts
pnpm exec tsc --noEmit -p tests/tsconfig.json
pnpm authoring:test
pnpm build:packages
pnpm compatibility:check
```

浏览器专项加入 `packages/embed/tests/browser/`，沿用相邻 chart/report spec 的项目启动方式，补齐安装包 fixture 复制闭包；分别记录实际执行项目和结果，不把单元测试当浏览器结论。Python 作者代码有新分支时按项目既有固定 radon 版本和复杂度门槛验收。依赖/环境/既有失败分类记录，不用扩大无关改动消除。

完成要求遵循[新功能验收](../agents/feature-acceptance.md)与[本地创作 Skill 维护](../agents/local-authoring-skill-maintenance.md)。[验收证据](../evidence/chart-echarts-option/result.md)记录基线、冻结源码树、命令、产物和限制。提交、push 或跨分支交付另按本仓 scoped-main-delivery；本地验收不代表远端 CI 或部署验收。

## 7. 风险与实施约束

- **诊断分流是实际改动**：既有 invalid 页面列表与导出页头会显示错误；必须对本能力按结构化类型分流，不能只加 console 后仍显示原文案。
- **恢复范围要完整**：只包 setOption 会漏掉父组件 option 构造和 frame 派生；基础失败也不能让整个页面被未捕获异常中断。
- **输入与实例不能混淆**：重建实例会丢临时图例/缩放状态，是失败回退的预期代价；不写回页面，不跨输入复用脏 option。
- **ECharts 原生层级仍有效**：同一路径透传优先不等于 series.itemStyle 会覆盖每个 data 项上更具体的 itemStyle。保留原生层级并用文档说明，不能为了“强制全覆盖”改写受保护数据项。
- **版本耦合真实存在**：不复制完整 ECharts Schema，未来升级须运行本批定向/浏览器/导出用例。已知异常可回退，静默忽略不保证探测。
- **并行工作区需隔离**：当前导出、协议和 Skill 已有未提交修改。实施和生成分发前重新核对基线与允许路径，不直接从混合工作区导出或广泛暂存。

## 8. 当前完成状态

- [x] Q1–Q8 与后续修正落盘，ADR 及主题索引同步。
- [x] P0–P6、文件范围、保护策略、错误渠道、测试矩阵与完成门槛已规划。
- [x] 隔离检出与产品协议/实现：基线 `8ff56a268a659dc026ec76b90d6bcc4353c48d5d`，Schema 6.32，ECharts 6.1.0。
- [x] 完整页面、浏览器/导出验收、分发及独立安装验证，见[验收证据](../evidence/chart-echarts-option/result.md)。

用户随后授权提交并推送 main。交付前接入最新 main、验证受影响输入，推送后核对远端和 CI；真实部署不在本批范围。

## 9. 实施记录（2026-10-19）

实施检出：`/Users/moon/.codex/worktrees/chart-echarts-option/DataDashboard`。原工作区的 IOC 等并行修改保留。以下 P0–P6 是首次本地验收记录；后续 main 交付另外记录基线与复验。

- P1/P1b：正式 JSON Schema、保护规则与 `CHART_OPTION_ERROR`；6.32 能力下限，5.x 不能伪装声明新能力；精确子树不透明处理。双轴数量与现有普通/混合构造规则一致。
- P2：两个共享纯模块与原 EChart 生命周期，构造异常转为值；同一路径合并、声明序映射、单次实例回退与 resize 锁存。基础配置始终保持干净，每次应用复制后交给 ECharts；不复制丢失内部 formatter 函数。饼图点击共享有效行投影，完整类别色域保留。
- P3：诊断上下文与 console-only 分流；校验失败不进入可见错误列表；导出错误独立于 ready 检查，图表降级用内部分类终止且不产生页头提示。
- P4：面板白名单不增加入口；普通修改保留，跨类型清除并 console 记录，同类型保持，既有撤销恢复原文档。Python 原有清除规则已足够，仅补行为回归。
- P5：完整 inline 页面、Playground 注册、协议高级说明、参数例外、契约反例；三个现行创作 Skill 同步默认使用策略，知识/校验器从产品真源生成。
- P6：冻结源码树 `80a0fe4cbe2d32055639b3d5162ca753a597ef3d` 完整测试、类型检查、构建、六包打包及安装消费通过；2243 项 TypeScript 测试通过、5 项跳过，540 项 Python 测试通过、1 项跳过，29/29 页面通过。真实 Chrome/Edge 安装消费者矩阵 298 项通过，含本能力 18 项检查；契约生成与 Bundle 摘要检查通过。最终结果见[验收证据](../evidence/chart-echarts-option/result.md)，未推断远端 CI、真实服务或真实模型通过。
