## 下钻详情页自动返回

复用用途：IOC 页头统一按浏览器后退能力显示，旧 auto 与 true 等价。静态合成演示，不访问 DQE。启动 `pnpm dev:playground`。

可观察预期与环境：

1. 打开 `/pages/ioc-auto-back-source?region=north`，点击“下钻项目 1”，进入 `/pages/ioc-auto-back-detail?project=1`。详情页正式声明 `props.back:true`；浏览器可以后退时显示，点击后退一条记录。
2. 详情刷新、修改“仅有效”不会增加返回来源要求；同页手改查询参数后，返回遵循浏览器历史，不跳过这些记录。
3. 先访问 `/pages/ioc-auto-back-unrelated` 再进入详情，返回仍显示并退回上一页。新标签页没有可后退记录时隐藏；若已有浏览历史则按实际后退能力显示。
4. 点击“继续下钻”进入 `/pages/ioc-auto-back-subdetail`，原生后退先回详情再回清单。无需下钻来源存储；不支持 Navigation API 时使用 `history.length>1` 回退判断。
5. 访问 `/pages/ioc-back-hidden`，即使已有历史记录，`back:false` 仍隐藏。静态导出同样隐藏。旧 `auto` 的等价行为由历史契约夹具与浏览器测试动态挂载验证，新页面不再写 auto。

参考对象：首分区首个 `iocHeader` 的 `props.back`，保留现有标题、参数与筛选声明。

移植边界：用 `true` 启用；自定义集成返回通过 `navigation.back`，不需要 `returnContext.entryId`，旧 `returnContext.back` 不再作为页头动作。浏览器自身返回不保证恢复分页、排序、Tab 和滚动。真实门户的路由、导航守卫及权限另外验收。
