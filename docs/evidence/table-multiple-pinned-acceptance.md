# 多查询置顶行交付证据

基线 origin/main=47f681f6b1813fb969eca05768119e430651b923。该基线已经包含期间比较的 Schema 6.78，因此本批置顶行增量为 Schema 6.79，local-authoring 升为 1.17.0。

## 范围与验证

新增 pinnedTop.additionalData 和列级 pinnedTop.text；校验、运行时投影、原始空值显示与 Excel 导出沿同一声明处理多条独立单行查询。旧单源置顶行保持。页面 /pages/business-result-metrics 基于用户原 JSON，保留八个源并新增六条汇总查询；全部 query/dqe，无 inline、initial 或内嵌行。地区部汇总只绑定时间；代表处汇总绑定时间与 Region，选择地区部发送 region_dept_code。默认 Playground 不注册合成网关。

合并后 page、engine、Playground check 通过（Svelte 零错误零警告）；validate、table-pinned、table-multiple-pinned、business-result-query 四文件 22/22 通过。单页独立校验零错误。正式生成链重新生成契约、参考与 Skill；完整 Skills、MC 和远端 CI 以本次交付回执为准。

浏览器已在本地通过显式合成回执验收两表合计、地区部选择、时间重查、空/失败汇总保留明细；移除自动合成接线后，真实 DQE 配置页显示 IOC Header 及两表结构，因为本地缺可信区域候选而等待筛选。合成测试不证明真实 DQE 聚合、权限或部署。用户将到内网验证真实取数。

原页选择地区部时隐藏上表的 visibleWhen 保留；选择 office 时汇总沿既有层级绑定进一步缩小，没有新增父地区部反查。既有详情页与客户分类等业务接线不扩大本次范围。

## 复杂度

metriccanvas-ts-ast/1，TypeScript 5.9.3，函数自身 selfCC；Svelte 提取 script，模板分支不计。修改函数：tablePinnedErrors 9→4、projectTableRows 6→7、tableRowColumn 3→4、assertPinnedExport 8→9、hostRenderSnapshot 6→6、exportSlotSnapshot 6→6、prepareSlotSnapshot 6→6。

新增辅助函数：tablePinnedSlots=3、pinnedSourceErrors=8、pinnedSlotsReady=1（回调=4）、pinnedTextBinding=1、hasPinnedText=2（回调=2），其他新增测试与夹具函数/回调均≤15。未改动的 exportComponentData=23，未扩张本批范围；本次修改/新增函数无超限未关闭项。撤除临时 Playground 接线后路由和场景函数回到远端基线。
