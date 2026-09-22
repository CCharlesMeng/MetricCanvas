---
status: accepted
date: 2026-09-20
note: 部分替代 0064/0079 的平台不保存与候选选择；单份工作稿加工具内保存草稿
---

# 平台创作先取证据，维护单份工作稿并在内容工具内保存草稿

依据用户确认的[最小流程](../plan/2026-09-20-authoring-minimal-flow-and-skill-plan.md)，平台新建和数据修改共用计划审核、取数与证据判断；查询结果以受身份、页面、轮次与版本约束的引用复用。模型可消费明确授权且有界的分析证据，完整页面与原始响应仍由程序持有。普通问数继续临时页面态，不自动落库。

平台不再要求同轮候选分叉、任选候选或 Relay 独立提交。程序维护单份工作稿；compose/edit 对合法有效变化（包括 partial）冻结 document/base/operationId 后内部单次保存。失败、无变化、非法页面不新增保存；并发版本竞争或迟到结果不能覆盖工作，未知写入不自动重发。远端并发保护仍依赖 Java 基线修订检查。

保存定义与预览分离：query initial 只存在于 previewJson，静态 inline 仍属于定义。保留 page_metadata_emit_preview、`{{RESPONSE_START}}` 和 `{{PAGE_METADATA_PREVIEW_JSON}}`；Relay 注入必须对应本次已保存产物。预览失败只修复交付，不能重复保存。计划确认不等于发布，既有明确发布流程保持。

本决策部分替代 ADR-0064/0079 的平台不保存、候选选择与全业务行隔离要求；ADR-0080 的单次保存与未知停止继续有效。部署通过 Bundle 0.3.0 / platform protocol 2.0 整体切换；v1 入口及记录为存活兼容消费者保留，不作失败回退。本仓内核和协议验证不代表真实 Relay、Lab 或 Java 部署已经验收。
