# 受控语义HTML

semanticHtml是声明白名单语义标签/类和内嵌值的字段类型，不是任意网页。呈现前按现有安全规则解析，未知标签/属性不获得执行能力；格式化内嵌数值遵循结果字段契约。

普通text/fieldText与semanticHtml路径区分；不要把拼接HTML作为字段格式化的替代。允许结构标签为div/span/strong/p/br，允许class为detail-title/detail-value/detail-description/detail-meta/tone-positive/tone-negative/tone-neutral；未知标签、属性、类或未闭合结构整体失败关闭。data只包含单个有限规范数字，不接受属性或自闭合；signed按数值正负赋语义。最多1000节点、11层元素嵌套，字符长度按产品MAX_SEMANTIC_HTML_LENGTH限制。text的bodyFormat、页头subtitleFormat或semanticHtml字段显式接入此路径。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。
