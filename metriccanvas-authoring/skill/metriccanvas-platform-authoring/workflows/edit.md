# 修改当前页面

1. 确认本轮mode=existing 的本轮 contextRef及可信完整基线、唯一目标稳定 ID 和任务相关配置。文字明确目标优先；目标缺失/歧义先澄清。读取失败保留原页，不能用创建工具重建基线。
2. 将请求映射到 edit_page 的受控操作，仅提交用户涉及的设置；每项具有唯一 id，依赖前序新增组件/筛选的项用 dependsOn。字段、绑定、结构用专用操作，输入 Schema 决定是否可执行。
3. 普通属性修改沿用已有数据和布局，不发现数据、不重新装配整页。新增或改变数据需求可发现受治理能力，但当前 edit_page 不支持新增查询源/任意数据图表；发现成功也不能绕过此缺口，保留原页并说明未支持。已有可信源支持的 add recipe 可直接编辑。
4. 普通修改继承 layout；只有显式要求切换时加载 [report](../references/layouts/report.md) 或 [dashboard](../references/layouts/dashboard.md)，发 set_page_layout，检查呈现影响。新建默认不覆盖已有标题、容器、占位、宽度和手工属性。
5. 调用 edit_page(context_ref, request)。独立失败项回滚，依赖项跳过，其他独立成功项须整页合法。逐项报告 applied/failed/skipped/unchanged 及 adjustments；不把部分成功说成全部完成。
6. 有合法产物由可信程序移交生命周期；全失败/无变化保留旧页。同轮继续编辑产物等待后续候选链能力。下一轮重新准备可信上下文；旧 contextRef、跨页/身份/轮次调用由门禁拒绝。
