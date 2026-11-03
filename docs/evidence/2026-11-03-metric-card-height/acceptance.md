# 指标卡混排等高修复（2026-11-03）

用户确认保留现有 `compactStack` / `primaryDetail` 视觉，只修同一行卡面高度。业务页为 `/pages/rep-business-result`，本批不改业务页 JSON、查询或字段绑定。

## 根因与范围

`RuntimeSection` 的栅格和单元格已拉伸。`compactStack` 使用自然高度且卡面位于内层 `.metric-panel`，与直接绘制外框的 `primaryDetail` 混排时，外层等高未传递到紧凑卡的内层卡面。

产品代码仅新增四行 CSS：`compactStack` 外层 `flex: 1`，唯一直接子面板 `flex: 1`。短卡的新增空间留在底部；多面板或进度环不触发 `:only-child` 面板拉伸。不引入固定高度、补空行、页面 id 特判或视口读取。

Schema 字段净增减为 0。引擎承接卡面拉伸；页面沿用现有 variant。纯 CSS 变更，未新增或修改可执行函数/分支，因此无函数 CC 前后变化或未关闭的函数复杂度项。

## 浏览器证据

通过 CUA 在真实 Playground 路径的独立 iframe 中固定 CSS 视口为 1440px / 390px。主浏览器的 viewport override 未改变实际 CSS 视口，因此验收采用 iframe 内 `innerWidth` 确认尺寸；没有以截图宽度代替布局宽度。

- 1440px 业务页：修复前卡面高度为 125.215 / 89.980 / 145.957 / 145.957px，四卡 top 相同；修复后均为 145.957px。
- 对各卡内标签、数值、同比逐项比较文字、相对卡面坐标、尺寸、font、color、lineHeight、margin、下划线，以及卡面 padding / border / radius / background，全部保持一致。
- 390px 业务页：前后卡面高度及内部样式、位置的测量对象完全相同；各卡恢复自然高度。
- 900px 业务页按现有响应式规则仍为同一行四卡，实测也全部等高；没有将这一宽度误记为两行排布。
- 扩展 `/pages/metric-card-primary-detail` 的 `mixed-variants` 分区，使用内联合成数值覆盖带/不带同比的两张紧凑卡及两行/一行次级指标的两张主次卡。1440px 四卡等高，390px 自然高度，均无页面横向溢出。
- 业务页动态指标当前呈现缺失占位；合成场景提供正常数字。未验证真实 DQE、Relay、线上部署或 CI。

原始测量、独立断言和截图位于：

- [业务页前后测量](../../../artifacts/metric-card-height-20261103/business-measurements.json)
- [断言结果](../../../artifacts/metric-card-height-20261103/checks.json)
- [混排场景测量](../../../artifacts/metric-card-height-20261103/mixed-scene.json)
- [900px 测量](../../../artifacts/metric-card-height-20261103/medium-measurements.json)
- [修复后宽屏截图](../../../artifacts/metric-card-height-20261103/after-wide.png)
- [仅供诊断的本地 harness](../../../artifacts/metric-card-height-20261103/harness.html)

## 文档与独立 Skill

真源为 `PAGE-METADATA.md`、`docs/page-metadata/components/metricCard.md`、页面及同源合法夹具；根页面入口及目录 README 补充观察方法。原实现阶段独立 Skill 补丁版本为 1.17.4；本轮交付接续最新 main 的 1.18.0，版本为 1.18.1。

从当前 HEAD 的隔离工作树只承接本批真源，以锁定 Python 和现有 Node 依赖运行官方导出器；派生知识、协议向量、锁和 MC 内容均通过生成器写出，未手改 hash。MC 诊断回执另经官方 fixture 工具刷新。

## 已执行检查

- 组件响应式/卡面及页面指标卡相关 Vitest：4 个文件、29 项通过。
- 引擎与 Playground 类型检查：均 0 errors / 0 warnings。
- 业务页和混排示例的独立 local-authoring 校验：通过。
- 隔离范围 `export-authoring-contracts.ts --check`：通过（1345 product / 4 authoring / 1 interface files）。
- MC source coverage：通过；隔离范围 MC unittest：51 项通过；MC fixture check：通过。
- `git diff --check`：通过。
- `pnpm skills:check` 首轮：repair 两个文件 16 项通过；authoring 六个文件 221/232 项通过，11 项因命令使用相对 `METRICCANVAS_PYTHON`、切换临时目录后找不到解释器而失败（`ENOENT`），不是页面校验错误。
- 修正为锁定解释器的绝对路径后，在隔离范围复验这 11 项：两组先通过 9 项，另两项在并行构建时达到 90 秒子进程上限；随后单进程顺序复验两项全部通过（33.6s / 69.2s）。未修改产品或测试超时设置。其余五个 authoring 文件的 201 项与首轮 20 项漂移拒绝用例保留首轮通过结果；不声称一次完整 `skills:check` 全绿。
- 对已通过 20 项的额外重复执行中途停止，不计为新的通过记录。

## 工作区边界

保留开始时存在的其他未提交工作。全工作区导出检查仍指出 `source-identity.json` 和 `mc-content.version.json` 漂移：全 `pages/` 构建输入还包含其他任务已改的 README / IOC 示例以及此前导入的未提交业务页；没有为了本批四行样式修复把它们纳入隔离发行来源。根 MC 检查另遇到已有 `mc-content/scripts/__pycache__`，未清除用户已有缓存，而在无该缓存的隔离范围完成 51 项测试和 fixture 校验。

以上为原实现基线 552ef5c1228ce292ad9a2ec66673fa82e1c67ba4 上的验证快照；后续交付基线、重新验证及 skip CI 约定见[交付记录](delivery.md)。未验证线上部署。

生成用的临时 managed worktree 已通过应用工具归档为可恢复快照；任务创建的依赖软链已先移除，原工作区依赖未改。未清理其他分支或工作树。

复验使用的绝对解释器为 `/Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python`，并设置 `PYTHONDONTWRITEBYTECODE=1`。带临时 cwd 的导出测试不能使用相对解释器路径。
