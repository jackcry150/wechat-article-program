'use server';

import {
  buildKeywordBasedTopicSynthesisPrompt,
  buildXhsBusinessTopicSynthesisPrompt,
  buildXhsTopicRefinementPrompt,
} from '../../lib/prompts';
import {
  generateStructuredText,
} from '../../lib/deerapi';
import {
  xhsHot,
  xhsHotMulti,
  xhsCategories,
  xhsLogin,
  xhsSearch,
  xhsStatus,
} from '../../lib/xiaohongshu';
import type { XhsCategory, XhsLoginMethod, XhsNote, XhsNoteType, XhsResult, XhsSort } from '../../lib/xiaohongshu';
import { fetchWeiboHot, formatWeiboHotContext, filterWeiboHotByKeywords } from '../../lib/weibo-hot';
import type { ExternalHotItem } from '../../lib/weibo-hot';
import { fetchDouyinHot, formatDouyinHotContext } from '../../lib/douyin-hot';
import {
  extractDouyinHotTopicsFromSearch,
  fetchDouyinKeywordSearch,
  formatDouyinKeywordContext,
} from '../../lib/douyin-keyword';
import { SEARCH_KEYWORD_GROUPS } from '../../lib/xhs-business';

export async function checkXhsStatus(): Promise<XhsResult> {
  return xhsStatus();
}

export async function loginXhs(method: XhsLoginMethod = 'browser'): Promise<XhsResult> {
  return xhsLogin(method);
}

export async function getXhsCategories(): Promise<XhsResult> {
  return xhsCategories();
}

export async function fetchXhsHot(_prevState: XhsResult | null, formData: FormData): Promise<XhsResult> {
  const categories = formData.getAll('category').map((item) => String(item).trim()).filter(Boolean) as XhsCategory[];
  if (categories.length > 1) {
    return xhsHotMulti(categories);
  }
  return xhsHot(String(categories[0] || formData.get('category') || 'fashion') as XhsCategory);
}

export async function searchXhs(_prevState: XhsResult | null, formData: FormData): Promise<XhsResult> {
  return xhsSearch(
    String(formData.get('keyword') || ''),
    String(formData.get('sort') || 'general') as XhsSort,
    String(formData.get('noteType') || 'all') as XhsNoteType,
  );
}

export async function refineXhsTopics(keyword: string, notes: XhsNote[]): Promise<XhsResult> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return { success: false, error: '请先输入小红书搜索关键词' };
  }

  try {
    const prompt = buildXhsTopicRefinementPrompt(normalizedKeyword, notes);
    const text = await generateStructuredText(
      prompt,
      '你是资深小红书选题策划，负责把搜索结果加工成可发布、可同步到公众号的内容选题。',
    );

    return {
      success: true,
      message: text,
      raw: { prompt },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '小红书选题修饰失败',
    };
  }
}

export async function analyzeXhsHotTopics(categories: string[], notes: XhsNote[]): Promise<XhsResult> {
  if (!notes.length) {
    return { success: false, error: '请先拉取小红书热点' };
  }

  const normalizedCategories = categories.map((item) => item.trim()).filter(Boolean);

  try {
    const prompt = buildXhsTopicRefinementPrompt(
      normalizedCategories.length ? `小红书热点：${normalizedCategories.join('、')}` : '小红书热点',
      notes,
      {
        resultLabel: '热点结果',
        extraContext: [
          normalizedCategories.length ? `热点分类：${normalizedCategories.join('、')}` : undefined,
          '请优先提炼这些热点里反复出现的情绪、需求、场景和表达方式。',
          '不要局限在单一分类，可以跨类组合成更适合继续写成小红书笔记或公众号文章的选题。',
        ].filter(Boolean).join('\n'),
      },
    );
    const text = await generateStructuredText(
      prompt,
      '你是资深小红书选题策划，负责把热点结果加工成可发布、可同步到公众号的完整内容选题策划案。',
    );

    return {
      success: true,
      message: text,
      raw: { prompt },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '热点选题分析失败',
    };
  }
}

