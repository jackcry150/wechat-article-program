# 功能需求：联网搜索增强（Tavily Search）

> 状态：待开发  
> 日期：2026-04-14

## 背景与目标

当前文章生成完全依赖大模型的训练数据，对于涉及"今年趋势"、"最新排行"等时效性强的主题，模型可能给出过时或捏造的信息。

本需求在现有生成流程中加入一个**前置联网搜索步骤**：当系统检测到用户输入包含时效性关键词时，自动调用 Tavily Search API 获取最新资讯，并将结果作为参考上下文注入到大纲和正文的 Prompt 中，让生成内容更贴合当下实际。

---

## 技术选型

**Tavily Search API**

- 专为 AI 应用设计的搜索 API，直接返回结构化内容（摘要、URL、发布日期）
- 支持 `topic: "news"` 模式，专门抓取新闻类内容
- 接口简单，不需要解析 HTML

---

## 触发机制：关键词检测

### 检测范围

在 `generateArticle()` 入口处，对以下字段做检测：

- `request.topic`（文章主题）
- `request.extraRequirements`（补充要求）

### 触发关键词列表

| 类别 | 关键词 |
|------|--------|
| 时间词 | `今年`、`今年度`、`2026`、`近期`、`近来`、`最近`、`当下`、`目前`、`现在` |
| 趋势词 | `趋势`、`风向`、`走向`、`方向` |
| 排行词 | `排行`、`榜单`、`TOP`、`热门`、`热点` |
| 最新词 | `最新`、`新出`、`新品`、`上新`、`刚出` |
| 流行词 | `流行`、`爆款`、`爆火`、`火了`、`大火` |

命中**任意一个**即触发搜索，大小写不敏感。

---

## 新增文件：`lib/tavily.ts`

负责封装所有与 Tavily API 的交互。

### 函数签名

```typescript
export interface TavilyResult {
  title: string;
  url: string;
  content: string;          // Tavily 返回的摘要文本
  publishedDate?: string;   // 可选，ISO 日期字符串
  score: number;            // 相关度分数 0-1
}

export interface TavilySearchResponse {
  query: string;
  results: TavilyResult[];
}

/**
 * 调用 Tavily 搜索，返回格式化后的结果。
 * 若 TAVILY_API_KEY 未配置，抛出 Error。
 */
export async function searchTavily(
  query: string,
  options?: {
    maxResults?: number;      // 默认 5
    searchDepth?: 'basic' | 'advanced';  // 默认 'basic'
    topic?: 'general' | 'news';          // 默认 'news'
  }
): Promise<TavilySearchResponse>

/**
 * 将搜索结果格式化为可注入 Prompt 的文本块。
 */
export function formatSearchResultsForPrompt(
  response: TavilySearchResponse
): string
```

### `formatSearchResultsForPrompt` 输出格式示例

```
=== 联网搜索参考资料（来源：Tavily，查询时间：2026-04-14）===
查询关键词：2026年母婴娃衣流行趋势

【资料1】2026春夏童装十大流行趋势解读
来源：https://example.com/article-1
摘要：今年春夏童装以自然色系为主，强调...

【资料2】国内母婴电商销售排行TOP10
来源：https://example.com/article-2
摘要：根据最新平台数据，帽子类目同比增长...

（共 5 条参考资料）
===
```

---

## 修改文件：`app/actions/generate.ts`

### 新增：关键词检测函数

```typescript
const SEARCH_TRIGGER_KEYWORDS = [
  '今年', '2026', '近期', '近来', '最近', '当下', '目前', '现在',
  '趋势', '风向', '走向', '排行', '榜单', 'TOP', '热门', '热点',
  '最新', '新出', '新品', '上新', '流行', '爆款', '爆火',
];

function shouldTriggerSearch(request: GenerateRequest): boolean {
  const text = `${request.topic} ${request.extraRequirements || ''}`;
  return SEARCH_TRIGGER_KEYWORDS.some(kw =>
    text.toLowerCase().includes(kw.toLowerCase())
  );
}
```

### 修改：`generateArticle()` 主流程

在现有"生成大纲"步骤之前，插入以下逻辑：

```
1. 调用 shouldTriggerSearch(request)
2. 如果触发：
   a. 调用 searchTavily(request.topic, { topic: 'news', maxResults: 5 })
   b. 调用 formatSearchResultsForPrompt() 生成文本块
   c. 将文本块作为 searchContext 传递给 buildOutlinePrompt 和 buildArticlePrompt
   d. 将搜索结果保存到 prompts/search_context.txt（便于排查）
3. 如果未触发：searchContext = undefined，流程不变
```

