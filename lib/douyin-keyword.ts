const DOUYIN_SEARCH_URL = 'https://www.douyin.com/aweme/v1/web/general/search/single/';

const DOUYIN_SEARCH_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Referer': 'https://www.douyin.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

export type DouyinKeywordItem = {
  desc: string;
  engagement: number;
  playCount?: number;
  url?: string;
};

export type DouyinKeywordResult = {
  success: boolean;
  items: DouyinKeywordItem[];
  error?: string;
};

function normalizeDouyinKeywordItem(item: unknown): DouyinKeywordItem | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const record = item as Record<string, unknown>;
  const aweme = record.aweme_info && typeof record.aweme_info === 'object'
    ? record.aweme_info as Record<string, unknown>
    : undefined;
  if (!aweme) return undefined;

  const desc = typeof aweme.desc === 'string' ? aweme.desc.trim() : '';
  if (!desc) return undefined;

  const stats = aweme.statistics && typeof aweme.statistics === 'object'
    ? aweme.statistics as Record<string, unknown>
    : {};

  const digg = typeof stats.digg_count === 'number' ? stats.digg_count : 0;
  const comments = typeof stats.comment_count === 'number' ? stats.comment_count : 0;
  const shares = typeof stats.share_count === 'number' ? stats.share_count : 0;
  const playCount = typeof stats.play_count === 'number' ? stats.play_count : undefined;
  const aid = typeof aweme.aweme_id === 'string' ? aweme.aweme_id.trim() : '';

  return {
    desc,
    engagement: digg + comments + shares,
    playCount,
    url: aid ? `https://www.douyin.com/video/${aid}` : undefined,
  };
}

function extractDouyinKeywordItems(raw: unknown): DouyinKeywordItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const envelope = raw as Record<string, unknown>;
  const data = Array.isArray(envelope.data) ? envelope.data : [];

  return data
    .map(normalizeDouyinKeywordItem)
    .filter((item): item is DouyinKeywordItem => Boolean(item))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);
}

export async function fetchDouyinKeywordSearch(keyword: string): Promise<DouyinKeywordResult> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return { success: false, items: [], error: '抖音关键词不能为空' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const params = new URLSearchParams({
      keyword: normalizedKeyword,
      search_channel: 'aweme_general',
      sort_type: '1',
      publish_time: '7',
      count: '20',
      offset: '0',
      device_platform: 'webapp',
      aid: '6383',
      channel: 'channel_pc_web',
    });

    const response = await fetch(`${DOUYIN_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: DOUYIN_SEARCH_HEADERS,
    });

    if (!response.ok) {
      return { success: false, items: [], error: `抖音关键词搜索接口返回 ${response.status}` };
    }

    const raw: unknown = await response.json();
    const items = extractDouyinKeywordItems(raw);
    if (!items.length) {
      return { success: false, items: [], error: `抖音关键词「${normalizedKeyword}」返回空数据` };
    }

    return { success: true, items };
  } catch (error) {
    const message = error instanceof Error ? error.message : '抖音关键词搜索失败';
    return { success: false, items: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

export function formatDouyinKeywordContext(keyword: string, items: DouyinKeywordItem[]): string {
  const normalizedKeyword = keyword.trim() || '未指定关键词';
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  if (!items.length) {
    return [
      `【抖音关键词搜索：${normalizedKeyword}】`,
      `抓取时间：${timestamp}`,
      '当前没有拿到有效结果，请把抖音侧当作视觉表达和短视频风向的补充信号。',
    ].join('\n');
  }

  const lines = items.slice(0, 10).map((item, index) => (
    `${index + 1}. 互动 ${item.engagement}${item.playCount !== undefined ? `｜播放 ${item.playCount}` : ''}｜${item.desc}`
  ));

  return [
    `【抖音关键词搜索：${normalizedKeyword}】`,
    `抓取时间：${timestamp}`,
    ...lines,
    '',
    '请优先提炼抖音里更容易形成画面感、剧情模板、清单表达、角色化演绎和评论区跟风点的内容，用来补足小红书选题的视觉与趋势角度。',
  ].join('\n');
}

export function extractDouyinHotTopicsFromSearch(keyword: string, items: DouyinKeywordItem[]): string[] {
  const topicCounts = new Map<string, number>();
  const keywords = new Set([keyword.trim(), ...keyword.trim().split(/[\s、，,]+/)].filter(Boolean));

  const addTopic = (topic: string) => {
    const normalized = topic.replace(/^#|#$/g, '').trim();
    if (!normalized || normalized.length < 2 || keywords.has(normalized)) return;
    topicCounts.set(normalized, (topicCounts.get(normalized) ?? 0) + 1);
  };

  items.forEach((item) => {
    const hashtagMatches = item.desc.match(/#[^#\s]{2,30}/g) ?? [];
    hashtagMatches.forEach(addTopic);

    const phraseMatches = item.desc.match(/[\u4e00-\u9fa5A-Za-z0-9]{3,12}/g) ?? [];
    phraseMatches.forEach((phrase) => {
      if (/^(视频|抖音|记录|分享|热门)$/.test(phrase)) return;
      addTopic(phrase);
    });
  });

  return Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([topic]) => topic);
}
