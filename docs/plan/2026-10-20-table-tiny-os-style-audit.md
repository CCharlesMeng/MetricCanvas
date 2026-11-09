# Table TinyVue OS 剩余验收

更新：2026-11-09。普通 Table、`forecastMatrix` 与 `embedded` 的基础网格样式已实现；`reportCompact` 保持紧凑报表外观。现行呈现规则见[表格外观与变体](../page-metadata/components/table.md#渲染外观与变体)，可运行入口为 `/pages/table-tiny-os`，操作说明见[表格示例](../../pages/capabilities/table/README.md#tinyvue-os-表格样式与变体)。

本文件只维护尚未闭合的验收范围。2026-10-20 的[实施前数值盘点](https://github.com/CCharlesMeng/MetricCanvas/blob/5dba4d40a0474f47bdf55cb2d0998bfbdb86ae2e/docs/plan/2026-10-20-table-tiny-os-style-audit.md)和[逐轮过程件](https://github.com/CCharlesMeng/MetricCanvas/tree/5dba4d40a0474f47bdf55cb2d0998bfbdb86ae2e/docs/plan/table-tiny-os)使用固定历史版本追溯。

## 待完成

| 范围 | 验收要求 |
|---|---|
| 日期筛选日历 | 对照官方日期日历的对应模式；当前日期筛选使用原生日期输入，基础网格截图不能证明日历一致 |
| 枚举候选面板 | 在同一浏览器、字体、数据及宽度下对照面板，补齐像素与交互断言 |
| hover / focus / disabled | 逐项采集控件状态，覆盖鼠标、键盘和禁用反馈；官方示例缺少对应模式时记录未验范围 |
| 真实接入 | DQE、Relay 与集成应用分别验证；合成页面、Mock 和静态像素比较不能证明真实查询或部署成功 |

历史验收仅证明已取证的基础网格与契约范围，未证明全部控件状态达到 100% 像素一致；本次文档清理没有扩大原验收结论。后续复验以当时实际源码、构建产物及页面修订为基线。
