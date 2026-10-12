# dev-baseline — report-date-picker-tiny-os

| 字段 | 值 |
| --- | --- |
| app baseline | apps/playground/frontend-baselines |
| 基线源 | 参照页 https://opentiny.design/tiny-vue/zh-CN/os-theme/components/date-picker |
| 冻结状态 | 已冻结 ✅；用户 2026-10-11 明确要求按 handoff 实现，沿用其官方 OS 基线 |
| 起点 | 当前混合工作区；三个修改文件快照和摘要见 .work/start-files.json |
| 场景 | 正式 Svelte 引擎；合成数据 playground 与 HTML embed |
| 起点质量 | engine check 起点 0 错误 0 警告；其它已知基线见原 report-date-filters |
| 采用 | PATTERN-STRUCT-1、PATTERN-DATA-4、PATTERN-STYLE-4 |

用户要求集中浏览器验证；不做每个 Task 的浏览器 RED 回合，原 handoff 冻结原生控件缺口作为因果起点，完成实现后集中验证。

## 工程依据

只读独立勘察复核 PATTERN-STRUCT-1/2、PATTERN-DATA-4、PATTERN-STYLE-1/2/4、PATTERN-TEST-1/2。夹具留在 engine 自有测试目录，不新增公共出口。CSS 编译进 Svelte 样式，使 HTML open ShadowRoot 使用相同样式。

## QA 基线

| 编号 | 具体期望 | 来源 |
| --- | --- | --- |
| R1-1 | 单选 1 个文本输入；范围 2 个文本输入、1 个 -、右侧官方 SVG | handoff 与官方 DOM |
| R1-2 | 月份单网格 12 个单元、4列3行，范围两个年份网格 | reference-month-open/range-open.json |
| R1-3 | 日期 7 个星期标题、6周、相邻月份；范围相邻双月 | reference-date-open/range-open.json |
| R2-1 | 星期日一二三四五六、月份 N 月、分隔符 -、原字符串值协议 | handoff 第5节 |
| R3-1 | 输入32px、圆角6px、边框1px solid #c2c2c2、14px #191919 | default-style-facts.json |
| R3-2 | 单选 padding 0 40px 0 12px，line-height 32px | default-style-facts.json |
| R3-3 | 范围 padding 3px 10px；内部无边框、0 padding、24px高、14px行高 | default-style-facts.json |
| R3-4 | 单面板360px、范围558px；月245px、日307px；白色、6px、0 4px 16px rgba(0,0,0,.08) | 四份 reference-*-open.json |
| R3-5 | 月份网格328/259px ×180px；行60px | reference-month-open/range-open.json |
| R3-6 | 日期网格328/259px ×240px；星期栏32px | reference-date-open/range-open.json |
| R4-1 | focus边框#191919；选中#1476ff白字；范围#deecff；今天圈#191919；hover#deecff；禁用#f0f0f0/#c2c2c2 | 官方实时DOM + 冻结部署CSS + selection-style-facts.json |
| R6-1 | 1440/390/320页面不溢出，输入不重叠；保持面板内容360/558px，不缩放，窄屏在顶层视口内横向滚动访问 | handoff 第6节；官方固定宽度与用户要求无横溢出，采用保尺寸滚动承接 |

以上数字均为开工前官方事实；不以实现反推期望。未放宽100%目标。官方动画结束后的稳定状态比较；非冻结系统字体环境不混比。

## 功能声明

F3-1 非法/半范围/倒置文本不提交，完整合法值更新统一筛选状态。F3-2 可选清空为null、required拒绝清空、只读禁用。F3-3 监听和顶层浮层随关闭销毁清理。F3-4 打开面板导出PDF仍无控件。F4-1 无UTC日期转换、保留datetime。

## 初始验证组合

standard；visual/interaction/shared-boundary；causal、targeted-quality、render、regression、review-layout、review-convention、review-quality。场景同连接批量采集，用户要求不逐Task浏览器验证。

## 最终验证组合

standard；build-config/interaction/shared-boundary/visual；restore-final；独立检视 L2/L3/L5、C1/C5、Q2。正式机器组合见 evidence/portfolio.json。
