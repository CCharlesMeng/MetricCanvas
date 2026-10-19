# Platform C · Alpha Tests

## 每条 AC 的可观察判定

见 tasks.md 用例追溯和冻结 QA 基线。声明覆盖本地静态及受控浏览器端口，不声明真实服务联调。

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT-01 | PROVEN | mock | C-restore；evidence/review-evidence.json | code=28f10e3d8777999b7c7ea5c30eddaeb0d6517ebd5c9c08a29e224c96c14c6956 | C 属性入口；R1-1、R2-1 |
| AT-02 | PROVEN | mock | C-restore；evidence/review-evidence.json | code=28f10e3d8777999b7c7ea5c30eddaeb0d6517ebd5c9c08a29e224c96c14c6956 | 蓝色渐变细框；R1-3、R4-1 |
| AT-03 | PROVEN | mock | C-workbench; quality_gate；evidence/review-evidence.json | code=28f10e3d8777999b7c7ea5c30eddaeb0d6517ebd5c9c08a29e224c96c14c6956 | 移动、删除、撤销、显式保存与输入隔离；F3-1～3 |
| AT-04 | PROVEN | mock | C-lifecycle; C-workbench; C-layout-overflow-states；evidence/review-evidence.json | code=28f10e3d8777999b7c7ea5c30eddaeb0d6517ebd5c9c08a29e224c96c14c6956 | 选择切换、滚动/尺寸跟随、停用与卸载；R1-2、R2-2、F3-4/7 |
| AT-05 | PROVEN | mock | C-lifecycle; quality_gate; C-restore；evidence/review-evidence.json | code=28f10e3d8777999b7c7ea5c30eddaeb0d6517ebd5c9c08a29e224c96c14c6956 | 正式渲染与预览无装饰，查询/分页状态保留；F3-5/6 |

## 还原因果证据

同一冻结契约 `da453e5e1298025859a47985eecbedf3b68bd56b55df8b9ee33b5deb64ce7921`：起点18 RED、7 GREEN；最终25 GREEN、0 RED、0 YELLOW。

GREEN：evidence/restore-report-green.json；code=28f10e3d8777999b7c7ea5c30eddaeb0d6517ebd5c9c08a29e224c96c14c6956。源冻结事实与候选取样分离；未改期望。

集成过程中发现跨分区拖拽后切换选择会触发旧 attachment 清理，已用登记序号隔离旧清理；完整浏览器流程及画布生命周期回归通过。取样等待样式过渡和稳定帧，避免把中间帧误作最终阴影或定位。

## 人工验收记录

无额外人工判定声明；用户已批准 C 原型及蓝色微渐变方向。

## 计划外承接

无。

## Deferred

无。本轮不涉及真实服务契约变更。
