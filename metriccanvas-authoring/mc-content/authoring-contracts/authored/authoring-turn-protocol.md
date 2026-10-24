# Authoring turn / 1.0 消费约定

结构唯一作者为 authoring-turn.schema.json，结构正反例为 authoring-turn.conformance.json。TS 包装只校验该 Schema；Python用同一Schema。合法结构不是授权、最新读取或产物完整性的证据。

## 准备与权威

工作台先锁新的人工写入口、flush已开始输入并同步，再使用明确支持latest的端口读取。LanguagePort.prepare的程序输入为actorId/workspaceId/requestId/runId/turnId/mode/access/pageId/selectedComponentId/latest/documentJson。existing提供完整latest修订，new的pageId/latest/documentJson为null，由可信端口分配页面身份。完整latest/documentJson不交模型。

prepare返回AuthoringTurnBinding。调用者检查结构、active、能力1.0、本轮身份/request/run/turn/access/mode、精确ref、页与hash；model run仅接binding/必要摘要。Python的CurrentAuthoringTurnPort每次带外提供current_scope和PreparedAuthoringTurn(binding, baseline, document_json)，执行时再次核对。拒绝旧contextRef、scope变化、取消/关闭、能力不兼容、ref/hash不符。只读access阻止全部内容写调用。

## 字节与完整性

binding.documentSha256为可信prepare输入documentJson的**精确UTF-8字节SHA-256**。浏览器用产品canonicalizeJson(latest.document)生成此字符串，prepare存储原字符串；Python不重新模拟ECMAScript数字格式。Python严格解析document_json，拒绝重复键/非有限值，并核对解析结果和完整基线文档一致；同时独立验证旧ContentBaseline内部hash。

旧ContentBaseline.document_sha256和旧内容artifact内部hash仍使用原Python canonical_json；它们与本轮字节hash是两个明确的完整性边界，不能互相替代或比较。新建两者均无页面基线。authoring-turn.bytes.json记录真实产品序列化输入、精确字符串与hash，TS生成端和Python消费端均须验证。此约定避免改动旧保存幂等/历史产物的hash。

## 读取与部署

统一工具服务为metriccanvas-platform-content（Python模块platform_server），统一Skill只能注册此受门禁服务，缺current-turn提供方时所有工具明确不可用。metriccanvas-content旧服务保留为兼容面，不能作为统一入口的替代或降级；普通问数继续原服务。

公开统一工具：read_page_context(context_ref,target_component_id?,use_selection?,offset?,limit?,cursor?)；discover_data_context(context_ref,query,limit?)；compose_page(context_ref,spec,layout?)；create_content_page(context_ref,title,request,layout?)；edit_page(context_ref,request)。模型不传page_id/baseline_token/source_token。页面身份和源基线由可信上下文推导。

读取只输出有界结构/目标配置，目标显式ID优先，未知/歧义/已删除不猜。分页cursor绑定当前identity/page/run/turn/ref/hash和目标，省略声明不能伪装不存在；未知扩展字段仅可无损保留于完整基线，不把任意props递归当作安全摘要。每次异步内容结果出站前再核对有效轮次，迟到结果不交接。S2不构建持久候选/自动提交/恢复；外部latest和身份提供方缺失继续blocked。
