# 层级筛选联动父子表格实施交接

2026-10-27。用户已在本会话完成 grill，并对实际可交互原型确认：“没错，就是这个意思，handoff一下，然后在新会话中完成这个功能”。本交接授权新会话直接实施与验收；不再重复确认已定业务行为。

## 开始执行

1. 读取仓库 AGENTS.md、[唯一主方案](2026-10-27-hierarchical-row-expansion.md)、[已确认原型说明](../../packages/engine/widgets/prototypes/hierarchical-row-expansion/README.md)。主方案拥有完整业务矩阵、正式声明草案、代码冲突及P0–P5；本文件只组织交接执行。
2. 源检出为 `/Users/moon/Documents/Code/公司项目/DataDashboard`，交接时 main 的 HEAD 为 `9ee7e6ac611e5651046dde16f9b5fc44dc0974b1`，产品 Schema 当前为6.69。开工重新检查实际状态、远端基线、已有工作树和当前版本；候选6.70不代表已占号。
3. 源检出有大量其他任务的未提交修改，集中在报告范式、MC/local-authoring生成产物、Platform配置及其证据。本任务自己的新增材料只有主方案、本交接、`packages/engine/widgets/prototypes/hierarchical-row-expansion/`，以及 `docs/plan/README.md` 的单行入口。按仓库 scoped-main-delivery 技能选择干净独立 worktree 实施，保留源检出的并行工作。
4. 这些新增材料尚未提交，不会随新 worktree 自动出现。可从上面的源检出读取，或按精确文件复制本批文档；原型作为只读参考。不得复制整份混合源码或生成树作为基线。原型评审已通过，独立试验分支留存尚未执行；按 prototype 与 scoped-main-delivery 要求保存原型证据及分支指针，正式交付不包含原型HTML、内嵌ExcelJS或模拟定位字典。
5. 在主方案中更新实施进度；完成证据放 `docs/evidence/hierarchical-row-expansion/`。不再建立第二份业务规格。

## 必须保留的决策

- 这是通用协议能力，不针对某个现有业务页面硬编码 region、地区部或代表处名称。
- 默认首屏完整查询地区部，代表处明细按展开取数。选地区部仅保留对应父行；选代表处先定位所属地区部，仅保留并自动展开该父行，子表只查所选代表处。父指标始终为地区部整体，不按代表处缩小，不在浏览器重算。
- region 单选。region 的层级/选值变化时，父子表视图恢复默认；其他业务条件变化保留展开或手动收起、搜索、排序与每页条数，父页保持、已展开子页回第一页。父行不再可见时释放实例。相同逻辑选择不能反复触发自动展开。
- Excel一次导出当前业务条件下全部匹配父行与子表，包括未展开/未加载部分，两个工作表。父表搜索与表头条件限定父行范围；父表当前页不限制。忽略子表局部搜索、排序、页码及展开状态。冻结条件，任何子表失败均不下载部分文件。PDF/PNG不在本批。
- 当前已支持的旧版页面不迁移、不增请求；旧子表未显式启用 selection 时保持旧生命周期。新功能字段有能力下限；旧输入缺值语义、数字行键、recordList、旧父查询分页、普通Excel和既有PDF/PNG规则保持。

## 父级定位是关键数据契约

已撤回“实际候选或代表处行一定有 parent”的前提。默认 DQE 候选只构造 value/label；现有层级控件不会自动把上层已选值保留为下层来源。候选模型里可选的 parent、Sim夹具里的归属或第一次手动展开过的数据，都不能保证任意代表处可反向定位。

采用显式 `selection.parentLookup`：普通受控查询输入所选代表处，输出地区部稳定值；`parentLookup.field` 对应 `selection.parentField` 指定的父表字段，匹配出的行再用实际 rowKey 管理展开。候选合法性与父级定位是两个前提；定位等待、空、多父值、失败或越权均不退回全部。

三个取数单元分别为完整地区部指标、父级定位、分页代表处明细。定位数据源只消费归属所必需的条件；业务期间或产品无数据不能被当成没有归属。历史组织归属若依赖期间，显式绑定并纳入依赖。真实服务能否执行office→region查询尚未验真；先完成产品及Sim验收，并独立报告接入需求，不声称已支持某真实组织接口。

主方案中的推荐字段为 `rowExpansion.selection`（filter、parentLevel、parentField、childLevel、parentLookup）、子表私有 `source:selection`、`toolbar.export.rowExpansion`。命名或内部实现可依当前真源收敛，但要保持这些显式关系与所有已确认行为，先给出完整合法Page再改Schema，不把新分支扩散进通用导航或放松旧校验。

## 实施重点与完成条件

依主方案P0–P5连续完成，不停在Schema或局部单测：

1. 协议、能力下限、语义校验与完整Page正反例；新增ADR局部修订0113，并同步主题页。当前ADR索引有既存编号转述漂移，按实际文件分配编号。
2. 使用现有SourceProgram执行按需私有定位；source-scope/依赖扫描须同时认识定位模板与子表模板。默认首屏不执行定位模板；URL初值选子级时允许先定位再查目标子表。共享执行与浏览器保持一致。
3. 父表完整结果的私有投影先于搜索/排序/本地分页，不修改共享raw、compute或resultBindings。parentField匹配与rowKey身份分开；定位及父行匹配都要验证唯一性。
4. 整体处理状态冲突：ExpandableTable的全filters scopeKey会重建控制器；expansion.retain比较整条父行JSON会误关闭；tableController.reset会重置父页。保留展开身份与合法会话，更新查询作用域，并覆盖取消/迟到响应。
5. 完整父子Excel复用完整读取、列投影与单表写入，建立独立冻结任务；不读取当前子窗口冒充全量，不靠展开DOM导出。预算、超时、取消及严格失败由整个任务统一管理。
6. 按[功能验收](../agents/feature-acceptance.md)完成真实Playground浏览器操作、协议参考、local-authoring与MC生成同步。示例用Dashboard，建议 `/pages/table-hierarchy-selection`，明确合成数据。按[Skill维护](../agents/local-authoring-skill-maintenance.md)生成并仓外独立安装验真；默认不追加其他Skill或真实DS模型专项。
7. 编码前后按[复杂度规则](../agents/code-complexity.md)实测修改函数和全部新增辅助函数，新增selfCC≤15。按改动运行有意义的行为/兼容/浏览器/构建检查；实际读取Excel验证两个工作表及行数。旧页面的请求次数与状态行为也必须回归。

完成说明给出正式声明、实际实现范围、Playground可访问入口、测量前后值、各层验收结果及真实服务未覆盖项。提交/push/main按实际授权与仓库scoped-main-delivery规则执行，本交接不宣称已完成Git交付。

## 原型证据与边界

- 单文件原型：`packages/engine/widgets/prototypes/hierarchical-row-expansion/index.html`；双击即用。当前可选预览 <http://127.0.0.1:5208/>；进程停止时按原型README重启即可。
- 用户已确认的观察：上海选择只保留并展开华东，父整体1200、上海360；年度变化仍展开；已展开子表第2页切条件回第1页；父表第2页切条件仍第2页；收起后切条件不自动打开。
- 实际浏览器下载Excel回读：屏幕只展开华东并只搜上海时，工作簿两个sheet的数据行数仍为4和17。截图与119个作者函数CC1–10的测量在原型目录。
- 定位查询使用独立模拟夹具，代表处明细无parent。上述证明的是用户期望与模拟交互，不是正式Schema、真实DQE、Relay或生产权限已验收。正式能力尚未实现。
