---
name: metriccanvas-local-authoring
description: 在本地 Coding Agent 中，根据自然语言、设计稿或旧页面创建和修改 MetricCanvas 页面 JSON，使用随 Skill 提供的页面协议、示例与独立校验器。用于本地看板、报表和 IOC 页面创作；线上工作台工具编排不属于此入口。
---

# 本地页面创作

交付统一运行时可消费的页面 JSON。直接编辑用户指定的文件；知识和辅助脚本只读取本 Skill 目录，不依赖其他 Skill、仓库源码、在线 MCP 或仓库中的文档路径。用户提供的页面、设计源、数据契约是工作输入，可以位于项目目录。

## 先识别并确认布局形态

新建、整页重组或切换布局形态时，先读[形态识别与确认](references/page-form.md)，根据本次需求或设计源给出推荐的 Dashboard（看板）／Report（报表）、具体依据与冲突，取得用户对形态的明确确认后再生成页面。未确认时只交付识别摘要和确认问题，等待回复；不写页面 JSON、模板或章节骨架。自动识别是建议，不是用户确认。

确认摘要包含推荐形态、内容分组与阅读／操作顺序、主要交互位置、候选范式，以及冲突／未知项。用户本轮已明确指定形态，或本任务已有仍然有效的明确确认，且没有未解决冲突时，直接引用选择并简述组织方向后继续，不重复询问。用户指定与设计源或已有页面发生实质冲突时，列出冲突和适配选项，取得针对冲突的明确确认后再生成；已有形态选择不自动解决后来发现的冲突。已有页面的局部修改沿用原形态。确认绑定本次目标页面，修改业务口径不自动撤销确认。

确认后按形态分流：Dashboard 读[看板范式](references/dashboard-patterns.md)，Report 读[报表范式](references/report-patterns.md)，选最接近的一张范式卡，再读其结构摘要与对应协议模块。范式帮助组织内容，不替代用户设计和数据契约。新页面显式写 `layout: "dashboard"` 或 `layout: "report"`；生成与最终交付均核对它与已确认形态一致。省略布局会默认 report，不能作为识别结论。

## 确定需求与数据依据

确认新建或修改、目标文件、业务口径、布局形态及必要交互。修改已有页面先查看原文与文件差异，保留未要求修改的显式设置。以用户确认的需求为准，不从示例推断 IOC 业务事实。

数据来自已有页面、用户提供的结果字段契约和已验证查询，或明确允许的演示数据。新增或改变 query 口径需要实际数据上下文与执行依据；缺少依据时说明缺口，可继续完成不依赖它的结构与呈现。不要把示例查询、模型生成行或用户确认当成真实 DQE 执行证据。演示数据使用 inline，并在交付说明中明确其性质。

## 按任务读取目录内知识

先读[页面协议索引](references/page-metadata/README.md)和[本地创作与验收](references/local-workflow.md)。按本次涉及的能力读取对应模块与完整示例，不要求加载全部参考：

- 页面版本与已确认形态的布局：[页面](references/page-metadata/page.md)、[分区与布局](references/page-metadata/sections-and-layout.md)。
- 概览页先读[常见布局](references/overview-layouts.md)和[常用合法写法](references/component-recipes.md)；涉及地图再读[地图绑定](references/map-bindings.md)。按信息关系选择布局，示例数据不作为业务事实。
- 明确要求 ECharts 定制，或现有属性不能表达且用户已接受时，读[图表高级扩展](references/page-metadata/chart-option.md)再使用隐含 `props.echartsOption`。常规任务使用已有属性；普通修改保留已有透传，切换图表类型时按协议清除。
- 组件选型与属性：[组件索引](references/page-metadata/components/README.md)；先用已有组件，缺少表达能力时记录具体缺口。
- 数据与字段：[数据源](references/page-metadata/data-sources.md)、[结果字段契约](references/page-metadata/fields.md)、[字段绑定与格式](references/page-metadata/field-bindings-and-formats.md)。
- 多查询表格：连读[数据源](references/page-metadata/data-sources.md)的 `pagedJoin` 与[表格](references/page-metadata/components/table.md)的数值范围、查询分页、搜索及完整导出；使用册内完整示例核对成员引用与投影，按模块中的验收预期检查结果隔离。
  固定指标排名使用普通查询返回的独立字段并投影；`ordinalField` 仅为当前结果序号。先明确排名行域、并列规则和筛选后是否保留名次，缺少上游能力依据时只交付明确标识的仿真场景。