export type ExternalHotContextResult = {
  weiboContext: string;
  douyinContext: string;
  weiboLive: boolean;
  douyinLive: boolean;
  weiboMode: 'keyword-search' | 'hot-list' | 'fallback-context';
  douyinMode: 'keyword-search' | 'hot-list' | 'fallback-context';
  weiboKeywordsTried: KeywordSearchStatus[];
  douyinKeywordsTried: KeywordSearchStatus[];
  weiboError?: string;
  douyinError?: string;
};

export type KeywordSearchStatus = {
  keyword: string;
  success: boolean;
  error?: string;
};

type PlatformContextBuildResult = {
  context: string;
  live: boolean;
  mode: ExternalHotContextResult['weiboMode'];
  keywordStatuses: KeywordSearchStatus[];
  topicInsights: string;
  error?: string;
};

function collectSearchKeywords(keyword: string, businessDirections: string[]): string[] {
  const normalizedKeyword = keyword.trim();
  const result: string[] = [];
  const seen = new Set<string>();

  const pushKeyword = (value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };

  pushKeyword(normalizedKeyword);
  businessDirections.forEach((direction) => {
    pushKeyword(direction);
    Object.entries(SEARCH_KEYWORD_GROUPS).forEach(([group, keywords]) => {
      if (direction.includes(group) || group.includes(direction)) {
        keywords.forEach(pushKeyword);
      }
    });
  });

  return result.slice(0, 5);
}

function mergeTopicInsights(platform: '微博' | '抖音', keyword: string, topics: string[]): string {
  if (!topics.length) {
    return `${platform}关键词「${keyword}」没有提炼出稳定高频话题，请优先依赖上下文正文里的情绪和表达方式。`;
  }

  return `${platform}关键词「${keyword}」提炼出的高频话题/表达：${topics.join('、')}`;
}

function buildWeiboHotFilterContext(
  keyword: string,
  businessDirections: string[],
  items: ExternalHotItem[],
): { context: string; matched: number; total: number } {
  const keywords = collectFilterKeywords(keyword, businessDirections);

  if (!keywords.length) {
    return {
      context: formatWeiboHotContext(items),
      matched: 0,
      total: items.length,
    };
  }

  const { matched, unmatched } = filterWeiboHotByKeywords(items, keywords);

  if (!matched.length) {
    // No keyword match — still show hot list with a note
    const context = [
      formatWeiboHotContext(items.slice(0, 15)),
      '',
      `⚠️ 以上热搜中未匹配到业务关键词「${keywords.join('、')}」。已展示全站热搜作为大众情绪参考，请在选题时主动往业务方向靠拢。`,
    ].join('\n');
    return { context, matched: 0, total: items.length };
  }

  // Show matched items first, then broader context
  const matchedContext = formatWeiboHotContext(matched, matched.length);
  const broaderNote = unmatched.length
    ? `\n\n📌 另有 ${unmatched.length} 条非直接相关热搜可作为大众情绪背景。`
    : '';

  return {
    context: matchedContext + broaderNote,
    matched: matched.length,
    total: items.length,
  };
}

function collectFilterKeywords(keyword: string, businessDirections: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushKeyword = (value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };

  pushKeyword(keyword);
  businessDirections.forEach((direction) => {
    pushKeyword(direction);
    const group = SEARCH_KEYWORD_GROUPS[direction];
    if (group) {
      group.forEach(pushKeyword);
    }
  });

  return result;
}

async function buildWeiboContext(
  keyword: string,
  businessDirections: string[],
): Promise<PlatformContextBuildResult> {
  const hotResult = await fetchWeiboHot();

  if (hotResult.success && hotResult.items.length) {
    const filterResult = buildWeiboHotFilterContext(keyword, businessDirections, hotResult.items);
    return {
      context: filterResult.context,
      live: true,
      mode: filterResult.matched > 0 ? 'keyword-search' : 'hot-list',
      keywordStatuses: [],
      topicInsights: filterResult.matched > 0
        ? `微博热搜中匹配到 ${filterResult.matched} 条业务相关热搜（共 ${filterResult.total} 条）`
        : `微博热搜中未匹配到业务关键词，已展示全站热搜`,
      error: filterResult.matched === 0 ? `微博热搜共 ${filterResult.total} 条，未命中业务关键词` : undefined,
    };
  }

  return {
    context: buildFallbackExternalContext('微博', keyword, businessDirections),
    live: false,
    mode: 'fallback-context',
    keywordStatuses: [],
    topicInsights: '微博热搜获取失败，当前仅保留兜底语境，请谨慎判断微博侧信号。',
    error: hotResult.error || '微博热搜获取失败',
  };
}

