# B5 显式跨页传值（收窄范围）

用户本轮明确：B5只做跨页传值，不需要恢复；B6挂起。本指令覆盖主计划早期B5完整视图恢复建议。

实施只包含N01–N03及跨页URL打开/刷新输入：row/param/filter显式映射；源类型/空必需值/目标输入契约校验；目标授权候选就绪前保持查询门禁；每个页面独立。保留已有普通URL导航和基本返回行为，不新增或删除历史能力。

不实现RuntimeViewSnapshot/RuntimeViewStateHandle、导航条目存储、分页/排序/Tab/滚动/行展开/页头状态恢复；N04–N08未选部分留在88项规划，不标完成。B6挂起，不启用actions、主题、全屏、刷新、重置或整页导出。

技术落点：受控导航新增显式validateTargetInputs意图；集成应用提供当前目标页面输入投影，源页只做声明校验，不获取目标授权候选。引擎预载投影后同步生成可校验的真实anchor，失败无href并在操作时给可定位错误，普通导航维持原入口。目标页独立严格解释显式URL输入；动态候选仍走现有门禁。Svelte与Embed共用RuntimeNavigation接缝，Playground连接实际页面仓库。

验收：实际source/list/detail页面与Playground目录直接访问；合法传项目键/名称/月份/多值/币种，季度不截成单月、缺必需键与无契约拒绝；无隐式同名继承；来源与目标相互独立；新窗口/刷新只消费URL。单元/集成、Playground浏览器、Embed和仓外Skill/包分开记录，真实服务未运行。不提交不推送。

起点：HEAD952b3a273f0f4f8be5820f5af1bb76c2f5afa513；未提交B4指纹30b89eccacc97406d8028b0f06bd1e9dff94a00f5ca90a00a44272f28117257a；822文件已逐hash验证及备份。原工作区本批起点状态见evidence/start-manifest.json；所有实施只在既有隔离工作树。
