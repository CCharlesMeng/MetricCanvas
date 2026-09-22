# T09 / #135 内容工具文本与地图验收

作者提交：`02b6026`，基于 S0 正式 `e29b9bd69758282f534e032e250fc7ca4ee89666`。独立树 `/private/tmp/metriccanvas-s3-135`，分支 `codex/s3-135-text-map`。地名资产来自 S2 正式支援 `ab813401cc5bc16ff3ac28106e77b3ebd2075d0c`，未手改产品快照。

配套生成源提交 `bf6d53cf3a011ac8e5197ccf035f7429f4ecea12`，本树 cherry-pick `c7a8ba4`，仅 bundle.lock.json、contract-lock.json、contracts/manifest.json。最终导出无漂移（195 product / 4 authoring / 1 interface），Bundle **502 摘要校验通过**；安装验证使用此组合重建后的 sdist。

## 可观察行为

- 独立 content MCP 新增 `create_content_page`，通过明确 add_text/add_field_text/add_map_chart 操作生成新页面；静态文本不依赖源，数据组件只接受可信 source_token。完整源 ref/hash 校验先于页面规范化，输入面不接受原文、数据行或查询。
- `edit_page` 复用这些追加操作，另支持删除这三类顶层组件。原始数据源和无关组件保持不变，操作失败独立回滚；删除被后继 connectPrevious 引用的组件明确失败。每次候选与最终页面均完整校验。
- fieldText 要求单行非空 string/semanticHtml 字段；mapChart 要求地域 dimension、数值 measure 与行证据。查询 initial 按 queryField 读取而不重写源，缺证据和未物化 compute 不伪造。china/world 名称来自实际底图，显式 nameMap 与运行时同向。
- 新建信封 kind 为 `metriccanvas.content-page-artifact`：document/documentSha256/sourceRef/bundleVersion，仅程序通道消费。既有 page-edit-artifact 和修改基线语义保持。无保存/发布副作用。

## 验证结果

- 固定作者代码完整 Python unittest：**197 通过**，包括原 compatibility/relay/content stdio、版本、页面校验与布局回归。
- 新增 text/map 领域测试 9 项、内容创建/stdio 测试 4 项：三类添加与删除、原文不变、字段/行数/地域错误、独立部分成功、注入拒绝、原 ref/hash 错配、queryField 映射、缺 initial、world 地图、删除连接引用、无源静态文本及摘要通道。
- 从**公开真实 stdio 工具**导出 report/dashboard 两份页面，经产品 validate-cli：**2/2 通过**。
- 当前工作树 Embed 构建后用真实 Chrome 运行 `metriccanvas-authoring/test-harness/text_map_browser.mjs`：两形态均显示静态正文、字段长文本、非空地图几何；实际鼠标悬浮显示 **浙江省 18**，pageerror 为零。截图已人工查看。使用代表性受控行数据，非外部 DQE 联调证据。
- 离线构建 sdist 并安装到隔离目录后，生产 `python -m metriccanvas_authoring.content_server` stdio 的四工具闭集、可信文件基线、创建与编辑、完整产物 hash、地名资产内嵌及文本摘要隔离均通过。
- `git diff --check` 通过。

复跑浏览器：先在当前工作树 `packages/embed` 执行 `vite build`，再运行 `node metriccanvas-authoring/test-harness/text_map_browser.mjs <公开工具产物.json> <截图目录>`。验收暂存目录 `/private/tmp/s3-135-evidence` 包含完整 unittest 日志、两份产物、两形态截图与安装 stdio 日志；这些本机路径不作为外部持久交付。

## 真实验真发现及边界

Schema 合法不代表地图可见：普通地图位于 plain/card 分区时单元格高度被置零，会使 ECharts 初始化失败。新建工具使用 main panel；向现有 plain/card 添加地图返回 `MAP_SECTION_REQUIRES_CHART_HEIGHT`，不暗改分区。panel 与缺省分区是本票支持的地图宿主，铺底组合不在本票扩展。此处只修改内容构造门禁，未修改运行时。

semanticHtml 的标签处理沿用产品运行时，Python 不另造 HTML 消毒语义。容器子树、aiSummary、筛选/跳转分别属于 #136/#137，尚未在本票实施。真实 Lab/DQE/Relay、生产授权注入与 Java 保存不在本地验收结论内。