async function buildDouyinKeywordFirstContext(
  keyword: string,
  businessDirections: string[],
): Promise<PlatformContextBuildResult> {
  const keywords = collectSearchKeywords(keyword, businessDirections);
  const keywordStatuses: KeywordSearchStatus[] = [];
  const errors: string[] = [];

  for (const searchKeyword of keywords) {
    const result = await fetchDouyinKeywordSearch(searchKeyword);
    keywordStatuses.push({
      keyword: searchKeyword,
      success: result.success,
      error: result.error,
    });

    if (result.success && result.items.length) {
      return {
        context: formatDouyinKeywordContext(searchKeyword, result.items),
        live: true,
        mode: 'keyword-search',
        keywordStatuses,
        topicInsights: mergeTopicInsights('抖音', searchKeyword, extractDouyinHotTopicsFromSearch(searchKeyword, result.items)),
        error: errors.length ? errors.join('\n') : undefined,
      };
    }

    if (result.error) {
      errors.push(`关键词「${searchKeyword}」失败：${result.error}`);
      console.error(`[xiaohongshu] douyin keyword search failed for "${searchKeyword}": ${result.error}`);
    }
  }

  const hotResult = await fetchDouyinHot();
  if (hotResult.success && hotResult.items.length) {
    return {
      context: formatDouyinHotContext(hotResult.items),
      live: true,
      mode: 'hot-list',
      keywordStatuses,
      topicInsights: '抖音关键词搜索失败，已回退到全站热搜。请优先从热搜里提炼画面感、剧情模板和短视频表达方式。',
      error: errors.length ? errors.join('\n') : undefined,
    };
  }

  if (hotResult.error) {
    errors.push(`热搜回退失败：${hotResult.error}`);
    console.error(`[xiaohongshu] douyin hot fallback failed: ${hotResult.error}`);
  }

  return {
    context: buildFallbackExternalContext('抖音', keyword, businessDirections),
    live: false,
    mode: 'fallback-context',
    keywordStatuses,
    topicInsights: '抖音关键词搜索和热搜回退都失败，当前仅保留兜底语境，请谨慎判断抖音侧信号。',
    error: errors.join('\n') || undefined,
  };
}

export async function fetchKeywordSearchContexts(
  keyword: string,
  businessDirections: string[],
): Promise<ExternalHotContextResult & { weiboTopicInsights: string; douyinTopicInsights: string }> {
  const [weiboResult, douyinResult] = await Promise.all([
    buildWeiboContext(keyword, businessDirections),
    buildDouyinKeywordFirstContext(keyword, businessDirections),
  ]);

  return {
    weiboContext: weiboResult.context,
    douyinContext: douyinResult.context,
    weiboLive: weiboResult.live,
    douyinLive: douyinResult.live,
    weiboMode: weiboResult.mode,
    douyinMode: douyinResult.mode,
    weiboKeywordsTried: weiboResult.keywordStatuses,
    douyinKeywordsTried: douyinResult.keywordStatuses,
    weiboTopicInsights: weiboResult.topicInsights,
    douyinTopicInsights: douyinResult.topicInsights,
    weiboError: weiboResult.error,
    douyinError: douyinResult.error,
  };
}

