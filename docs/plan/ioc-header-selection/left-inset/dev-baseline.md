# 修复基线

用户当前16px指令直接冻结期望，不额外确认。采用PATTERN-STYLE-1、PATTERN-COMP-1、PATTERN-TEST-1；规范正文见packages/ui/frontend-baselines。

## 执行起点（环境）

5186页面当前树padding为0px，首层expand.left=20，panel.left=20，实际间距0px。已有局部声明16px被官方Theme更高优先级padding:0覆盖。无协议、数据或新交互变化。

## 冻结 QA 基线

| 编号 | 判定对象 | 触发方式 | 期望表现 |
| --- | --- | --- | --- |
| F3-1 | 树左留白 | 普通根和ShadowRoot打开并展开 | 首层加减号边缘相对面板为16px；树内部缩进不变 |
