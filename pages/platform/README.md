# pages/platform

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 页面搭建｜拖拽、删除与撤销

入口：`/pages/platform-canvas-experience`；[页面 JSON](platform-canvas-experience.json)。

启动：`pnpm dev:platform`，在页面搭建工作台加载资产。

在 Platform 页面搭建工作台调整顺序、跨分区移动、删除并撤销；试验场仅展示内容。

合成演示

仅展示结构；操作需页面搭建工作台

1. 本预览只检查页面内容与分区；不会出现搭建手柄。
2. 在 Platform 页面搭建工作台打开此页面，再体验拖拽、删除和撤销；完整操作见仓库 pages/README.md。

本页地址不是搭建入口；搭建工作台由 Platform 提供，具体页面资产须在对应环境加载。

关键声明：`sections[].components[].layout`, `sections[].components[].type`。

关联：[metric-card-equation](../capabilities/layout/metric-card-equation.json)。

## 云宝创作与最新工作副本

内容预览入口：`/pages/flow-page`；[完整页面](flow-page.json)，显式 Dashboard，合成内容、不含真实数据查询。`pnpm dev:playground` 启动后直接访问该入口，检查页头与文本正常渲染。试验场只展示页面内容，不承担创建云宝会话。

完整 Platform 场景：`pnpm --filter platform dev:agent-flow`，打开 `http://127.0.0.1:5178/?pageId=flow-page`。使用真实工作台、检查器、管理列表、独立表单与既有更新通知，云宝和元数据服务为本地替身；页面源直接读取上面的同一 JSON。

1. 进入后 URL 自动补 sessionId；选择文本组件，在检查器更改组件标题，不点保存。
2. 左上角更改页面标题并移开焦点。验收记录 infoWrites 增加一次；画布中组件手改保持，assetWrites 仍为 0。
3. 点击“发送到云宝”。返回说明引用刚手改的组件标题；展开验收记录，lastInput 同时包含两个新标题，sendCount 只增加一次。
4. 点击“删除地址中的会话 ID”，保留页面，自动获得另一个云宝会话。页面不消失；验收记录列出两次不同会话准备。
5. 管理目录仅提供“基本信息”和“可视化编辑”；从“基本信息”进入独立表单修改标题/描述/路径。路径保留 `?pageId=flow-page`，保存直接增加 infoWrites，sendCount 不变。错误 pageId 给出校验消息并保留输入。
6. 刷新分别打开 `?sessionId=existing-session`、无参数入口、`?pageId=flow-page&sessionId=broken`，核对仅恢复对话、空画布自动新建，以及会话失败仍能读页面。
7. `?pageId=flow-page&delaySession=1` 可暂停会话准备，在“验收记录”点“完成会话准备”继续。等待期间仍能预览页面。

边界：本夹具的服务记录在内存，重新加载会重置。执行中禁止编辑、重复提交、失败、取消及过期结果由工作副本单元测试补充。真实 SDK 与真实服务尚未验收，见[记录](../../docs/evidence/agent-authoring-flow/acceptance.md)。

管理目录入口：正常 Platform `/manage` 操作列仅保留“基本信息”和“可视化编辑”，分别进入独立信息表单和页面搭建工作台；不再提供行内编辑或单独预览入口。

组件清单排序：在正常 Platform 的可视化编辑中，清空组件选中后，在右侧“页面组件”列表按住条目上下拖动；上半区插入前面，下半区插入后面。观察列表与画布同时重排、列表仍保留；顶部撤销恢复上一次移动。拖到列表外松手不修改文档。保存或预览期间禁用排序，保存仍沿用现有工作副本流程。跨分区和原地落点使用同一画布移动校验；自动用例基于本目录 platform-canvas-experience.json。

## 工作台交互审计验收

Playground 入口：`/pages/platform-interaction-audit`；[页面 JSON](platform-interaction-audit.json)。Dashboard、内联合成数据；筛选只控制显隐，不声称重查或过滤销售额。无需 DQE。

Platform 隔离验收：`pnpm --filter platform dev:agent-flow --host 127.0.0.1 --port 5176`，打开 `http://127.0.0.1:5176/flow/create?page=platform-interaction-audit&resource=resource-platform-interaction-audit`。此夹具复用正常 Platform，页面资产和 Chat 为明确标识的本地替身，内存记录随完整刷新重置，工作副本仍由正常本机保护流程管理。正常本地体验可按 `apps/platform/README.md` 启动 `/manage` 并打开已有资产。

1. 修改顶部页面标题，离开输入框。观察未保存工作副本、本机保护和保存按钮；验收记录中的 `infoWrites/assetWrites/sendCount` 不增加。确认保存后，观察 `confirm-save` 输入含最新标题与条件、页面转为已保存。
2. 顶部“页面管理”打开现有对话框，关闭后画布布局不被插入的管理信息挤占；右侧入口名为“页面属性”。
3. 页面属性只展示“区域已选择时显示”的已配置条件摘要；添加条件使用基础表单。编辑原规则时在高级 JSON 输入 `{` 或 `{"filter":"missing","part":"values","op":"isEmpty"}`，应用应在窗口内报错并保留原规则，取消不改写。组合规则完整保留。
4. 从组件目录选择“底部区域占比”，画布定位并高亮；通过属性面板的“切换组件”返回“操作说明”，不用先退出属性。
5. 形态切换沿用既有 query 数据约束，本内联页不展示不具备的形态切换能力。正常本地资产 `http://127.0.0.1:5175/create?page=demo&resource=local-demo`，选择 GMV 指标卡，展开“查看不可用形态及原因”，观察柱/线/饼等缺少维度的具体原因；下拉只含允许项。也可加载既有查询验收文档 `apps/platform/tests/workbench/fixtures/document-edit.json` 验证。

本批没有新增页面字段，没有实施多步撤销/重做或预览连续性。截图、检查命令和环境边界见 `docs/evidence/platform-interaction-audit/result.md`；真实 Chat/Java/DQE/Relay/门户单列待验。