export async function fetchExternalHotContexts(
  keyword: string,
  businessDirections: string[],
): Promise<ExternalHotContextResult> {
  const result = await fetchKeywordSearchContexts(keyword, businessDirections);
  return {
    weiboContext: result.weiboContext,
    douyinContext: result.douyinContext,
    weiboLive: result.weiboLive,
    douyinLive: result.douyinLive,
    weiboMode: result.weiboMode,
    douyinMode: result.douyinMode,
    weiboKeywordsTried: result.weiboKeywordsTried,
    douyinKeywordsTried: result.douyinKeywordsTried,
    weiboError: result.weiboError,
    douyinError: result.douyinError,
  };
}

type XhsBusinessTopicParams = {
  keyword: string;
  businessDirections: string[];
  weiboContext: string;
  douyinContext: string;
  weiboTopicInsights?: string;
  douyinTopicInsights?: string;
  xhsHotAnalysis?: string;
  xhsSearchAnalysis?: string;
  hotNotes?: XhsNote[];
  searchNotes?: XhsNote[];
};

function buildFallbackExternalContext(platform: '微博' | '抖音', keyword: string, businessDirections: string[]): string {
  const directionText = businessDirections.length ? businessDirections.join('、') : '泛热点';
  const normalizedKeyword = keyword.trim() || '当前业务';

  if (platform === '微博') {
    return [
      `围绕「${normalizedKeyword}」观察与 ${directionText} 相关的讨论热词、情绪关键词和社会化话题切口。`,
      '重点关注大众正在争论什么、吐槽什么、跟风什么，以及哪些表达方式容易引发转发和评论。',
      '如果缺少直接热榜数据，请优先把它当作外部舆情背景，用于补充小红书选题的情绪角度和大众认知入口。',
    ].join('\n');
  }

  return [
    `围绕「${normalizedKeyword}」观察与 ${directionText} 相关的短视频热门表达、剧情模板、种草场景和评论区高频问题。`,
    '重点关注哪些内容更适合被拆成真实体验、避坑建议、清单展示、前后对比或人物角色切入。',
    '如果缺少直接热视频数据，请优先把它当作外部内容风向，用于补充小红书选题的画面感和爆点表达。',
  ].join('\n');
}

export async function synthesizeBusinessXhsTopics(params: XhsBusinessTopicParams): Promise<XhsResult> {
  const normalizedKeyword = params.keyword.trim();
  const businessDirections = params.businessDirections.map((item) => item.trim()).filter(Boolean);

  if (!normalizedKeyword) {
    return { success: false, error: '请先输入辅助关键词' };
  }

  const weiboContext = params.weiboContext.trim() || buildFallbackExternalContext('微博', normalizedKeyword, businessDirections);
  const douyinContext = params.douyinContext.trim() || buildFallbackExternalContext('抖音', normalizedKeyword, businessDirections);

  try {
    const prompt = buildXhsBusinessTopicSynthesisPrompt({
      keyword: normalizedKeyword,
      businessDirections,
      weiboContext,
      douyinContext,
      weiboTopicInsights: params.weiboTopicInsights,
      douyinTopicInsights: params.douyinTopicInsights,
      xhsHotAnalysis: params.xhsHotAnalysis,
      xhsSearchAnalysis: params.xhsSearchAnalysis,
      hotNotes: params.hotNotes,
      searchNotes: params.searchNotes,
    });
    const keywordFirstPrompt = buildKeywordBasedTopicSynthesisPrompt({
      keyword: normalizedKeyword,
      businessDirections,
      weiboKeywordContext: weiboContext,
      douyinKeywordContext: douyinContext,
      weiboTopicInsights: params.weiboTopicInsights || '微博侧没有额外话题提炼。',
      douyinTopicInsights: params.douyinTopicInsights || '抖音侧没有额外话题提炼。',
      xhsHotAnalysis: params.xhsHotAnalysis,
      hotNotes: params.hotNotes,
    });
    const text = await generateStructuredText(
      `${keywordFirstPrompt}\n\n${prompt}`,
      '你负责多平台热点归纳和小红书业务选题生成，重点输出适合小红书发布且能自然承接咨询转化的候选主题。',
    );

    return {
      success: true,
      message: text,
      raw: {
        prompt,
        weiboContext,
        douyinContext,
        businessDirections,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '业务选题生成失败',
    };
  }
}