搜索失败不应中断整体流程：用 try/catch 捕获异常，打印警告日志，searchContext 降级为 undefined。

### 返回值扩展

在 `GenerateResult` 中增加 `searchUsed` 字段，供前端展示：

```typescript
searchUsed?: {
  triggered: boolean;
  query?: string;
  resultCount?: number;
}
```

---

## 修改文件：`lib/prompts.ts`

`buildOutlinePrompt` 和 `buildArticlePrompt` 均新增一个可选参数 `searchContext?: string`。

### 注入位置

在 Prompt 的"补充要求"之后、"输出要求"之前插入：

```
（如果 searchContext 存在）

以下是联网搜索到的最新参考资料，请在规划文章时适当参考，但不要直接抄录原文，保持自然：

${searchContext}
```

---

## 修改文件：`types/index.ts`

```typescript
// 在 GenerateResult 中新增：
searchUsed?: {
  triggered: boolean;
  query?: string;
  resultCount?: number;
}
```

---

## 修改文件：`.env.example`

```env
# Tavily Search（可选，有时效性关键词时触发联网搜索）
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 修改文件：`components/generator-form.tsx`

### 生成中状态（PendingStatusCard）

在 elapsed < 8 阶段前增加一个"正在联网搜索"阶段（elapsed < 3 时显示），但这个显示只是 UI 估算，不做实际状态同步（Server Action 不支持流式中间状态）。

实际方案：在 elapsed < 5 时显示"正在联网搜索最新资讯"。

### 结果区域

在"输出结果"中新增一个"联网搜索"状态卡片（仅在 `state.searchUsed` 存在时显示）：

```
[联网搜索]
✅ 已触发 / ❌ 未触发
查询词：xxxxx
命中资料：5 条
```

---

## 完整数据流（新增后）

```
用户输入（topic 含"今年趋势"等关键词）
    ↓
generateArticle()
    ↓
shouldTriggerSearch() → true
    ↓
searchTavily("今年娃衣流行趋势", { topic: 'news', maxResults: 5 })
    → Tavily API → 返回 5 条资讯
    ↓
formatSearchResultsForPrompt() → searchContext 文本块
    ↓
saveTextFile(outputDir, 'prompts/search_context.txt', searchContext)
    ↓
buildOutlinePrompt(request, searchContext)   ← 注入参考资料
    ↓
generateArticleContent() → DeerAPI（带资讯上下文的大纲）
    ↓
buildArticlePrompt(request, outline, searchContext)  ← 注入参考资料
    ↓
generateArticleContent() → DeerAPI（带资讯上下文的正文）
    ↓
... 后续图片生成流程不变 ...
    ↓
GenerateResult（含 searchUsed 字段）
    ↓
前端展示搜索触发状态
```

---

## 文件输出变更

触发搜索时，输出目录新增一个文件：

```
output/2026-04-14_xxx_今年娃衣排行/
├── prompts/
│   ├── search_context.txt     ← 新增：本次搜索结果原文
│   ├── outline_prompt.txt
│   ├── article_prompt.txt
│   └── ...
└── ...
```

---

## 涉及文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `lib/tavily.ts` | **新增** | Tavily API 封装 |
| `app/actions/generate.ts` | **修改** | 插入检测+搜索逻辑 |
| `lib/prompts.ts` | **修改** | 接收并注入 searchContext |
| `types/index.ts` | **修改** | GenerateResult 新增 searchUsed 字段 |
| `components/generator-form.tsx` | **修改** | 展示联网搜索状态 |
| `.env.example` | **修改** | 新增 TAVILY_API_KEY |
| `.env` | **手动配置** | 填入真实 TAVILY_API_KEY |

---

## 边界情况处理

| 情况 | 处理方式 |
|------|----------|
| `TAVILY_API_KEY` 未配置 | 跳过搜索，继续生成，不报错 |
| Tavily 请求超时或失败 | catch 异常，打印 `[Tavily] 搜索失败: xxx`，searchContext 降级为 undefined |
| 搜索结果为空（0条） | 不注入 searchContext，searchUsed.resultCount = 0 |
| 搜索结果太长 | formatSearchResultsForPrompt 对每条 content 截取前 300 字，总长度控制在 2000 字以内 |
| 用户主动在 extraRequirements 填写"不要联网" | 暂不支持，后续可加"禁用联网搜索"开关 |
