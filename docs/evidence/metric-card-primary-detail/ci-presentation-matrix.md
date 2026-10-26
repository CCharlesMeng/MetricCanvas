# CI呈现矩阵补齐

`72c956f182fecc1446780ab042de185e71ed2111`的[CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40331922214)中，authoring、tests、types和build通过；compatibility的32个失败均为`presentation.spec.ts`的固定示例数量断言，原有其余470个浏览器用例通过。

## 复现和根因

新增primaryDetail后，真实呈现夹具为Report55个、Dashboard53个；旧断言仍要求54/52。32个失败覆盖两个浏览器、两个宽度、两个布局和四种容器，均在逐项渲染前被同一计数断言阻断。

小于1秒的确定性复现：从`packages/embed/tests/browser/presentation-fixtures.ts`调用`presentationFixtures`，打印55/53，再断言旧54/52，输出`AssertionError: 55 !== 54`。两份夹具均完成规范化，因此直接修正已确认的固定计数并继续原有浏览器回放；不需要增加推测性产品改动或临时日志。

## 修正及验证

- 固定分支期望同步为55/53，保留全部正式示例和原可见性、标题、画布、表格检查。
- 新增两项直接读取`pages/capabilities/layout/metric-card-primary-detail.json`的1440/390浏览器回归：0/1/3/6行、同排等高、窄屏自然高度、无水平溢出、8px上间距、标签14px/20px黑色50%、数值14px/17px黑色80%及下划线。
- `MC_EMBED_EXAMPLE_PORT=4186 pnpm --filter @metriccanvas/embed exec playwright test tests/browser/presentation.spec.ts`：Chrome29项通过，包含全部16个原矩阵场景和两个新主次指标场景；耗时19.1秒。
- 新期望的确定性夹具计数断言55/53通过；embed类型检查与协议生成一致性检查同步执行。

## 复杂度

`metriccanvas-ts-ast/1` / TypeScript5.9.3，修改的矩阵测试回调selfCC为3→3；两个宽度共用的新回调selfCC为3，全部新增evaluate/map回调均为1。未修改的`inaccessibleText`内部回调存量CC16保持不变，不属于本次修复范围；本批无新增或修改函数超过15。

本次仅修改测试和验收说明，没有修改正式呈现、页面协议、Skill或查询语义。新的远端完整CI结论以修正提交对应的运行记录为准。
