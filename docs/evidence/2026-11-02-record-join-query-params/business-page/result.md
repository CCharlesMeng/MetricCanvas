# 原始商务决策明细：approver-name 收口

后续“商务类型前端枚举”已将此业务页升级为6.78并添加列枚举；本页保留上一轮修订证据，最新 JSON 摘要及验收见 `../enums/result.md`。

本轮按用户最新强调，以审批人下钻查询为主目标；IOC Header 为附带迁移，分页保留原始完整关联方式，不新增未经确认的唯一记录字段。没有扩展引擎或协议；依赖本工作树此前已完成的 records 成员独立消费参数修复。

## 文件与原件

- 用户指定附件 `/Users/moon/.codex/attachments/3d9178f1-3316-4946-bbfc-236337078227/已粘贴的文本.txt` 已直接更新。
- 原始字节保存在同目录 `original.json`。
- 正式页面相对路径 `pages/business/dashboard/ioc/commercial/business-decision-all-details.json`，已同步当前工作树和用户主工作区，三个工作文件字节一致。
- SHA256：`6bf21db7d9b82ad6f58d62cef8ef54bb395c2ac57fc1bcbb37a4100f61373eae`。
- 附件的文件名不是页面 id，直接校验 `.txt` 会报告文件名不符；同字节、同 id 的正式 `.json` 完整校验通过，不修改用户指定附件路径来掩盖该提示。

## 根因与变更

| 原现象 | 根因 | 修复及验收 |
| --- | --- | --- |
| URL 人名只改变标题、不筛选数据 | approver-name 仅是 display 参数 | 改为 query.dimensions，主表 paramBindings 映射审批人姓名；动态表格标题不变 |
| 主表与补列字段不同 | 补列没有审批人字段 | 补列不绑定该参数，不发审批人候选查询；已有 records 参数校验修复支持 |
| 旧 Dashboard Toolbar | 旧页头配置 | 根级 iocHeader 承接 meta.title、原说明和期间／区域顺序；Region 使用单选组织树 |

与原件对比：只有 decision-details 的 paramBindings 增加审批人绑定；business-basic、decision-overview 及 sections 整体深度相等。没有改变原查询输出字段、关联键、分页、搜索、列筛选、排序或导出声明。版本由6.69正常升级为6.77。

## 实际运行

当前预览：`http://127.0.0.1:5187/pages/business-decision-all-details?approver-name=合成审批人甲&mtime=month:2026-11`。

浏览器真实打开此业务页：甲24条、乙6条、无匹配姓名0条、缺省参数30条。标题跟随传入姓名；无参数时沿用 TextValue 缺值隐藏标题的既有语义。截图 `approver-a.png`，其他可访问性记录同目录。

业务数据经标准网关与 Vite HTTP 代理访问端口18387 DQE Sim 的 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute`。只有服务端 `business-decision-details` 夹具提供合成行；页面没有 inline、initial、模拟开关或专用数据网关。IOC 组织树复用现有 Playground 候选 Adapter，未将候选包装成真实内网数据。

原页新增统一运行时 HTTP 回归验证两条 execute：对象主表1条，审批人姓名下推；补列1条，不包含审批人条件。所有请求均由实际 fetch 访问临时 Sim HTTP 服务，无响应拦截。保留原完整读取，因此这里不声称后端按用户翻页查询。

## 校验与范围

- `pnpm validate`：154页全部通过。
- local-authoring 独立校验器：正式页面通过。此次复用已生成的参数与 IOC 能力，没有新增创作语义，不重新生成协议与 Skill 产物。
- DQE Sim、原页／合成页统一运行时、页面协议回归：4文件19项通过。
- DQE Sim 类型检查、engine 测试类型检查、Playground 检查通过；Playground 0错误0警告。
- `git diff --check` 通过。

复杂度使用 metriccanvas-ts-ast/1、TypeScript5.9.3，全部修改及新增函数（含回调）见 `complexity.json`。新增 executeBusinessDecisionDetails 13、emptyMetrics 2、outputFields 6、matches 15、windowResult 11、record 3、failure 1，回调均≤2；新增测试回调≤3。executeLocalDemo 前后3→3；其他修改仅是顶层导入与映射登记。扫描器同时列出的 execute.ts 存量超限函数本次没有修改，不属于本轮重构范围。

没有提交、推送、部署或内网生产 DQE 验真。后端分页仍需真实唯一审批记录字段及相关后端能力确认，不作为本轮审批人筛选的完成条件。
