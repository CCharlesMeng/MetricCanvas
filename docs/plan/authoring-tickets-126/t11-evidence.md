# T11 / #137 维度筛选与表格链接验收

作者提交 `f241c3043dc69c659375ff427b09d1ebe87945cc`，基于 S0 正式集成 `1dfee1f5f9b0da6eb2441e62ac0a99a79967d4f3`，保留 #142 与四包 rc.4 / Schema 6.2。S2 配套生成源 `e9ea3070ead180b0892ef673bfbd065fd1314c9e` 的准确父提交为本票作者，本树消费提交 `8db110bbaf49ba55bc94256e1bd0b1ac5a9cba14`；只改三份 Bundle 锁/manifest，未混入进行中的参考手册或 Skill 修改。

分支 `codex/s3-137-filters-navigation`，工作树 `/private/tmp/metriccanvas-s3-137`。

## 范围与行为

- `edit_page` 增加 add/update/remove_dimension_filter 与 set/remove_table_link 五项受控操作。每项候选整页验证，失败完整回滚；依赖失败跳过，独立操作仍可成功。不接受任意路径、原始查询或 rows。
- 维度筛选声明与显式绑定一起修改。queryField 必须来自受控查询已解析的 dimension 字段。更新的 bindings 表示完整目标集合，允许空集合显式解除全部绑定；新建要求至少一个绑定。保留未绑定数据源、查询 body/initial、其他筛选绑定及既有 params/initialParam/paramBindings。
- 删除筛选时同步移除绑定；仍被跳转、级联筛选或参数引用时拒绝整项删除。层级维度变更受到额外保护。
- 表格链接精确定位组件和字段（含 Tab 子树及分组列），复用已有 actions.navigate。href 携带显式 row/param/filter query 映射；拒绝不安全地址、无效引用、selection 抢占及共享跳转目标冲突。最后一列解除链接时移除导航动作，保留其他动作和列属性。
- 查询分页、排序和表头筛选继续明确拒绝。没有修改产品 Schema、统一运行时或 Java 查询算法，没有保存/发布能力；完整页面仅进入可信 artifactEnvelope，模型文本只包含摘要。

## 验证证据

- 最终作者和生成物组合运行 Python unittest **222/222 通过**（final-python-tests.log）。本票领域 13 项、公开 stdio 2 项，覆盖原子回滚、依赖跳过、独立成功、解除全部绑定、悬空引用、参数保留、Tab/分组列、共享导航及 selection 冲突。
- 导出检查 **195 product / 4 authoring / 1 interface** 无漂移；Bundle **511 项摘要校验通过**。`git diff --check` 通过。
- 生产 content MCP stdio 编辑 report/dashboard 两份页面，经产品 validate-cli **2/2 通过**。
- 当前工作树 Embed 构建后，真实 Chrome 运行 `metriccanvas-authoring/test-harness/interaction_browser.mjs`，两个形态均通过。实际点击浙江省后绑定表格显示一行，未绑定表格保持两行；捕获实际 HTTP 请求，断言 `filter.dims` 使用 `raw_region`，原有 `order={offset:0,limit:20}` 不变。点击“全部”后清空维度条件、恢复两行。
- 实际点击上海市单元格链接后浏览器到达 `/detail`，同时保留固定 query `fixed=keep`、行字段 `region=上海市`、页面参数 `context=业务上下文`、筛选值 `selected=上海市` 和 `#section`。随后通过公开工具解除链接并删除筛选，文档精确恢复基线；重新挂载后无筛选 tabs/链接，原查询表格仍有两行。两形态零 pageerror，报告截图已目视检查。
- 最终组合离线构建 sdist 并安装到独立目录，启动安装产物的生产 content stdio；筛选/链接、未绑定数据源与查询 body 保留、产物 hash、模型文本隔离、精确删除往返、失败/跳过/独立成功均通过（installed-stdio.log）。没有修改共享 Python 环境。
- 证据目录 `/private/tmp/s3-137-evidence`：final-python-tests.log、build.log、installed-stdio.log、installed_stdio.py、pages、两形态截图及删除产物。浏览器验证对应已固定作者；后续 S2 增量只更新三份生成锁，未变更执行代码，未重复无关浏览器流程。

## 验真边界

浏览器使用产品 `MetricCanvas.createDqeGateway` 和统一运行时，外部 DQE 响应由真实本地 HTTP 协议测试服务提供。它证明查询条件传递、清空、原 order 保持、未绑定组件不变及真实浏览器导航；**不代表外部 DQE 服务、生产身份授权或目标业务页面已验真**。创作期间未发查询。没有把测试端点写入产品默认配置，也没有手改产品生成快照。
