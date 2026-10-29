# 错误提示交付范围

本批基线：`6524bcdb32205dc7299cb7ca7cc261bf49abbb26`（origin/main）。工作树：union-error-source；锁文件pnpm-lock.yaml未修改。

交付包括分页合并错误提示、首现行号与跨批识别、五个共享SourceProgram回归用例、Playground合成故障参数、页面协议正文及官方生成的local-authoring/MC参考与锁。未修改用户页面配置、DQE请求语法、上游数据或其他工作树。

前两轮本地证据保留在本目录README及readable-message说明；其中日志/JSON为Git忽略的本地验证产物，交付收口前已逐文件比对归档至：

`/Users/moon/.codex/visualizations/2026/10/29/01a18550-6c6c-7a02-a699-e715ac5b6ea5/union-error-delivery-evidence/`

归档delivery-manifest.json记录每个文件SHA256。相邻说明中的日志/JSON文件名均指该归档，不将日志或原始业务数据随代码发布。

交付前按项目入口`pnpm test`复跑五个相关测试文件，73项全部通过；远端与CI结论另在最终交付消息给出；原有数据执行、Playground/工具类型检查、浏览器、原附件回放及MC检查在输入未变化时复用。复杂度口径与全部前后结果见readable-message及归档，修改/新增函数均不超过15，无未关闭项。
