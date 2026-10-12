# dev-baseline

| 字段 | 值 |
| --- | --- |
| app baseline | apps/playground/frontend-baselines |
| 基线源 | text_spec，用户本轮明确的白色通栏指令 |
| 冻结状态 | 已冻结：仅白底、顶边及左右边缘填满、去边框圆角和底部间隙；不更改日期框样式 |
| 起点 | 当前工作区两个文件的快照；scope checkout=/private/tmp/report-toolbar-white-scope，base=91254d8857dd41b1dc25f32d8c7fb59bab8e52a8 |
| 采用 | PATTERN-STYLE-1、PATTERN-STYLE-2、PATTERN-STYLE-5 |
| 起点质量 | 前一轮 engine check 0 errors / 0 warnings；本轮未更改逻辑与接口 |

## QA 基线

F1：通栏工具带使用现有 surface 白色，左右及顶部与报表画布对齐；无边框、圆角、底部间隙。
F2：390px/320px 容器不增加横向溢出；输入依然可编辑，当前期间和数据随合法已应用值同步变化。

所有期望来自文字指令及既有控件/状态契约，不以实现反推期望。仅承诺文字规格及几何规则，无外部像素设计稿。
执行档位：**lite**（还原 Task：无；阻断触发器：无；文件数：2/5）

| 风险触发器 | 来源 | 模块 | 独立检视与维度 | 依赖声明 |
| --- | --- | --- | --- | --- |
| visual | visual: plan | causal, targeted-quality, render, review-layout | review-layout: L2 | AT-1(mock), AT-2(mock) |
执行档位：**lite**（还原 Task：无；阻断触发器：无；文件数：2/5）

| 风险触发器 | 来源 | 模块 | 独立检视与维度 | 依赖声明 |
| --- | --- | --- | --- | --- |
| visual | visual: diff/plan | causal, targeted-quality, render, review-layout | review-layout: L2 | AT-1(mock), AT-2(mock) |
