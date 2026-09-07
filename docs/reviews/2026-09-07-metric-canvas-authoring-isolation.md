# #56 创作隔离实施与验证

依据 [#96 裁决](https://github.com/CCharlesMeng/MetricCanvas/issues/96) 和 [ADR-0065](../adr/0065-separate-metric-canvas-authoring-package.md)，本次完成独立创作包、platform 迁移与专项回归，实现由 [#56](https://github.com/CCharlesMeng/MetricCanvas/issues/56) 跟踪。代码交付不等于 npm 发布；正式包名、版本策略和发布门禁仍由 #100 裁决。

## 实现

- 新增 `packages/metric-canvas`，导出 `MetricCanvas`。创作类型、草稿布局解析、选中、拖拽、行内编辑、事件监听与控件样式均移入本包；包当前保持 `private: true`。
- `RuntimeView` 只接受正式渲染输入。原渲染主体移入 `RuntimeSurface`，页面校验、查询、筛选、分页与组件分发继续共用；`RuntimeSection` 保有网格、行对齐和安全区所有权，不创建创作状态。
- `runtime-ui/composition` 提供已校验分区与渲染片段、单元格 attachment/overlay 和空内容接缝。创作包单向依赖渲染包，不复制布局或查询实现。
- platform 工作台一次性迁移到 `MetricCanvas`，通过 `enabled` 暂停创作，外部属性面板保持 `inlineControls={false}`。删除旧 `RuntimeView authoring` 参数及渲染包中的创作专用导出；页面文档和工作台流程继续归宿主。
- 更新锁文件、根 README、前端基线中的源码定位与 `docs/solution.md` 的职责说明；创作包用法及组合契约见 [README](../../packages/metric-canvas/README.md)。未修改页面协议或页面资产。

## 验证结果

| 验证 | 结果 |
|---|---|
| `pnpm check` | 全 workspace 通过，Svelte 检查无错误或警告 |
| `pnpm validate` | 11/11 页面文档通过 |
| `pnpm --filter canvas --filter platform build` | 两个应用构建通过 |
| `pnpm test:embed` | 嵌入产物构建通过，30/30 Chrome 浏览器用例通过 |
| `pnpm --filter @metriccanvas/metric-canvas test:browser` | 5/5 Chrome 浏览器用例通过 |
| `pnpm exec vitest run packages/embed/tests/authoring-isolation.test.ts` | 2/2 通过：安装依赖、实际构建模块图及全部 JS/CSS 产物无创作代码 |
| `pnpm test` | 1397 通过、49 跳过、3 个存量失败，详见下文 |
| `git diff --check` | 通过 |

创作浏览器回归验证：选中与控件开关保留 DOM 实例及查询计数；编辑模式切换保留筛选和查询分页；创作点击拦截原分页交互、退出创作后恢复；标题与宽度意图由宿主回写并同步正式渲染；跨分区拖拽支持草稿空分区且不污染正式文档；无效草稿回退、卸载后监听器清理。嵌入回归覆盖真实页面、响应式布局、Shadow DOM、查询分页、配置/查询错误及 AI 总结。

### 全仓测试的存量失败

`apps/platform/tests/ask/dependency-boundary.test.ts` 的三个失败均为 Ask 依赖白名单未同步：未登记 `business-terms.ts`，也未允许 `lexical-model.ts` 对它的引用。本次没有修改该测试或 `apps/platform/src/lib/server/ask/`；执行 `git diff --exit-code HEAD -- apps/platform/src/lib/server/ask apps/platform/tests/ask/dependency-boundary.test.ts` 返回 0，证明这些测试输入与实施前基线 `c7750bd` 一致。它们不依赖本次改动的渲染与创作包。

最初在沙箱内跑全仓测试时，本地 HTTP/IPC 监听被拒绝造成超时；已终止该轮并在允许本地端口的环境重跑，上表记录的是重跑结果，不将环境超时计为代码回归。没有放宽 Ask 白名单来使全仓结果变绿。

## 与并行决策票的接缝

- #97：正式渲染 Interface 不再含创作输入；原 `RuntimeView.svelte` 的渲染主体与 token 定义现在位于 `RuntimeSurface.svelte`。本次没有裁决主题、字体、页面文档加载、数据网关或身份。
- #98：嵌入入口仍使用正式 `RuntimeView`；本次不改变 `mount/update/destroy` 或嵌入通道形态。
- #100：须对账仓内包名 `@metriccanvas/metric-canvas`、`runtime-ui/composition` 子入口及其类型、Svelte attachments 所需的 `^5.29.0` peer 下限，以及正式发布时的版本兼容门禁。子入口不从默认入口转出，不代表它可免除契约管理。
- #55：独立的会话提取后续可以从 `RuntimeSurface` 继续，本次未提前实施该重构。
