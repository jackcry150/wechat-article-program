# Knowledge Base

`knowledge/` 用于沉淀品牌调性、有效选题模式、prompt 摘录和图片风格，供生成流程在写作前读取。

## 使用原则

- `brand/`：放稳定的品牌认知，优先级最高。
- `topics/`：放历史话题和模式总结，适合做简单关键词召回。
- `prompts/`：保留当前模板摘录和变更记录，方便对照版本。
- `images/`：记录视觉风格，避免每次重头描述。

## 当前实现

- 生成前默认读取 `brand/tone.md`、`brand/angles.md`、`brand/vocabulary.md`。
- 根据 topic 关键词，从 `topics/winners.md` 与 `topics/patterns.md` 中做简单字符串匹配。
- 返回的内容会拼成 markdown 文本注入 prompt，作为参考而不是硬套模板。
