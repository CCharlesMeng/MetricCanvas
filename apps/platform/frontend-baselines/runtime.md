# 统一工程与质量命令

## 已核对清单

覆盖：apps/platform/src 与直接工程入口，2026-10-12。

### RUN-1

[根 scripts](../../../package.json)、[本包 scripts](../package.json)：安装/构建/check/test 使用 workspace 入口。

## 规范

PATTERN-RUN-1：质量入口沿用根与包 manifest；不另建工具链。依据样本：tools/package-build/build.mjs、package.json。

违例判定：本次修改是否绕过所指入口或改变该入口拥有的职责。
