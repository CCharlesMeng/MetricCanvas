# approver-name 与列枚举交付

交付工作树：`/Users/moon/.codex/worktrees/approver-params-delivery/DataDashboard`；干净基线 `a738a77a7c9cffb49fffad9f3bc11059aea3988d`。原实现／预览工作树及用户主工作区的并行修改没有整体搬入。

本批只交付：records 成员独立消费查询参数的校验修复；原商务决策页的审批人绑定、动态表格标题和 IOC Header；前端商务类型枚举；DQE Sim 服务端夹具、真实 execute HTTP 回归、Playground 页面及对应生成产物。分页保留原完整关联方式，无真实审批记录唯一键的新假设。

## 版本与合并

最新 main 已发布6.78按页比较与6.79独立置顶行；因此本轮未发布的列枚举登记为 **6.80**，local-authoring 为 **1.17.3**。保留现行按页比较、多个汇总查询、固定置顶文字、组织 URL 及空组织键行为。

手工合并仅涉及能力清单、页面元数据正文、JSON reference-map、示例读取入口和版本样例；派生契约、知识、独立校验器、MC 与锁文件全部在合并后的产品真源上重生成，没有拷贝旧基线的生成哈希。

## Schema 最小化

审批人修复没有新增字段。枚举净增一个可选列属性 `enumValues`（每项仅含 value／label）：映射是作者提供的业务差异，字段类型／名称和后端原始编码不能可靠推导中文含义。现有显示格式闭集、数值计算、固定置顶文字均不能表达逐行的业务编码映射；不以页面专用前端分支或伪造后端返回替代。引擎统一负责标签显示、静态候选、原编码筛选与导出，原始数据不变。

## 合并后验证

- 本批10个测试文件42项通过，包括实际 fetch 经临时 DQE Sim HTTP 的原业务页回归。
- 与最新 main 重叠的独立置顶行／按页比较回归：4文件39项通过。
- page、engine 测试、Playground 类型检查通过；Playground0错误0警告。
- 160个页面全部校验通过。
- 合并后真实浏览器入口 `/pages/business-decision-all-details?approver-name=合成审批人甲&mtime=month:2026-11`：24条，动态审批人标题及两种中文商务类型同时显示；服务端仍提供原始编码。
- MC33项通过；来源诊断夹具与 authoring contracts 一致性通过（1345 product / 4 authoring / 1 interface）。使用项目锁定 Python，禁用字节码缓存，保留 MC 原字节校验。
- 完整分发回归与远端 CI 作为独立收口检查，最终状态以交付答复及 CI 回执为准；上一基线的完整245项创作／修复检查已保留在历史验收目录，不冒充新基线结论。

## 复杂度

测量器 metriccanvas-ts-ast/1、TypeScript5.9.3；每个函数和回调独立计 selfCC。新 main 上 memberErrors14→15、alignedCellText4→5、writeTableSheet7→7（单元格回调14→15）、parsePage31→31；新辅助函数和模板回调仍≤15。parsePage 是保留的存量超限项，本轮仅增加无分支的独立校验调用，避免扩大无关解析器重构。前后原始数据见本目录 JSON；模板回调单独抽取测量见 `../enums/template-complexity.json`。

本地 Sim、浏览器和自动回归不代表内网真实 DQE 或部署验证。更新 JSON 时必须同时使用支持6.80及本轮参数校验修复的引擎。主工作区已有脏修改继续保留，不用强制切换本地主 main 代替远端交付证明。
