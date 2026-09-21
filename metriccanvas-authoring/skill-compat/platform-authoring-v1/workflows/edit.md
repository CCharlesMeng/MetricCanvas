# 修改当前页面

1. 确认本轮mode=existing 的本轮 contextRef及可信完整基线、唯一目标稳定 ID 和任务相关配置。文字明确目标优先；目标缺失/歧义先澄清。读取失败保留原页，不能用创建工具重建基线。
2. 将请求映射到 edit_page 的受控操作，仅提交用户涉及的设置；每项具有唯一 id，依赖前序新增组件/筛选的项用 dependsOn。字段、绑定、结构用专用操作，输入 Schema 决定是否可执行。
3. 普通属性修改沿用已有数据和布局，不发现数据、不重新装配整页。新增数据需求先发现受治理能力，再用 add_data_component 提交单单元 spec、目标 sectionId 与新 componentId；可信源映射和查询验证通过后才将源与图表一起加入当前候选。源冲突、刻度不支持或映射缺失使该组失败，不能用 compose_page 重建已有页。已有可信源支持的 add recipe 可直接编辑。
4. 普通修改继承 layout；只有显式要求切换时加载 [report](../references/layouts/report.md) 或 [dashboard](../references/layouts/dashboard.md)，发 set_page_layout，检查呈现影响。新建默认不覆盖已有标题、容器、占位、宽度和手工属性。
5. 首次调用 edit_page(context_ref, request)；同轮续写传前次 candidate_ref，必要时用 read_page_context 指定该引用核对候选配置。独立失败项回滚，依赖项跳过，其他独立成功项须整页合法。逐项报告 applied/failed/skipped/unchanged 及 adjustments；不把部分成功说成全部完成。
6. 保留最终 candidateRef 交可信程序自动提交草稿；中间候选不保存。全失败/无变化不生成新候选，最终与根基线相同不新建修订。下一轮重新准备可信上下文；旧 contextRef、跨页/身份/轮次调用由门禁拒绝。
