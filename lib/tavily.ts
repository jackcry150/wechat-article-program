export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilyResult[];
}

type TavilyApiResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
    score?: number;
  }>;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 未配置，请先填写 .env`);
  }
  return value;
}

function todayString(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).replace(/\//g, '-');
}

export async function searchTavily(
  query: string,
  options?: {
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    topic?: 'general' | 'news';
  },
): Promise<TavilySearchResponse> {
  const apiKey = getRequiredEnv('TAVILY_API_KEY');
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: options?.maxResults ?? 5,
      search_depth: options?.searchDepth ?? 'basic',
      topic: options?.topic ?? 'news',
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily 搜索失败：HTTP ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as TavilyApiResponse;
  return {
    query,
    results: (data.results ?? [])
      .filter((item) => item.url && item.title && item.content)
      .map((item) => ({
        title: item.title || '未命名资料',
        url: item.url || '',
        content: item.content || '',
        publishedDate: item.published_date,
        score: typeof item.score === 'number' ? item.score : 0,
      })),
  };
}

export function formatSearchResultsForPrompt(response: TavilySearchResponse): string {
  const lines = [
    `=== 联网搜索参考资料（来源：Tavily，查询时间：${todayString()}）===`,
    `查询关键词：${response.query}`,
    '',
  ];

  response.results.forEach((result, index) => {
    lines.push(`【资料${index + 1}】${result.title}`);
    lines.push(`来源：${result.url}`);
    if (result.publishedDate) {
      lines.push(`发布日期：${result.publishedDate}`);
    }
    lines.push(`摘要：${result.content}`);
    lines.push('');
  });

  lines.push(`（共 ${response.results.length} 条参考资料）`);
  lines.push('===');

  return lines.join('\n');
}
