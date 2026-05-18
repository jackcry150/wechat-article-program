import type { ExternalHotFetchResult, ExternalHotItem } from './weibo-hot';

const DOUYIN_HOT_URL = 'https://www.douyin.com/aweme/v1/web/hot/search/list/';

const DOUYIN_BASE_PARAMS: Record<string, string> = {
  device_platform: 'webapp',
  aid: '6383',
  channel: 'channel_pc_web',
  detail_list: '1',
  source: 'hot_search_history',
};

const DOUYIN_HEADERS: Record<string, string> = {
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

function buildDouyinUrl(): string {
  const params = new URLSearchParams(DOUYIN_BASE_PARAMS);
  return `${DOUYIN_HOT_URL}?${params.toString()}`;
}

function normalizeDouyinItem(item: unknown): ExternalHotItem | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const record = item as Record<string, unknown>;

  const wordItem = record.word_item && typeof record.word_item === 'object'
    ? record.word_item as Record<string, unknown>
    : {};

  const title = typeof wordItem.word === 'string' ? wordItem.word.trim()
    : typeof record.word === 'string' ? record.word.trim()
    : typeof record.sentence_id === 'string' ? record.sentence_id.trim()
    : undefined;

  if (!title) return undefined;

  const rawHot = typeof record.hot_value === 'number' ? String(record.hot_value)
    : typeof record.hot_value === 'string' ? record.hot_value
    : typeof wordItem.hot_value === 'number' ? String(wordItem.hot_value)
    : undefined;

  const hot = rawHot ? Number.parseInt(rawHot.replace(/[^\d]/g, ''), 10) || undefined : undefined;

  const label = typeof record.label === 'string' ? record.label.trim() || undefined
    : typeof wordItem.label === 'string' ? wordItem.label.trim() || undefined
    : undefined;

  const url = `https://www.douyin.com/search/${encodeURIComponent(title)}`;

  return { title, hot, rawHot, url, label, source: 'douyin' };
}

function extractDouyinItems(raw: unknown): ExternalHotItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const envelope = raw as Record<string, unknown>;

  const data = envelope.data && typeof envelope.data === 'object'
    ? envelope.data as Record<string, unknown>
    : {};

  const wordList = Array.isArray(data.word_list) ? data.word_list
    : Array.isArray(envelope.word_list) ? envelope.word_list
    : [];

  return wordList.map(normalizeDouyinItem).filter((item): item is ExternalHotItem => Boolean(item));
}

async function attemptDouyinFetch(cookie?: string): Promise<ExternalHotFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  const headers: Record<string, string> = { ...DOUYIN_HEADERS };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const response = await fetch(buildDouyinUrl(), {
    signal: controller.signal,
    headers,
  });

  clearTimeout(timer);

  if (!response.ok) {
    return { success: false, items: [], error: `抖音热搜接口返回 ${response.status}` };
  }

  const raw: unknown = await response.json();
  const items = extractDouyinItems(raw);

  if (!items.length) {
    return { success: false, items: [], error: '抖音热搜接口返回空数据' };
  }

  return { success: true, items };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchDouyinHot(cookie?: string): Promise<ExternalHotFetchResult> {
  const maxRetries = 2;
  let lastError = '抖音热搜请求失败';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(800 * attempt);
      }
      const result = await attemptDouyinFetch(cookie);
      if (result.success) return result;
      lastError = result.error ?? lastError;
    } catch (error) {
      lastError = error instanceof Error ? error.message : '抖音热搜请求失败';
    }
  }

  return { success: false, items: [], error: lastError };
}

export function formatDouyinHotContext(items: ExternalHotItem[], topN = 15): string {
  const top = items.slice(0, topN);
  if (!top.length) return '';

  const lines = top.map((item, index) => {
    const rank = `${index + 1}.`;
    const label = item.label ? ` [${item.label}]` : '';
    const heat = item.rawHot ? ` 热度${item.rawHot}` : '';
    return `${rank} ${item.title}${label}${heat}`;
  });

  return [
    '【抖音实时热搜 Top ' + top.length + '】',
    ...lines,
    '',
    '请从以上抖音热搜中提取：短视频里容易爆的剧情模板、清单表达、前后对比和角色化切口，以及适合搬到小红书的展示方式（开箱、娃衣搭配、人物设定、踩坑复盘、热点借势等），用于补充小红书选题的画面感和爆点表达。',
  ].join('\n');
}
