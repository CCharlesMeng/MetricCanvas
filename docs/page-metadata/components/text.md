# 文本 text

承载说明、口径提示或由后端返回的人工/AI 已确认分析结论；可显式使用受控语义 HTML 正文。适用于摘要默认使用 text；说明、提示、后端返回或已确认结论均选择本组件、页面内分隔章节的大标题使用 variant: heading，标题写在 props.title，通常放在 container: plain 的分区里、摘要需要分色富文本时声明 bodyFormat: semanticHtml，并在 body 中只使用受控标签和语义类、分析报告摘要使用 variant: reportInline；它会默认显示图标和“AI 总结：”，metadata 只需声明正文。数据形状：不绑定页面数据源。

静态文字使用body及受控variant。plain、insight、heading、reportInline、riskNotice表达不同文体。bodyFormat:semanticHtml显式选择受控富文本；未声明时按普通文本呈现，不执行任意HTML。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。
