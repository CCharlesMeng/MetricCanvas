# 引擎 Table TinyVue OS · Alpha Tests

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
|---|---|---|---|---|---|
| AT-01 | UNVERIFIED | mock | BE-1, BE-7; evidence/restore-report-green.json（26 GREEN） | code=268b23130c6b0d09be05c3ce31ef29ff71b2212683d85613f6b278e79cb284ff | 三种基础网格在相同浏览器、字体、内容、列宽下 PNG 字节相等；字体、表头/体尺寸、边框、基础图标已验证。完整筛选日历、枚举面板以及全部 hover/focus/disabled 像素尚未逐项对照，不能宣称整体100%。 |
| AT-02 | PROVEN | contract | BE-2, BE-3, BE-5, BE-6, BE-9; 15项浏览器测试 | code=268b23130c6b0d09be05c3ce31ef29ff71b2212683d85613f6b278e79cb284ff | 内联操作和仓内查询/导出契约 mock；不代表真实DQE/Relay。 |
| AT-03 | PROVEN | mock | BE-1; compact-preserved.png | code=268b23130c6b0d09be05c3ce31ef29ff71b2212683d85613f6b278e79cb284ff | 旧字重、内边距、行高及字符图标保持；所有新皮肤与几何排除compact。 |
| AT-04 | PROVEN | mock | BE-4, BE-8; fixed-geometry.json, fixed-overflow-geometry.json | code=268b23130c6b0d09be05c3ce31ef29ff71b2212683d85613f6b278e79cb284ff | 宽屏两侧各2列的累计偏移与实际列宽一致；390px可内滚；过宽固定区域临时取消横向固定，单元格邻接间隙均0，恢复宽度后恢复固定。 |
| AT-05 | PROVEN | mock | quality_gate/authoring-local,authoring-contracts,bundle | code=268b23130c6b0d09be05c3ce31ef29ff71b2212683d85613f6b278e79cb284ff | 隔离真源导出后只合并table文档及对应哈希；70项知识/独立安装/引用测试通过，最新生成一致性及2718个摘要核对通过。 |

## 本轮实现与修复

普通/forecastMatrix/embedded 使用局部 OS 皮肤；保留容器高度、对齐、业务颜色、查询和作用域。只改呈现几何；无页面协议字段新增，平台 Grid 不变。

独立检视确证并修复：显式值色链接被默认样式覆盖；静态导出中伪元素短线失去定位容器；自动列宽变化后固定偏移不更新；窄屏两侧固定区域相互覆盖。最后一项补了实际单元格矩形不交叠、中间列可到达与宽度恢复后的固定恢复断言。筛选 SVG 尺寸改用跨文件 CSS 变量。最终检视无阻断或建议遗留。

## 尚未闭合的100%声明

需要在同一浏览器、字体、数据和宽度下，对官方筛选日期日历、枚举候选面板、全部 hover/focus/disabled 状态采集对照并补齐像素断言；现有日期筛选仍使用原生日期输入。官方示例未提供的对应模式也不得用基础网格截图替代。此项保留为 AT-01 未验证；没有要求用户重新确认已批准的三种变体范围。

本轮未提交、push、远端CI或真实服务验收；保留工作区内并行改动。
