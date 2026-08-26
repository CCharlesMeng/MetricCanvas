# @metriccanvas/design-facts

从 Figma 导出的设计稿 HTML 里抽出可静态读取的字面量,产出入库的取证 JSON。

```bash
pnpm design:facts                          # 生成 docs/design-facts/*.json
pnpm design:facts:check                    # 只校验,不写盘
pnpm design:facts 路径/某份稿.html          # 指定源文件
```

产物契约、分层规则与消费方式见 [`docs/design-facts/README.md`](../../docs/design-facts/README.md)。

| 文件 | 职责 |
| --- | --- |
| `src/html-scan.ts` | 极小 HTML 标签扫描器(零依赖),产出带父子关系的元素表 |
| `src/class-tokens.ts` | 类名 token 的分层与字面量解析 |
| `src/tailwind-theme.ts` | 计算层 utility 的 Tailwind 默认值对照表(只收录稿里出现过的 22 个) |
| `src/extract.ts` | 组装产物;`ARTIFACT_VERSION` 在此 |
| `src/format-json.ts` | 叶容器压成一行的序列化,让入库产物可 diff |
| `src/artifact-io.ts` | 路径约定与读写,CLI 与测试共用 |
| `src/cli.ts` | 生成 / 校验入口 |

抽取语义改了要升 `ARTIFACT_VERSION` 并重跑生成,否则测试会失败——这条断言不需要设计稿在场,
所以 clone 下来的机器也拦得住。
