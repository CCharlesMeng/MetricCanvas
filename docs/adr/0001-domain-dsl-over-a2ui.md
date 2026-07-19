# 页面规格采用自研领域 DSL,不以 A2UI 为资产格式

页面规格是平台的核心长期资产,且短期内必须让 AI 稳定生成。我们评估了以 A2UI(+自定义 BI catalog)作为资产格式的方案,最终决定自研领域 DSL(以指标/维度/聚合/筛选联动为一等公民)+ 自建统一运行时。

理由:A2UI 是通用 agent→client UI 消息协议,缺少 BI 领域语义,抽象层级错位导致 AI 生成体积大、领域校验困难;协议处于早期(2025-11 创建,v1.0 仍为 RC,自述 "expect changes"),将长期资产绑定其上有被动迁移风险;重度依赖自定义 catalog 后互操作红利名存实亡。业界(Grafana/Rill/Superset 及 2026 年 NL-to-Dashboard 生产实践)均采用领域 DSL 路线。

## Considered Options

- A2UI + 自定义 BI catalog 作为资产格式:唯一实质收益是现成通用 renderer,但 BI 组件仍需自研,被否决。
- 领域 DSL 编译输出 A2UI 接入其生态:暂不投入,协议成熟后可再评估。

## Consequences

- 需要自建规格 schema 与运行时,schema 演进必须自我约束:规格不表达像素级样式、不表达任意计算逻辑(复杂计算下沉表服务),防止 DSL 膨胀为"用 JSON 写的编程语言"。
