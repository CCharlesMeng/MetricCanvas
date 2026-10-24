# 结构计划中的表达字段

plan.sections[].title 是模块可见标题；块 title 是对象/图表标题。businessQuestion/businessObject 是计划语义，不自动变成可见标题。title 由 compose 生成 header/page-header，sections 提交业务章节；工具的 sources 直接映射稳定源 ID 到原始 resultRef 字符串，同源可复用。

结果引用装配可由程序生成口径说明；修改过或新轮历史基线中的说明按受控编辑处理，SCOPE_NOTE_REVIEW_REQUIRED 由回执表达。字段重复不会自动授权删组件。显示单位由可信字段/defaultFormat 与格式器决定，原始值不变。

用户问题如何分章、是否省略单组件同义标题、模板/宽度采用和最终视觉判断属于 Skill 决策；页面 Schema 校验和布局检查不证明阅读任务已经完成。可选场景建议不是编译器强制检查。
