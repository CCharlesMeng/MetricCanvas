# 完整示例

例子从产品合法夹具复制，不由Markdown手抄。它们证明结构与页面语义合法，DQE或SSE的静态声明不等于真实服务成功。各模块末尾指向所用完整页面；机器[index.json](../../../contracts/metriccanvas/page/reference/index.json)登记对应关系。反例的type/path按产品conformance记录核对。

组件示例含17类及其显式variant，由完整页面裁剪必要依赖并重新校验。`index.json`的`exampleCoverage`登记源夹具与JSON Pointer；`branchCoverage`逐项登记anyOf/oneOf分支。109项由合法页面实际命中，文本链接的row来源一项由拒绝反例记录，不能当作合法用法。allOf引用包装保留在结构目录，不冒充独立行为分支。

新增示例目前只完成结构与语义验证，没有逐variant新增截图或视觉验收。模块中的运行时源码和既有浏览器测试用于说明已实现语义；精确到这些新示例的外观仍待验证。真实DQE需受控查询端口、有效查询定义及数据上下文；AI总结需宿主可信SSE配置及可用服务。已有本地HTTP/SSE证据不能替代外部提供方连通性验收。
