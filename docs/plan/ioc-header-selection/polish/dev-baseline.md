# 修复基线

用户当前指令已授权修复并细查布局颜色；此前已确认规则不重问。基线源为上述文字规格和SHA冻结的官方样式。采用PATTERN-STRUCT-1、PATTERN-COMP-1、PATTERN-STYLE-1、PATTERN-RUN-1、PATTERN-TEST-1、PATTERN-DATA-1。

## 执行起点（环境）

/Users/moon/.codex/worktrees/ioc-selection/DataDashboard，前序代码为本修复起点，8文件SHA/内容副本保存在.work/before，前序Story证据保持历史。CUA IAB已在实际5186页面复现：点击“卓越 NA”后仍collapsed。组件浏览器是最小化反馈环。没有服务或协议变更；数据为合成fixture。

## 冻结 QA 基线

| 编号 | 判定对象 | 触发方式 | 期望表现 |
| --- | --- | --- | --- |
| F3-1 | 鼠标点击 | 点击已选标签、空白与箭头，再次触发 | 面板打开保持、再次关闭；搜索可用，无值提交 |
| F3-2 | 删除/清空/滚动/禁用 | 点击删除、横向滚动、禁用后操作 | 只删除对应值；滚动不裁剪；禁用不打开 |
| F3-3 | 颜色几何 | 实际页面及组件夹具 | 灰底深字标签，32px输入，16px箭头居中可见；颜色/间距与官方冻结token一致 |
| F3-4 | 页面及隔离 | 1440和390px，普通根与ShadowRoot、安装包 | 点击可用、浮层在视口、值与查询规则不变，样式不泄露 |
