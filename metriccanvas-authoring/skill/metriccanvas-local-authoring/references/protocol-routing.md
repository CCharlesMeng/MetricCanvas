# 专题查阅

仅在本次新增、修改或核对下列能力时读取命中的专题；已知主题时优先用 read-knowledge.mjs 精确查阅。完整模块用于深查，示例按实际采用的分支读取。

按用户操作、数据逻辑或 debug 症状找入口时，先用[场景索引](scenario-index.md)；本页用于已明确能力后的协议深查。

- 按筛选、层级、已有权限或业务事实控制显隐，以及条件按钮、表格行或文字片段：按本次修改的语义查[条件规则](page-metadata/conditions.md)。条件写在目标节点；子项全隐藏不自动收起父容器，需要整块隐藏时写父级条件。
- 页面版本与已确认形态的布局：[页面](page-metadata/page.md)、[分区与布局](page-metadata/sections-and-layout.md)。
- 概览页按本次修改的语义查[常见布局](overview-layouts.md)和[常用合法写法](component-recipes.md)；涉及地图再读[地图绑定](map-bindings.md)。按信息关系选择布局，示例数据不作为业务事实。
- 明确要求 ECharts 定制，或现有属性不能表达且用户已接受时，读[图表高级扩展](page-metadata/chart-option.md)再使用隐含 `props.echartsOption`。常规任务使用已有属性；普通修改保留已有透传，切换图表类型时按协议清除。
- 组件选型与属性：[组件索引](page-metadata/components/README.md)；先用已有组件，缺少表达能力时记录具体缺口。
- 数据与字段：[数据源](page-metadata/data-sources.md)、[结果字段契约](page-metadata/fields.md)、[字段绑定与格式](page-metadata/field-bindings-and-formats.md)。
- 多查询表格：按需核对[数据源](page-metadata/data-sources.md)的 `pagedJoin` 与[表格](page-metadata/components/table.md)的数值范围、查询分页、搜索及完整导出；使用册内完整示例核对成员引用与投影，按模块中的验收预期检查结果隔离。
  固定指标排名使用普通查询返回的独立字段并投影；`ordinalField` 仅为当前结果序号。先明确排名行域、并列规则和筛选后是否保留名次，缺少上游能力依据时只交付明确标识的仿真场景。
- 用户要求Report下载PDF、修改下载按钮名称或文件名时，读取[报告页头](page-metadata/components/reportHeader.md)的pdfExport声明和完整示例；在页面JSON中配置label和filename，不向集成应用生成截图或编码代码。
- 用户要求Report导出PDF、图片或高清长图时，读取[报告页头](page-metadata/components/reportHeader.md)的exportButtons声明和完整示例；每项是一个直接下载按钮，配置format、可选label/filename/scale。PDF支持2/3/4倍，PNG支持3/4倍且只输出一张PNG；不支持的scale按未配置处理，PDF默认2倍、PNG默认3倍，不因此拒绝页面；不生成格式菜单、清晰度弹窗、多图或ZIP；新页面不写旧pdfExport/pngExport字段。
- 复杂时间按本次修改的语义查[筛选](page-metadata/filters.md)及[静态时间查询模式](page-metadata/queries-and-bindings.md)：保留年季月、详情单月与离散月份的不同语义；modes必须配完整静态query.timeModes，可信期间输入由集成应用注入，Page/URL不能伪造事实。
- 金额与币种按本次修改的语义查[筛选](page-metadata/filters.md#amount-range)和[字段绑定](page-metadata/field-bindings-and-formats.md#field-selection)6.38规则；保留两个静态CNY/USD字段，units只换算输入，不前端换汇。
- Dashboard 正文固定单选按钮组使用独立 filterGroup；查 filterGroup.core 或[筛选按钮组](page-metadata/components/filterGroup.md)，作用范围由 filterBindings 决定。旧图表 props.filter 已移除；未知默认值或查询绑定列缺口。
- 业务筛选单/多选、封闭枚举、结构树或时间候选依赖，按本次修改的语义查[筛选](page-metadata/filters.md)6.37规则；显式queryField/levelQueryFields，options不作权限候选回退，不生成待审Condition字段。
- IOC 公共页头使用根级 `iocHeader`；旧 header 替换先读[页头迁移](ioc-header-migration.md)。字段与运行行为查[页面](page-metadata/page.md)的 IOC 公共页头及唯一页头章节；身份与 filterIds 分开，详情沿用原布局和独立单月。
- Dashboard或IOC页头需要年／季／月／近一年切换时，读取[筛选](page-metadata/filters.md)的期间选择与完整示例；声明一个 timeRange 及其查询绑定，先确定查询使用月份还是日期范围。
- 参数、日期和筛选：[参数与文字](page-metadata/params-and-text-values.md)、[筛选](page-metadata/filters.md)、[查询绑定](page-metadata/queries-and-bindings.md)。
- 计算、导航或自定义组件：从协议索引进入对应模块。


跨页链路采用显式 row/param/filter 映射；强类型声明 validateTargetInputs:true、strictURLInputs:true，并由集成应用提供目标输入投影。目标必需参数及粒度不明时列缺口；季度不自动截成详情单月。
