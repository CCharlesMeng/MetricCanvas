# P6 真实 DQE / Relay 验收

当前回执：`NOT_RUN / NO_TRUSTED_REAL_DQE_ENDPOINT`。开工/收尾环境未提供 METRICCANVAS_DQE_ENDPOINT 或 Relay 执行配置；平台环境只有 localhost 数据服务。模型 API 配置不等于真实 DQE/Relay 接入。示例的字段、编码和 canSelectPage 是仿真输入，不能作为真实能力证明。

准备已真实验真的 6.22 业务页面，保留权限和业务条件。每个成员用真实业务键和输入维度，禁止直接把 `paged-join-page.json` 的仿真字段拿去做业务验收。数据提供方确认授权目标、指标口径、同一行粒度及源参数/筛选映射。可信接入程序供给绝对端点和当前身份请求头；凭据不进入页面或日志。

设置可信环境变量后运行：

```sh
pnpm exec tsx tools/scripts/verify-paged-join-real.ts /absolute/path/verified-business-page.json actual-combination-source-id
```

需要的变量：METRICCANVAS_DQE_ENDPOINT、METRICCANVAS_DQE_HEADERS；后者为当前调用身份的请求头 JSON。不能借用他人身份，也不能把 token 写进命令参数、页面或验收报告。

程序先新鲜读取普通成员的完整结果，检查非空唯一键和 canSelectPage 成员的业务行域一致性；再核对每个可排序字段的升/降序第一页与第二页、原始完整行域的预期键、总数及补列投影；在有界行域内验证跨源数值过滤；最后核对全部匹配行导出。stdout 只输出场景名、行数、总数和结论，不输出键集合、行内容或凭据。失败不宣称部分通过；60 秒及完整导出上限由 SourceProgram/网关控制。

没有真实空值时，程序通过不能证明上游 null 编码。需要有可空排序字段的真实样例，确认回退完整关联后的缺值排尾；只有可靠的上游能力证据才能声明可用于选页。超过 fallback.maxRows 的跨源过滤必须返回明确范围失败，不能把第一页过滤当成全集。大规模跨源条件需要真实服务端关联能力。

在实际 Relay 部署中安装与本批匹配的页面协议和 data-execution 包，使用 `metriccanvas-execute-page`，stdin 传完整已验真 metadata，stdout 收完整页面；端点/身份由可信部署程序按每次调用注入。删除本轮输入 initial 后执行，核对普通成员和组合 initial 独立、组合只写默认第一页、纯成员定义没有额外 ordinary initial，之后用匹配 6.22 的真实引擎预览。保留部署版本、脱值执行回执、页面产物摘要与浏览器证据。Node 本地执行不代替 Relay 部署验收。

`verify-paged-join-real.ts` 的机制已通过 HTTP Sim 测试，这仅证明脚本可执行。没有 DQE 事务快照令牌时，多请求的同总数内容变化不能完全检测；需由上游提供一致性保证。新增生成知识没有完成真实 DS 模型的业务页面创作验收。
