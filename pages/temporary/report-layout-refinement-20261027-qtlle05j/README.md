# 服务运营月报 · 阅读布局修订

[打开新版 Report](http://localhost:5173/pages/service-operations-report-202609-refined) · [打开上一版](http://localhost:5173/pages/service-operations-report-202609-qtlle05j)

用户要求依据容器和背景层级的自评直接重新生成。本版继续使用真实Page JSON与现有RuntimeView，Report形态沿用已确认选择；Schema6.69。旧页面及旧验收证据保留。

## 布局取舍

白色承担完整阅读区域，浅蓝只留作页面底色与章节间隔。封面、团队、趋势、客户、阶段、构成各有清楚的区域边界，同一章节的标题、说明和证据不再散落在不同背景上。

团队章节内部保留两组对象身份，每组采用metricGrid组合卡和两个compactStrip指标；对象内不重复画卡框。主值28px、默认深色；八个变化值12px，工单增绿减红仅表达方向，时长降绿升红。基期数值保留在共同说明内。

趋势占7轨、精确数表占5轨，合并在同一白色阅读区；客户原因随行，阶段仍是一张分组表头表。构成采用C4-D两组精确分类明细，三行与两行自然撑高，去掉小环图、大卡面和多余留白。

仅使用当前协议的容器、变体与字段绑定，没有页面CSS、Svelte、ECharts高级定制或产品实现。当前Report蓝底未改，仍可在窄边与间隔看到。

## 验收

- 1440与1280实际CSS视口均通过：页面无横向溢出，所有表格无横向滚动；客户最长原因及阶段末列完整可见。
- 所有6个数据源与上一版逐对象深比较一致；上一版JSON摘要未变。改动只涉及呈现与忠于事实的文字，没有新增业务指标。
- 两次完整产物均在校验前冻结。首轮结构通过，但summary变体出现渐变标题、重复层级，视觉弃用；第二轮改用metricGrid/compactStrip后通过。记录位于`/tmp/report-layout-refinement-20261027-qtlle05j`。
- 当前新标签warn/error为空；本页全部为inline合成数据，不是DQE、Relay或DeepSeek API复验。
- 临时脚本使用metriccanvas-ts-ast/1、TypeScript5.9.3实测：refine.mjs无函数，compact-teams.mjs新增map回调selfCC=1；无修改的存量函数，无超限项。未改产品代码，不要求新建功能的协议/Skill同步，未重跑广泛回归。

## 产物

- [最终JSON](service-operations-report-202609-refined.json) · [可读验收JSON](acceptance.json.txt)。后缀txt避免被`pages/**/*.json`误发现成页面。
- [1440整页截图](final-1440-full.jpg) · [1280整页截图](final-1280-full.jpg) · [1280阶段与构成](final-1280-stages-composition.jpg)。
- [首次产物](/tmp/report-layout-refinement-20261027-qtlle05j/attempt-01/service-operations-report-202609-refined.json) · [最终快照](/tmp/report-layout-refinement-20261027-qtlle05j/attempt-02/service-operations-report-202609-refined.json) · [机器验收](/tmp/report-layout-refinement-20261027-qtlle05j/acceptance.json)。

没有提交、推送或清理工作树。单张页面证明该场景的呈现效果，不证明普遍创作提升。
