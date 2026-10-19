# 条件显隐与动作资格

6.34起，使用visibleWhen控制节点展示，使用enabledWhen控制动作执行；条件写在其控制的节点，未声明时沿用原行为。分区、组件、筛选器、分区组、Tab和正文片段使用同一条件。父级隐藏覆盖后代，子项全隐藏不反推父级；标题、容器和原布局占位保留。需要整块隐藏时把条件写在父级。

```json
{"visibleWhen":{"filter":"organization","part":"level","op":"ne","value":"department"}}
```

上述ID必须已声明。filter可读取level、values、value、from、to，合法part由筛选器类型决定。permission读取集成应用已有布尔结果，fact读取有限具名事实，row只在合法行上下文读取字段。条件组合为all/any/not，最多4层64叶子；比较严格区分类型，不执行脚本和动态属性路径。缺少外部输入、类型错误和等待不会被not变成允许，错误与等待内容不展示；其他独立内容正常呈现。

维度多选用containsAny/containsAll和values，标量用eq/ne、in/notIn与value/values，数值支持gt/gte/lt/lte。isNull/isNotNull判断标量空值，isEmpty/isNotEmpty判断字符串或集合。维度无选择是已知空集合；层级无选择仍保留当前level，URL可以仅携带层级。

分区组和Tab的条件同时限制入口与内容。当前选择失效时回退到可用默认项或第一项；无可用项时不选中任何项，但不收起父容器。URL初选只在初始化读取。数据加载、空结果和查询错误不改变节点的条件资格。

表格props.rowVisibleWhen只投影本表完整本地结果，先于搜索、表头筛选、排序和本地分页；不修改共享源或合计口径。远程query/pagedJoin窗口必须改用filterBindings重查；不能删掉本页行后沿用源总数。含条件行交互时使用稳定rowKey。

button组件使用props.label和单个props.action，顶层可声明visibleWhen/enabledWhen。writeFilter支持互斥的field或value分支，目标必须是有查询绑定或显隐消费方的维度筛选器。独立按钮没有当前行，不能引用row或行字段动作。

text的props.parts可声明{id,text,visibleWhen?}，与body/bodyFormat互斥，纯文本按顺序连接，标点属于片段本身。它与现有Text Value的{parts:[字符串或引用]}位于不同层，原有标题组合保持原义。

集成应用可提供displayInputs的getSnapshot/subscribe，携带permissionRevision、permissions、values及依赖筛选的filterRevision。筛选条件页无需外部输入。权限会话变化立即停用旧内容、详情及导出，集成应用用当前身份重新初始化；页面无法改写已有权限。

PDF/PNG导出捕获当前条件和筛选，展开所有允许的分区/Tab，不受当前选项限制；条件禁止的内容不导出，允许的空父容器保留。XLSX使用同一表格行投影。普通筛选变化不修改已捕获导出，权限修订变化取消下载；隐藏不会自动停止查询。

验收入口：[层级联动](examples/page-visibility-region-linkage.json)、[外部事实Sim](examples/page-visibility-inputs.json)。示例使用明确的本地演示输入；内联数据与Sim事实不能替代真实CloudIOC/DQE联调。
