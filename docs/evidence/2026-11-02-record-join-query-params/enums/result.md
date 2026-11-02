# 商务类型前端枚举

本轮在原业务页的商务类型列声明 `enumValues`，字符串 `0 → 项目商务框架`，字符串 `1 → 项目非框架`。指定附件、主工作区 pages、预览工作树 pages 和已有 artifact 已同步；SHA256 为 `6ad1a431992b5d38c1540a44fd6d381e2a3fc681b0b88850b41c7582caaaa515`。与上轮业务页深度对比，仅 schemaVersion 6.77→6.78 和商务类型列 enumValues 改动。

## 产品声明和行为

当前协议原本没有前端列值映射，故新增通用的可选 `TableColumn.enumValues`，而不是在 Sim 返回中文、改业务数据或增加页面专用渲染分支。枚举使用类型敏感的原始值与非空标签，拒绝重复值、空字典与旧协议版本使用。6.78版本和本轮引擎是必要依赖。

主单元格与 Excel 显示枚举标签，静态表头选项按字典顺序提供，选择仍提交原始编码；不预热或请求动态候选。空值保留既有缺省文本，未知原始值保留原文，异常原文证据优先，不替换成默认枚举。原始行、审批人参数、查询、补列、页头和分页没有改变。

## 页面、文档与 Skill

- 实际业务页：`pages/business/dashboard/ioc/commercial/business-decision-all-details.json`。
- 完整能力场景：`pages/capabilities/table/table-column-enums.json`；未知9、空值、数字与字符串编码、中文筛选和导出均可观察。
- 产品文档：PAGE-METADATA.md、docs/page-metadata/components/table.md、reference-map.json；有效／非法契约向量从同一页面生成。
- local-authoring 升至1.14.15；协议、独立校验器、知识及 MC 从产品真源生成。枚举知识归入 table.columns；缩短模块重复概述以保持既有16384字节读取预算，未截断约束或提高预算。table.columns 实测13038字节。
- 仓外复制安装目录验证此业务页通过，证据 `independent-skill.json`。

## 浏览器与回归

当前业务预览：`http://127.0.0.1:5187/pages/business-decision-all-details?approver-name=合成审批人甲&mtime=month:2026-11`。

浏览器在原业务页显示两种中文类型，标题仍是审批人甲、总数24。打开商务类型菜单只有两项静态枚举；选择项目商务框架后总数12，行仍为审批人甲；清空恢复24。实际业务截图 `business-page.png`，能力页亦验证 B-1 单独筛出、未知9和空值原样显示。DQE Sim 继续提供原始编码，不代表真实内网 DQE 验真。

- 相关产品回归9文件43项通过；新增协议正反例、前端类型敏感映射、未知／空值、Excel、候选不预热、原始编码筛选与原页 HTTP 取数都覆盖。
- 155个页面文档全部校验通过。
- page、engine 测试、tools、tests 类型检查通过；Playground 0错误0警告；page/engine 包构建通过。
- MC 33项回归、来源覆盖检查、诊断夹具与契约生成一致性分别验收，使用项目锁定 Python 环境；系统 Python 缺依赖的失败不作为产品失败。
- 完整 `pnpm skills:check` 通过：repair/release 2文件16项，local-authoring 6文件229项（包含分发隔离及仓外安装）。完整回执 `skills-check.log`。知识预算和升级示例均保持原有门禁。

## 复杂度

工具为 metriccanvas-ts-ast/1，TypeScript5.9.3；函数独立计 selfCC，回调逐个测量，Svelte 脚本和本次模板回调分别抽取测量，见同目录 JSON。

| 修改点 | 前→后 selfCC |
| --- | --- |
| alignedCellText | 4→5 |
| preloadFields／其过滤回调 | 2→2／1→2 |
| writeTableSheet／单元格回调 | 7→7／14→15 |
| columnConditionPaths | 1→1（原分支提为共用属性扫描器） |
| Svelte 筛选展开回调 | 2→3 |
| parsePage | 31→31 |
| buildProductOutputs | 15→15 |

全部新增函数、闭包和回调≤4，所有本轮新增分支函数均≤15。parsePage 是存量超限31，本轮只添加无分支的校验调用，把枚举规则放进独立职责，没有扩大其复杂度；本轮不重构其他解析职责以免扩大兼容风险。其余扫描出的未修改存量函数不计入本轮改造范围。

没有提交、推送或部署。用户主工作区只同步所指定页面及此前本任务输出，协议与引擎实现留在当前预览工作树，未覆盖并行源码。
