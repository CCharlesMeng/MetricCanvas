# B5 本地实施结果

已完成用户收窄后的显式跨页传值，Schema6.36。概览→清单→详情支持row/param/filter的显式URL映射和目标输入校验；缺值、类型、日期粒度、维度层级和目标能力错误可读地拒绝，目标页非法URL不发查询。各页面独立，无新增恢复功能；B6挂起，88项规划保留。

[打开交互预览](http://127.0.0.1:4208/pages/ioc-header-navigation-source-demo) · [完整验收与启动方式](acceptance.md) · [验收账本](alpha-tests.md) · [机器记录](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-b5/evidence/verification.json)

本地check/build、44页、Python552项、837/4/1契约、Bundle2978、复杂度均通过；Vitest全量加完整单文件重试覆盖2361通过、4跳过，非一次全量全绿。Playground6/6、源码浏览器57/57、仓外安装浏览器38/38通过，三组有重叠；仓外Skill三页及Node ESM15页通过。真实服务/模型/门户、CI与部署未运行。

指纹`c6886cbcb47c8c806c231c9e31003ae3845b9ff69ec702f8f4857e275bd4ce82`。改动留在隔离工作树，无暂存、提交或推送；原工作区并行内容保留。未迁移全部业务页面、未默认新增可选操作。

[历史截图：清单选择USD后详情接收与合成服务回显](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/ioc-header-b5/evidence/artifacts/preview-transferred-usd.jpg)