- 用户要求Report下载PDF、修改下载按钮名称或文件名时，读取[报告页头](references/page-metadata/components/reportHeader.md)的pdfExport声明和完整示例；在页面JSON中配置label和filename，不向集成应用生成截图或编码代码。
- 用户要求Report导出PDF、图片或高清长图时，读取[报告页头](references/page-metadata/components/reportHeader.md)的exportButtons声明和完整示例；每项是一个直接下载按钮，配置format、可选label/filename/scale。PDF支持2/3/4倍，PNG支持3/4倍且只输出一张PNG；不支持的scale按未配置处理，PDF默认2倍、PNG默认3倍，不因此拒绝页面；不生成格式菜单、清晰度弹窗、多图或ZIP；新页面不写旧pdfExport/pngExport字段。
- 复杂时间先读[筛选](references/page-metadata/filters.md)及[静态时间查询模式](references/page-metadata/queries-and-bindings.md)：保留年季月、详情单月与离散月份的不同语义；modes必须配完整静态query.timeModes，可信期间输入由集成应用注入，Page/URL不能伪造事实。
- 金额与币种先读[筛选](references/page-metadata/filters.md#amount-range)和[字段绑定](references/page-metadata/field-bindings-and-formats.md#field-selection)6.37规则；保留两个静态CNY/USD字段，units只换算输入，不前端换汇。
- 业务筛选单/多选、封闭枚举、结构树或时间候选依赖，先读[筛选](references/page-metadata/filters.md)6.36规则；显式queryField/levelQueryFields，options不作权限候选回退，不生成待审Condition字段。
- IOC 公共页头使用根级iocHeader，先读[页面](references/page-metadata/page.md)的6.35规则与普通/密集/详情样例；身份与filterIds分开，缺省不启用可选动作；详情保留Report和独立单月。
- Dashboard或IOC页头需要年／季／月／近一年切换时，读取[筛选](references/page-metadata/filters.md)的期间选择与完整示例；声明一个 timeRange 及其查询绑定，先确定查询使用月份还是日期范围。
- 参数、日期和筛选：[参数与文字](references/page-metadata/params-and-text-values.md)、[筛选](references/page-metadata/filters.md)、[查询绑定](references/page-metadata/queries-and-bindings.md)。
- 计算、导航或自定义组件：从协议索引进入对应模块。

新页面使用[知识版本清单](references/knowledge.json)的 schemaVersion；精确约束以目录内 schema.json、模块结构表和校验回执为准。示例是结构参考，不证明业务口径、数据权限或视觉等价。目标运行时版本不兼容时说明差异，不通过降版本号绕过能力下限。

## 形成页面并验证

先总结独立输入的页面特征和可检查的覆盖关系，再形成章节、组件、数据源与交互之间的对应关系，最后生成完整 JSON。禁止用旧产物反推需求的测试，只读取被允许的设计源与数据。简单修改直接定位最小对象；整页生成或重组要核对原需求覆盖情况。按[本地创作与验收](references/local-workflow.md)落实自然语言创作或设计源还原，以及数据字段、筛选、导航和格式的配置。

使用 Node.js 22 或以上运行目录内[独立页面校验器](scripts/validate-page.mjs)，将 `<skill-dir>` 替换为本 Skill 的实际安装路径，将 `<page-file-or-directory>` 替换为用户目标：

```sh
node "<skill-dir>/scripts/validate-page.mjs" "<page-file-or-directory>"
```

已有明确形态确认时，加 `--expected-layout dashboard` 或 `--expected-layout report` 对照有效布局，例如 `node "<skill-dir>/scripts/validate-page.mjs" --expected-layout dashboard "<page-file-or-directory>"`。该参数来自本次用户确认，不从待验文件反推；它检查结果与选择一致，不证明已取得用户确认。

校验器包含产品的结构和文档内语义校验，另检查文件名与页面 id 一致；返回 JSON 行，保留 type、path、message。退出码 0 为通过，1 为文档错误，2 为调用或目标目录错误。目录模式只读取该层的 .json 文件；不要对混有其他 JSON 的目录直接执行。每次完整生成后、校验前，按[尝试快照](references/local-workflow.md)冻结原始字节；修复只改工作文件，下一轮使用新目录，不覆盖或重建失败样本。按[校验与错误](references/page-metadata/validation.md)修复原文并重跑，不放宽规则或删除合法配置来掩盖问题。

脚本无需 npm 安装、仓库依赖或网络。Node 不可用时报告“自动校验未执行”，仍可据参考生成文件；不能把人工核对说成脚本通过。

有适配版本的页面试验场或集成应用时，用统一运行时预览精确文件并验证涉及的视觉与交互。运行环境由用户项目提供；Skill 不内含渲染引擎、数据服务或发布入口。环境缺失时交付 JSON 与静态结果，明确预览或真实取数未验收。

## 交付

报告文件位置、已确认的布局形态及确认依据、采用的范式、需求覆盖、实际校验结果和剩余缺口；设计源还原须附实际截图对照，查询变化须另列真实执行证据。静态校验、视觉/交互验收和真实数据验真分别报告。本地文件完成不等于线上保存或发布成功。

## 安装与知识更新

安装时复制整个 metriccanvas-local-authoring 目录，包括 references、assets 和 scripts；不要只复制 SKILL.md，也不要创建指向安装目录外知识的软链接。目录可放入 Coding Agent 支持的 Skill 安装位置。

流程正文、概览布局与短写法、地图绑定说明及快照脚本由作者维护。page-metadata、地图地名清单、完整布局样例、knowledge.json、校验器与第三方许可证由维护仓库从同一产品契约生成，安装副本只消费。升级时整体替换目录并重新校验目标页面，保持知识与校验器版本一致；不要手改生成文件。可用脚本的 --version 核对它与 knowledge.json 的 schemaVersion。

维护流程、知识归属、升级与回退见[知识维护](references/maintenance.md)。仅维护或升级Skill时读取。

跨页传值采用显式row/param/filter映射；强类型链路声明validateTargetInputs:true并由集成应用提供目标输入投影。先读交互与导航协议，确认目标必需参数及粒度。不得把季度截成详情单月，也不生成viewstate/来源视图恢复。B6操作挂起，不默认添加可选操作。

强类型跨页链路的来源及接收页面显式声明strictURLInputs:true；不能根据规范化后的schemaVersion推断是否开启。受控编辑用set_url_input_validation（enabled控制添加或删除），目标输入投影只包含页级公开参数及筛选，排除详情私有筛选。
