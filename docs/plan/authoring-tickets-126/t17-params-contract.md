# T17 / #143 参数契约

S2任务01a09f69-a06b-7703-b87b-ccdfe05d765e；基线e65b012c0a93d5c9a1ac9c0e51e320133e97a0f1，分支codex/s2-params-bindings-143。此实现按ADR-0051新增6.2能力，不将#126提案当作已有外部服务事实。

规范见../../page-metadata/parameters.md；作者源为page-param.ts、schema/primitives.ts、schema/data-source.ts、schema/filter.ts、param-bindings.ts和version.ts。新增公开initializePageParams复用既有解析/筛选/编排；query内部初始化保留在page协议层，runtime不解析DQE方言。公开快照列出增量符号。

关键裁决：dimension默认单值string，multiple:true为非空无重复string[]；query.paramBindings指向显式DQE维度，filter.initialParam引用同源。双默认、重复查询目标、引用错位/缺失、层级初值和旧版本能力越级均拒绝。必需缺值不呈现/不查数，可选缺值不加条件；URL非法输入回退唯一default。受筛选控制的目标不向查询体写参数条件，清空不会复活原值；其它共享源仍可保持初始化值。URL只读一次，运行副本不保存回模板。

布局规范化与作者写出版本分开：原6.0升级到6.1、已有6.1/6.2保持；作者新建写6.2。TS/Python完整比对该规则，历史hash先核验约束不变。旧golden输入不升版，布局矩阵扩展至40，参数13项；冻结legacy来源不改。

本票不涉及参数提取算法、服务端权限默认优先级或在线执行端点；这些消费契约随T04及#144，服务端权威不在浏览器重写。完整参考手册仍为M2范围，本票补参数/初始化章节，不宣称其它模块已完成。
