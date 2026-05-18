export type ExternalHotItem = {
  title: string;
  hot?: number;
  rawHot?: string;
  url?: string;
  label?: string;
  source: 'weibo' | 'douyin';
};

export type ExternalHotFetchResult = {
  success: boolean;
  items: ExternalHotItem[];
  error?: string;
};

const WEIBO_HOT_URL = 'https://weibo.com/ajax/side/hotSearch';

function normalizeWeiboItem(item: unknown): ExternalHotItem | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const record = item as Record<string, unknown>;

  const title = typeof record.word === 'string' ? record.word.trim()
    : typeof record.title === 'string' ? record.title.trim()
    : undefined;
  if (!title) return undefined;

  const rawHot = typeof record.num === 'number' ? String(record.num)
    : typeof record.num === 'string' ? record.num
    : typeof record.hot === 'string' ? record.hot
    : undefined;

  const hot = rawHot ? Number.parseInt(rawHot.replace(/[^\d]/g, ''), 10) || undefined : undefined;

  const label = typeof record.label_name === 'string' ? record.label_name.trim() || undefined
    : typeof record.category === 'string' ? record.category.trim() || undefined
    : undefined;

  const wordScheme = typeof record.word_scheme === 'string' ? record.word_scheme : undefined;
  const url = wordScheme
    ? `https://s.weibo.com/weibo?q=${encodeURIComponent(wordScheme)}`
    : `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`;

  return { title, hot, rawHot, url, label, source: 'weibo' };
}

function extractWeiboItems(raw: unknown): ExternalHotItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const envelope = raw as Record<string, unknown>;

  const data = envelope.data && typeof envelope.data === 'object'
    ? envelope.data as Record<string, unknown>
    : {};

  const realtime = Array.isArray(data.realtime) ? data.realtime
    : Array.isArray(envelope.realtime) ? envelope.realtime
    : [];

  return realtime.map(normalizeWeiboItem).filter((item): item is ExternalHotItem => Boolean(item));
}

export async function fetchWeiboHot(): Promise<ExternalHotFetchResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(WEIBO_HOT_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://weibo.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { success: false, items: [], error: `微博热搜接口返回 ${response.status}` };
    }

    const raw: unknown = await response.json();
    const items = extractWeiboItems(raw);

    if (!items.length) {
      return { success: false, items: [], error: '微博热搜接口返回空数据' };
    }

    return { success: true, items };
  } catch (error) {
    const message = error instanceof Error ? error.message : '微博热搜请求失败';
    return { success: false, items: [], error: message };
  }
}

export function filterWeiboHotByKeywords(
  items: ExternalHotItem[],
  keywords: string[],
): { matched: ExternalHotItem[]; unmatched: ExternalHotItem[] } {
  const normalizedKeywords = keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length >= 2);

  if (!normalizedKeywords.length) {
    return { matched: [], unmatched: items };
  }

  const matched: ExternalHotItem[] = [];
  const unmatched: ExternalHotItem[] = [];

  for (const item of items) {
    const title = item.title.toLowerCase();
    const hasMatch = normalizedKeywords.some((kw) => title.includes(kw));
    if (hasMatch) {
      matched.push(item);
    } else {
      unmatched.push(item);
    }
  }

  return { matched, unmatched };
}

export function formatWeiboHotContext(items: ExternalHotItem[], topN = 15): string {
  const top = items.slice(0, topN);
  if (!top.length) return '';

  const lines = top.map((item, index) => {
    const rank = `${index + 1}.`;
    const label = item.label ? ` [${item.label}]` : '';
    const heat = item.rawHot ? ` 热度${item.rawHot}` : '';
    return `${rank} ${item.title}${label}${heat}`;
  });

  return [
    '【微博实时热搜 Top ' + top.length + '】',
    ...lines,
    '',
    '请从以上微博热搜中提取：大众正在讨论的情绪关键词、争议点、跟风话术，以及能引出咨询需求的外部语境（用户焦虑、选购纠结、圈层身份表达、节日节点等），用于补充小红书选题的情绪角度和大众认知入口。',
  ].join('\n');
}
