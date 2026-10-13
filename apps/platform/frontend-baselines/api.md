# 实例服务与提供方 Adapter

## 已核对清单

覆盖：apps/platform/src 与直接工程入口，2026-10-12。

### API-1

[services](../src/lib/integration/services.ts)、[session](../src/lib/integration/session.ts)、[Java Adapter](../src/lib/page-assets/java-adapter.ts)：每请求现读配置与凭据，失效停止。

## 规范

PATTERN-API-1：资产读写通过现有 Adapter，UI 不旁路 fetch。依据样本：page-assets/java-adapter.ts、page-assets.ts。

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。
