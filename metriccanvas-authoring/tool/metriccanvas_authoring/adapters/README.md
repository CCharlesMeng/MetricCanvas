# 内部适配区

整个目录由内部接手。首次代码是本地验证过的参考实现，不代表真实 Relay/Java/DQE 已接通。
公共更新保留本目录，公共 Bundle 哈希不包含它。新增依赖写 requirements.txt。

先实现 factory.py:create_adapters()，接口由公共 bootstrap/adapter_contract.py 定义。
firstparty/ 接 Java、元数据和 DQE；relay/ 接身份、创作轮次、授权和程序通道；storage/ 接持久状态。
现有 environment.py 只服务普通问数等兼容入口，平台生产入口不会自动调用它。

完整步骤见 Bundle 根目录 RELAY-HANDOFF.md；不要复制公共业务流程或更改公共接口。
