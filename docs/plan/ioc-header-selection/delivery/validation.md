# 合并后验证

- 全仓`pnpm check`、产品`pnpm build`通过。
- 177个测试文件、1417项回归通过，覆盖页面协议、运行时、数据执行、local-authoring仓外安装及参考闭合。最后补齐禁用父节点元数据与可展开语义后，重跑17项相关树测试。
- 33项Chrome组件浏览器通过，覆盖普通根、ShadowRoot、16px留白、标签点击与箭头、禁用父节点的可用后代、inert祖先关闭。
- 7项仓外UI安装包浏览器通过；打包文件为新文件名，避免Vite缓存旧包。
- 本次完整页面5个场景通过；main原15个页头演示及统一页头场景通过，含币种、层级、跨页传值、失败重试、紧凑布局、自然年及390px。
- 55个页面校验通过；authoring契约与report PDF派生物一致性检查通过。

当前合并源码/派生物哈希见evidence/delivery-inputs.json；命令和日志见evidence/validation.json。旧ui/polish/left-inset证据只保留为历史，不能替当前合并验证。CI在推送后单独核对，不将本地成功等同于CI或真实服务验收。


补充验证：嵌入产物在本工作区专属4197端口运行29个IOC、导航及内容分区场景全部通过；未使用另一个工作区的4175服务。修复包含空交集显式确认、面板内重试、原生浮层状态同步和窄屏preventScroll聚焦。CI发现的公开API快照和页面ID中立性两个门禁，经24项定向测试确认通过。

全量回归收口：`pnpm test`共294个测试文件通过，2534项通过、5项既有跳过。此前两个CI门禁问题已复现并修复；最终仍以最新远端提交CI结论为准。

2026-10-21 高度修复：`vertical-align:top`消除选择框外层基线留白；重新构建 UI 和 embed 后，同一80px断言及59项嵌入回归通过，33项Chrome组件与5个实际页面场景通过。UI类型检查0错误0警告；契约导出一致。本机未安装Edge，完整Chrome/Edge安装式矩阵以补充提交的CI为准。因果失败日志见evidence/header-height-red.txt，修复后日志见evidence/header-height-embed.txt。
