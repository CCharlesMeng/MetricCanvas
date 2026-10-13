# Vitest 与真实浏览器

## 已核对清单

覆盖：packages/ui/src 与直接工程入口，2026-10-12。

### TEST-1

[配置](../../../vitest.config.ts)、[消费夹具](../../../tools/package-build/fixtures)：TS 逻辑与浏览器行为分别验证。

## 规范

PATTERN-TEST-1：源码测试不能代替已安装 tarball 消费与真实组件交互。依据样本：tools/package-build/compatibility.mjs、packages/embed/tests/browser/inline-params.spec.ts。

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。
