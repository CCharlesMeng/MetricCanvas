# 公共 UI 前端设计

## 目标与 AC 引用

AT-UI-1～7，主实施计划 W2/W3、AT01～04。工程选择引用 Requirement REQ-DEC-1/2/3。

## 对接模式

受控中性值/选项/行列与回调；Grid 行键由调用者提供，服务页不重复切片或本地排序。Dropdown/Dialog 留在原挂载根并清理监听。原生输入持续发 input，commit/blur 可显式消费最后值。Svelte snippet 由调用者定义单元格。

## 文字规格

只实现管理使用的 Button/Input/Textarea/Select/Tabs/Tag/Pagination/Grid/Dropdown/Dialog/Empty。日期从原实现无外观变化提取；月/日单值和范围、输入草稿、禁用/必填、清除、键盘及原根浮层保留。组件文案来自调用者，不引入页面资产状态。Dialog 有标题、正文、操作和关闭入口，关闭归还焦点；Dropdown 低频动作包含禁用/危险状态，Escape 关闭。Empty/加载/错误各有真实语义，未知不绘制成成功。

## 当前代码事实

新 UI 包骨架已建立；未实现组件不计验收。原日期及 MIT 归属位于 engine/runtime-ui/filters；共享日期向量不导入页面 Schema。

## 状态、交互、接口与数据映射

默认/hover/focus/disabled/selected/open/empty/error 按官方对应状态冻结；rows/page/active 归调用者；不请求服务。

## 风险与依赖

官方来源在 docs/evidence/platform-ui-os-theme-2026-10-12；可读 CSS 资产已按部署摘要保存，浏览器同态样式比较待补。最小消费不证明全部交互、视觉或真实门户。
