# Report PDF 创作知识同步验收

验证基线：`cbf9c35b4e7d5ab38bf864c154a1d894a72dccb8`。交付前衔接 main 的 `0311c254` 平台通知重构；创作真源及锁文件输入不变，契约与 Bundle 检查再次通过。在独立检出承接已交付的引擎修复，从当前产品真源生成，不复制混合工作区的未交付功能。

## 变更

- 补充 `reportHeader.props.pdfExport` 字段语义、6.26–6.28 版本说明、完整 `pages/report-pdf-export.json` 路由和 5 类无效声明向量。
- 报告页头参考同步零外边距、连续分页、无额外表头／页码、有界截图与无损编码；总览删除“没有下载开关”的过时说明。
- 本地 Skill 按任务路由到 PDF 配置；产品参考、page-builder 参考、独立本地 Skill、Node 校验器、版本清单及 Bundle 锁由同一导出器生成。
- 内部能力标识使用 `report-header-pdf-export`，避免与正式示例页面 id 冲突；用户声明与页面 id 不变。Python PDF 创作预检消费 Bundle 内产品 Node Bridge。
- 浏览器回归直接捕获应用的 window.open 和下载链接目标，要求唯一 Blob 下载链接、无新窗口请求、无 popup、原页 URL 不变；浏览器新增页面另附 URL 与 opener 诊断。
- 两个串行启动多个子进程的回归使用独立场景时限；导出子进程仍各自限制 30 秒。

## 实际结果

- `pnpm authoring:contracts`、`pnpm authoring:contracts:check`：通过；683 个产品、4 个创作、1 个接口生成文件。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：2505 项摘要校验通过。
- 定向 Vitest：初次 141 项通过，1 项组合场景超过 30 秒；仅调整场景时限后，失败项与两个 CLI 场景复验 3 项通过。此前失败的字段覆盖、版本快照、publication、页面 id 中立性及独立 Skill 用例均通过。
- `pnpm authoring:test`：537 项，1 项跳过，其余通过；包含确定性无模型流程，未调用真实模型。
- Python Radon 6.0.1：361 个函数，最大复杂度 15，无超限。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`、`pnpm --filter @metriccanvas/page check`、HTML 产物构建：通过。
- HTML PDF 浏览器回归：3 项通过，独立端口消费本检出的真实构建产物。
- 本地 Skill 整目录复制到仓库外，Node 校验器声明 Schema 6.28；有效 PDF 页面通过，版本过低、Dashboard、空按钮文字、空文件名及未知选项均按预期路径拒绝。Skill 格式检查通过；目录链接与知识摘要由独立分发回归核对。

## CI 兼容性补充

`b57fff40` 的创作、类型、构建与全量测试任务均通过。244 项安装包浏览器用例中，243 项通过；Edge 的 PDF 用例仅因页面集合增加一个对象失败，文件下载、按钮恢复、临时视图清理及 popup 断言均通过。此前把页面集合增加归为启动标签页并不充分；回归改到应用发起导航的实际边界，明确检查 window.open、Blob 链接 target 与 download 属性，并保留额外页面诊断。此修订不改变 PDF 引擎和 Skill 产物。

## 边界

本轮不包含真实 DS 模型、DQE、Relay、Java 服务或部署验收。协议知识可表达 PDF 配置不等于所有在线 Page Build Spec／compose_page 操作新增了输入字段；本地 Skill 直接生成页面 JSON，在线编排仍按其现有能力消费。
