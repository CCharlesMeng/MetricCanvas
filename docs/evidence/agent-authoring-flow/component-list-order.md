# 组件清单拖动排序验收

2026-10-24，右侧页面组件清单支持按住卡片上下拖动。复用画布 moveComponent、双投影、校验、工作副本保护、撤销与显式保存；拖动期间只显示前后落点，松手提交一次改写并留在清单。原地、过期目标和列表外松手不提交，忙碌期间禁用。点击仍打开属性面板；Pointer Capture 保证拖出卡片后仍能结束或取消。

正常 Platform 验收入口：http://127.0.0.1:5175/create?page=demo&resource=local-demo。鼠标下拖本月GMV至订单数后、上拖恢复、撤销、列表外松手以及点击进入配置/返回清单均通过。同步观察列表与画布组件顺序，拖动未误触属性面板。验证后恢复原有组件顺序，未向元数据服务保存新修订；本地仍保留手工操作的工作副本状态。截图 platform-component-order.png 为实际Platform。为检查桌面端检查器临时调整验收视口，结束后已恢复默认。

页面场景沿用 pages/platform/platform-canvas-experience.json，列表插槽测试直接消费该页面，覆盖同分区上移/下移、跨分区、空分区保留、原地和过期目标，输入不变。pages/platform/README.md、PAGE-METADATA.md 与 docs/page-metadata/sections-and-layout.md 同步入口和操作；未新增协议字段。

主目录 platform check：0错误0警告；Platform 48文件489项测试通过；git diff --check通过。任务工作树已同步本次代码和文档，并从其产品真源生成Skill知识与清单；authoring:contracts:check通过，local-authoring仓外独立安装24项测试通过。主目录存在其他批次未提交的派生产物版本，不用工作树派生产物覆盖主目录，保留本批任务树中的完整生成结果。

复杂度：metriccanvas-ts-ast/1、TypeScript5.9.3；Svelte script及模板函数分别测量。Inspector原函数未改变，文件最大selfCC4→7；新增clearListDrag1、startListDrag5、listDropIntent7、overListItem6、scrollListEdge4、dropListItem4、selectListItem3；新effect回调2、模板回调1。工作台新增moveComponentFromList5，存量函数未改、文件最大14→14。component-list-order：positionOf3、componentListMove4。新增测试函数最大3。全部新增/修改函数≤15，本批无超限待处理。
