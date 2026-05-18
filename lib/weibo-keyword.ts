export type WeiboKeywordItem = {
  text: string;
  engagement: number;
  createdAt?: string;
  url?: string;
};

export type WeiboKeywordResult = {
  success: boolean;
  items: WeiboKeywordItem[];
  error?: string;
};

const MOBILE_SEARCH_URL = 'https://m.weibo.cn/api/container/getIndex';
const MOBILE_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://m.weibo.cn/',
  'X-Requested-With': 'XMLHttpRequest',
};

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, '\'')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMblogUrl(mblog: Record<string, unknown>): string | undefined {
  const bid = typeof mblog.bid === 'string' ? mblog.bid.trim() : '';
  const user = mblog.user && typeof mblog.user === 'object'
    ? mblog.user as Record<string, unknown>
    : undefined;
  const userId = user && (typeof user.idstr === 'string' ? user.idstr.trim() : typeof user.id === 'number' ? String(user.id) : '');

  if (!bid || !userId) return undefined;
  return `https://m.weibo.cn/detail/${bid}?uid=${userId}`;
}

function normalizeWeiboKeywordItem(card: unknown): WeiboKeywordItem | undefined {
  if (!card || typeof card !== 'object') return undefined;
  const record = card as Record<string, unknown>;
  if (record.card_type !== 9) return undefined;

  const mblog = record.mblog && typeof record.mblog === 'object'
    ? record.mblog as Record<string, unknown>
    : undefined;
  if (!mblog) return undefined;

  const text = typeof mblog.text === 'string' ? stripHtml(mblog.text) : '';
  if (!text) return undefined;

  const attitudes = typeof mblog.attitudes_count === 'number' ? mblog.attitudes_count : 0;
  const reposts = typeof mblog.reposts_count === 'number' ? mblog.reposts_count : 0;
  const comments = typeof mblog.comments_count === 'number' ? mblog.comments_count : 0;
  const engagement = attitudes + reposts + comments;
  const createdAt = typeof mblog.created_at === 'string' ? mblog.created_at.trim() : undefined;

  return {
    text,
    engagement,
    createdAt,
    url: extractMblogUrl(mblog),
  };
}

function extractWeiboKeywordItems(raw: unknown): WeiboKeywordItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const envelope = raw as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === 'object'
    ? envelope.data as Record<string, unknown>
    : undefined;
  const cards = Array.isArray(data?.cards) ? data.cards : [];

  return cards
    .map(normalizeWeiboKeywordItem)
    .filter((item): item is WeiboKeywordItem => Boolean(item))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);
}

export async function fetchWeiboKeywordSearch(keyword: string): Promise<WeiboKeywordResult> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return { success: false, items: [], error: '微博关键词不能为空' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const params = new URLSearchParams({
      containerid: `100103type=1&q=${normalizedKeyword}`,
      page_type: 'searchall',
    });
    const response = await fetch(`${MOBILE_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: MOBILE_HEADERS,
    });

    if (!response.ok) {
      return { success: false, items: [], error: `微博关键词搜索接口返回 ${response.status}` };
    }

    const raw: unknown = await response.json();
    const items = extractWeiboKeywordItems(raw);
    if (!items.length) {
      return { success: false, items: [], error: `微博关键词「${normalizedKeyword}」返回空数据` };
    }

    return { success: true, items };
  } catch (error) {
    const message = error instanceof Error ? error.message : '微博关键词搜索失败';
    return { success: false, items: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

export function formatWeiboKeywordContext(keyword: string, items: WeiboKeywordItem[]): string {
  const normalizedKeyword = keyword.trim() || '未指定关键词';
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  if (!items.length) {
    return [
      `【微博关键词搜索：${normalizedKeyword}】`,
      `抓取时间：${timestamp}`,
      '当前没有拿到有效结果，请把微博侧当作情绪和社会化讨论的补充信号，而不是事实来源。',
    ].join('\n');
  }

  const lines = items.slice(0, 10).map((item, index) => (
    `${index + 1}. 互动 ${item.engagement}${item.createdAt ? `｜发布时间 ${item.createdAt}` : ''}｜${item.text}`
  ));

  return [
    `【微博关键词搜索：${normalizedKeyword}】`,
    `抓取时间：${timestamp}`,
    ...lines,
    '',
    '请优先提炼微博里出现频率高的情绪、争议、圈层表达、转发话术和大众认知入口，用来补足小红书选题的社会化讨论角度。',
  ].join('\n');
}

export function extractWeiboHotTopicsFromSearch(keyword: string, items: WeiboKeywordItem[]): string[] {
  const topicCounts = new Map<string, number>();
  const keywords = new Set([keyword.trim(), ...keyword.trim().split(/[\s、，,]+/)].filter(Boolean));

  const addTopic = (topic: string) => {
    const normalized = topic.replace(/^#|#$/g, '').trim();
    if (!normalized || normalized.length < 2 || keywords.has(normalized)) return;
    topicCounts.set(normalized, (topicCounts.get(normalized) ?? 0) + 1);
  };

  items.forEach((item) => {
    const hashtagMatches = item.text.match(/#[^#\n]{2,30}#/g) ?? [];
    hashtagMatches.forEach(addTopic);

    const phraseMatches = item.text.match(/[\u4e00-\u9fa5A-Za-z0-9]{3,12}/g) ?? [];
    phraseMatches.forEach((phrase) => {
      if (/^(转发|评论|点赞|全文|网页链接)$/.test(phrase)) return;
      addTopic(phrase);
    });
  });

  return Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([topic]) => topic);
}
