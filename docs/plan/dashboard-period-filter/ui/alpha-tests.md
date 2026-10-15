# Dashboard 期间筛选验收账本

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 说明 |
| --- | --- | --- | --- | --- |
| AT-UI-1 | PROVEN | mock | BE-1；UI Chrome 22 tests；calendar.test.ts | 年季月、键盘与 ShadowRoot；不声明业务数据真实性 |
| AT-UI-2 | PROVEN | mock | BE-2、BE-3；period-filter.spec.ts | 无输入、上月截止、历史日期无关、跨月和返回历史月 |
| AT-UI-3 | PROVEN | mock | BE-3；period-filter.spec.ts | 正常、更多、compact 只读和 390px 无横向溢出 |

## 自动验收记录

详见 ../../../evidence/dashboard-period-filter/result.md。真实 DQE、Relay、Java 和真实模型未验证，Edge 未安装；上述三项为本地前端声明，不提升为真实接缝完成。

## 计划外承接

无。

## 人工验收记录

无必须由用户签名的验收项；截图和浏览器操作由 agent 完成，未代签用户。

## Deferred

无新增外部接口；真实环境接入验收保留在整体交付记录的未验证范围。
