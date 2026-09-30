# 本地 main 合并与验收

2026-09-30：本地主目录 main 从 6954c77d 快进到 27b6604e，恢复原有 IOC 6.12 工作，解决 RuntimeSurface 与 orchestrator 的合并冲突。保留字段统一格式、完整 initial 校验，以及 IOC 的详情视图、内容切换和计算能力。默认本地表格分页改为 10 行，显式配置优先；图表窗口仍保留 20 个类别，不裁剪结果。

## 实际浏览器验收

使用正在运行的 http://127.0.0.1:5173/preview，加载原始 `/Users/moon/.codex/artifacts/metriccanvas-deepseek-20260930-1110/manual-preview.json`。此次没有重新调用模型，也没有修改该 JSON。

- 数值轴：30000000 显示为 3,000.0万；Tooltip：89400000 显示为 8,940.0万。
- 表格 128 行，首页 10 行，第 13 页 8 行；无页面异常。
- 图表保留两个 dataZoom 控件。

详见 browser-acceptance.json 和 table-last-page.png。

## 检查边界

- engine 与 platform 类型/Svelte 检查通过。
- engine + page 测试：924 通过，5 失败；失败均涉及原有 IOC Schema 6.12 与尚未生成的 6.11 契约向量不一致。
- Python 测试：513 项，1 失败，同为文档版本 6.12 与旧向量 6.11 不一致。
- authoring:contracts 未通过：IOC 新增字段、枚举和分支缺少 reference-map 语义说明及例子，生成器拒绝输出；没有手改生成产物或跳过检查。ADR-0096 已注明创作契约待同步。
- 已同步两处因 IOC 行为变化而过时的负向向量预期，并给新增 cross-source fixture 补显式 report 布局。
- 本次结果用于本地 main 人工验收，不代表完整 CI 或 Skill 6.12 分发验收通过。
