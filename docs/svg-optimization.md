# SVG 优化工具

项目固定使用开发依赖 SVGO 4.1.0，通过独立命令按需优化 SVG，不接入 Embed 构建，也不自动改写产品图片。适用于先检查超大 SVG 能否减少体积，再决定是否采用优化副本。

## 使用

```sh
# 默认保留 6 位小数，副本写入 .scratch/svg-optimized/文件名.optimized.svg
pnpm svg:optimize "/absolute/path/超大图片.svg"

# 指定输出路径与坐标精度；3 位小数更积极，需要核对细节
pnpm svg:optimize "/absolute/path/超大图片.svg" -o .scratch/preview.svg --precision 3

pnpm svg:optimize --help
pnpm svg:optimize:test
```

输入和输出都必须是 `.svg` 文件，输入使用 UTF-8 编码并满足 SVG/XML 语法。非法编码或 XML（例如注释内含 `--`）会报错，不写出优化副本。命令保留源文件，拒绝同路径输出和覆盖已有文件；重复运行时使用新的输出路径。默认输出相对于当前工作目录，不递归处理目录，不会自动替换任何产品源码。如果优化结果更大，副本保留原始字节。

## 行为与结果

优化启用多轮处理，清理编辑器元数据、注释及冗余结构，并优化路径和数字表达。默认精度为 6，可通过 `--precision` 设置 0–10；这不是数学意义上的无损压缩，降低精度后尤其需要对比画面。配置保留元素 ID、标题、描述和隐藏元素，不启用删除 `viewBox` 的插件。对包含脚本、动画或依赖外部 CSS 选择器的 SVG，应核对交互与样式后再替换。

终端输出 JSON 报告：

| 字段 | 含义 |
| --- | --- |
| `input` / `output` | 输入和优化副本的绝对路径 |
| `precision` | 本次数字精度 |
| `beforeBytes` / `afterBytes` | 未压缩原始文件大小，以字节计 |
| `savedPercent` | 原始字节减少比例 |
| `gzipBytes` | 优化副本经过 Gzip 后的大小，仅用于估算传输成本 |
| `base64DataUrlBytes` | SVG 编码为 Base64 data URL 后的大小，含 URL 前缀，不含 JS 语法及同分块其他代码 |

是否满足 Embed 单个 JS 的 1,000,000 字节限制，以实际 Embed 构建和分发门禁为准；`gzipBytes` 不能替代原始 JS 大小。SVG 内嵌的 PNG/JPEG 不会被这个工具重新压缩，路径本身极复杂时也不保证能压到目标大小。压缩不会修复外置资源 URL；先对比副本呈现，再将确认的副本替换到实际资源位置并构建。

相关文档：[SVGO Node.js API](https://svgo.dev/docs/usage/node/)、[路径优化参数](https://svgo.dev/docs/plugins/convertPathData/)、[Embed 分发基线](agents/embed-distribution.md)。
