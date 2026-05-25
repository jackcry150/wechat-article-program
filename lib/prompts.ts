import { ArticleLength, ContentPlatform, GenerateRequest } from '../types';
import type { XhsNote } from './xiaohongshu';
import { BUSINESS_KEYWORDS } from './xhs-business';

const wechatLengthGuide: Record<ArticleLength, string> = {
  short: '约 800-1200 字，适合快速阅读',
  medium: '约 1500-2200 字，适合常规公众号深度稿',
  long: '约 2500-3500 字，适合系统拆解型长文',
};

const xhsLengthGuide: Record<ArticleLength, string> = {
  short: '约 300 字，适合轻量种草/观点笔记',
  medium: '约 500 字，适合信息密度适中的小红书笔记',
  long: '约 800 字，适合教程、清单、避坑、经验复盘类笔记',
};

function getPlatform(params: Pick<GenerateRequest, 'platform'>): ContentPlatform {
  return params.platform || 'wechat';
}

function getLengthGuide(params: GenerateRequest): string {
  return getPlatform(params) === 'xiaohongshu'
    ? xhsLengthGuide[params.length]
    : wechatLengthGuide[params.length];
}

function platformLabel(platform: ContentPlatform): string {
  return platform === 'xiaohongshu' ? '小红书' : '微信公众号';
}

function formatSearchContext(searchContext?: string): string | undefined {
  if (!searchContext) return undefined;
  return `\n以下是联网搜索到的最新参考资料，请适当参考，但不要直接抄录原文：\n\n${searchContext}`;
}

function formatKnowledgeContext(knowledgeContext?: string): string | undefined {
  if (!knowledgeContext) return undefined;
  return `\n以下是品牌知识库和历史经验的积累，请务必参考但不要生硬套用：\n\n${knowledgeContext}`;
}

function formatDocumentContext(documentContext?: string): string | undefined {
  if (!documentContext) return undefined;
  return `\n以下是用户提供的素材文档内容，请把它当作本次写作的重要事实、案例和选题来源：\n\n${documentContext}`;
}

function formatPriorityDirectives(raw?: string, heading = '以下为用户指定必须体现的内容'): string | undefined {
  if (!raw?.trim()) return undefined;

  const normalized = raw
    .split(/\r?\n|[，,；;、]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!normalized.length) return undefined;

  return [
    `【最高优先级】${heading}：`,
    ...normalized.map((item) => `- ${item}`),
  ].join('\n');
}

export function buildOutlinePrompt(
  params: GenerateRequest,
  searchContext?: string,
  knowledgeContext?: string,
  documentContext?: string,
): string {
  if (getPlatform(params) === 'xiaohongshu') {
    return [
      '你是一名资深小红书内容策划，熟悉小红书的搜索流量、收藏转化、标题钩子、评论区互动、业务植入节奏和真实口吻。',
      '请基于下面信息先输出“小红书笔记策划案”，不要直接写完整正文。',
      `笔记主题：${params.topic}`,
      params.style ? `风格：${params.style}` : undefined,
      params.audience ? `目标人群：${params.audience}` : undefined,
      `篇幅要求：${getLengthGuide(params)}`,
      params.extraRequirements ? `补充要求：${params.extraRequirements}` : undefined,
      formatSearchContext(searchContext),
      formatDocumentContext(documentContext),
      '',
      '请输出：',
      '1. 5 个可直接发布的小红书标题（要有搜索关键词，但不要标题党过度）',
      '2. 推荐标题和推荐理由',
      '3. 笔记定位：给谁看、解决什么具体问题、读完有什么收获、与业务的映射关系',
      '4. 正文结构：开头钩子、3-5 个正文模块、结尾互动引导',
      '5. 转化设计：适合在什么位置自然引出咨询/私信/加群/领取资料，不要生硬推销',
      '6. 关键词与话题标签：给出 8-12 个 #话题，区分核心词、长尾词、场景词',
      '7. 封面文案建议：1 句主标题 + 1 句副标题，适合放在封面图上',
      '',
      formatPriorityDirectives(params.customOutlinePrompt, '以下内容必须在大纲中明确规划，如含具体品牌/产品名，必须作为案例纳入结构，不得遗漏'),
      formatKnowledgeContext(knowledgeContext),
      '',
      '要求：',
      '- 语言像真人博主，不要像报告或广告软文',
      '- 标题和话题要能被小红书用户搜索到',
      '- 内容必须能落到具体场景、步骤、清单或经验',
      '- 明确说明这个选题如何承接业务方向，但表达要自然，像真实咨询建议而不是销售话术',
      '- 避免"宝子们冲""绝绝子"等过时模板腔，除非用户特别要求',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    '你是一名资深微信公众号主编。',
    '请基于下面信息先输出文章大纲，不要直接写正文。',
    `主题：${params.topic}`,
    params.style ? `风格：${params.style}` : undefined,
    params.audience ? `目标读者：${params.audience}` : undefined,
    `篇幅要求：${getLengthGuide(params)}`,
    params.extraRequirements ? `补充要求：${params.extraRequirements}` : undefined,
    formatSearchContext(searchContext),
    formatDocumentContext(documentContext),
    '',
    '请输出：',
    '1. 3 个可选标题',
    '2. 一个推荐标题',
    '3. 文章结构大纲（导语、3-5 个小节、结尾）',
    '4. 每个小节想表达的核心要点',
    '',
    formatPriorityDirectives(params.customOutlinePrompt, '以下内容必须在大纲中明确规划，如含具体品牌/产品名，必须作为案例纳入结构，不得遗漏'),
    formatKnowledgeContext(knowledgeContext),
    '',
    '要求：',
    '- 适合公众号排版和阅读习惯',
    '- 语言自然，不要太 AI 腔',
    '- 段落节奏适合后续扩写',
    ]
    .filter(Boolean)
    .join('\n');
}

export function buildArticlePrompt(
  params: GenerateRequest,
  outline: string,
  searchContext?: string,
  knowledgeContext?: string,
  documentContext?: string,
): string {
  if (getPlatform(params) === 'xiaohongshu') {
    return [
      '你是一名资深小红书博主和内容编辑。',
      '请根据下面的小红书笔记策划案，写成一篇可以直接发布的小红书笔记，输出 Markdown。',
      '',
      `笔记主题：${params.topic}`,
      params.style ? `风格：${params.style}` : undefined,
      params.audience ? `目标人群：${params.audience}` : undefined,
      `篇幅要求：${getLengthGuide(params)}`,
      params.extraRequirements ? `补充要求：${params.extraRequirements}` : undefined,
      formatSearchContext(searchContext),
      formatDocumentContext(documentContext),
      '',
      formatPriorityDirectives(params.customArticlePrompt, '以下内容必须在正文中明确体现。如含具体品牌/产品名，必须明确写出，不得遗漏或替换'),
      '',
      '参考策划案：',
      outline,
      '',
      formatKnowledgeContext(knowledgeContext),
      '',
      '写作要求：',
      '- 第一行输出最终标题',
      '- 开头 3 行内必须说清楚痛点/场景/收益，不要铺垫太长',
      '- 多用短句、列表、步骤、对比、避坑、清单，方便手机阅读',
      '- 语气自然可信，像真实经验分享，不要像营销号硬广',
      '- 内容里要自然体现业务相关性，但不能像硬广，优先使用建议、案例、避坑提醒、清单赠品等咨询型转化方式',
      '- 结尾给出评论区互动问题或收藏提醒，并设计一个自然的咨询/私信转化动作',
      '- 文末必须附上 8-12 个小红书话题标签，格式如：#AI工具 #自媒体运营',
      '- 不要出现"作为 AI"之类表述',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    '你是一名资深微信公众号写作编辑。',
    '请根据下面的大纲写成完整公众号文章，输出 Markdown。',
    '',
    `主题：${params.topic}`,
    params.style ? `风格：${params.style}` : undefined,
    params.audience ? `目标读者：${params.audience}` : undefined,
    `篇幅要求：${getLengthGuide(params)}`,
    params.extraRequirements ? `补充要求：${params.extraRequirements}` : undefined,
    formatSearchContext(searchContext),
    formatDocumentContext(documentContext),
    '',
    formatPriorityDirectives(params.customArticlePrompt, '以下内容必须在正文中明确体现。如含具体品牌/产品名，必须明确写出，不得遗漏或替换'),
    '',
    '参考大纲：',
    outline,
    '',
    formatKnowledgeContext(knowledgeContext),
    '',
    '写作要求：',
    '- 第一行输出最终标题',
    '- 开头要有吸引人的钩子',
    '- 使用短段落，适合公众号阅读',
    '- 小标题清晰，利于排版',
    '- 结尾给出总结或行动建议',
    '- 不要出现“作为 AI”之类表述',
    '- 保持真实、自然、可读',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildImagePromptPlanner(
  articleMarkdown: string,
  totalImagesNeeded: number,
  customPrompt?: string,
  platform: ContentPlatform = 'wechat',
): string {
  const isXhs = platform === 'xiaohongshu';
  return [
    isXhs
      ? '你是一名擅长小红书竖版封面和手机端笔记配图的视觉编辑。'
      : '你是一名擅长公众号文章插图策划的视觉编辑。',
    `请为下面的${platformLabel(platform)}内容生成 ${totalImagesNeeded} 条生图提示词。`,
    isXhs
      ? '第一条如果存在，应优先作为小红书竖版封面图；其余作为适合手机滑动浏览的竖版配图。'
      : '第一条如果存在，应优先作为公众号封面图；其余作为正文普通插图。',
    '输出必须是 JSON 数组，数组每个元素是一个对象：',
    '{"slot":"cover|inline-1|inline-2...","prompt":"详细中文生图提示词"}',
    '不要输出任何 JSON 之外的文字。',
    '',
    formatPriorityDirectives(customPrompt, '以下内容必须在配图中体现。如含具体品牌/产品名，必须在生图提示词中明确写入，不得遗漏'),
    '提示词要求：',
    isXhs
      ? '- 必须适配手机屏幕竖版比例，统一按 3:4 构图与出图，主体居中、留出安全边距，适合小红书信息流预览和点击'
      : '- 只生成适合公众号文章阅读场景的普通图片/插图/照片感画面，不要做“图文卡片”',
    '- 统一视觉风格',
    isXhs
      ? '- 封面图可以包含简短大字布局建议（不超过 8 个字），但画面必须以竖版视觉为主，避免横版海报和过密文字'
      : '- 不要包含排版文字、海报文案、大字标题、信息图表、长截图、图文混排版式',
    isXhs
      ? '- 其余配图也要保持竖版手机比例，适合用户上下滑动查看，避免横版宽图'
      : '- 画面要具体、干净、克制，作为文章中的配图即可，不要像小红书封面或营销海报',
    '- 画面具体，适合通用文生图模型',
    '',
    '内容：',
    articleMarkdown.slice(0, 7000),
  ].filter(Boolean).join('\n');
}

export function buildXhsTopicRefinementPrompt(
  keyword: string,
  notes: XhsNote[],
  options?: {
    resultLabel?: string;
    extraContext?: string;
    candidateCount?: number;
  },
): string {
  const resultLabel = options?.resultLabel || '搜索结果';
  const candidateCount = options?.candidateCount ?? 5;
  const noteLines = notes.slice(0, 10).map((item, index) => {
    const parts = [
      `标题：${item.title || '无标题'}`,
      item.desc ? `描述：${item.desc}` : undefined,
      item.author ? `作者：${item.author}` : undefined,
      item.likes !== undefined ? `点赞/互动：${item.likes}` : undefined,
    ].filter(Boolean).join('；');
    return `${index + 1}. ${parts}`;
  }).join('\n');

  return [
    `你是一名小红书选题策划。请把“小红书${resultLabel}”加工成“可以直接用于生成内容的选题”。`,
    '不要只是复述搜索词；要提炼用户痛点、场景、业务方向、标题钩子和话题标签。',
    '',
    `用户搜索词：${keyword}`,
    options?.extraContext ? `补充上下文：\n${options.extraContext}` : undefined,
    '',
    `${resultLabel}：`,
    noteLines || '暂无搜索结果，请基于搜索词自行发散。',
    '',
    `请输出 ${candidateCount} 个候选选题，每个候选使用下面格式：`,
    '## 选题 N：一句可直接复制到生成器的主题',
    '- 推荐标题：',
    '- 业务映射：',
    '- 适合人群：',
    '- 内容角度：',
    '- 开头钩子：',
    '- 参考来源摘要：',
    '- 转化落点：',
    '- 正文要点：3-5 条',
    '- 小红书话题：8-12 个 #标签',
    '- 适合同步到公众号吗：适合/不适合 + 一句话原因',
    '',
    '要求：',
    '- 选题要具体，不要泛泛而谈',
    '- 兼顾小红书可搜、可收藏、可评论',
    '- 明确这个选题如何承接业务需求或咨询需求，但表达要自然',
    '- 如果适合同步到公众号，请说明公众号应如何扩写成深度文章',
    '- 语言自然，避免 AI 腔',
  ].join('\n');
}

export function buildBusinessXhsTopicPrompt(
  keyword: string,
  notes: XhsNote[],
  options?: {
    businessKeywords?: string[];
    externalHotContext?: string;
    candidateCount?: number;
  },
): string {
  const businessKeywords = options?.businessKeywords?.length ? options.businessKeywords : BUSINESS_KEYWORDS;
  const candidateCount = options?.candidateCount ?? 6;
  const directionText = businessKeywords.join('、');
  const noteLines = notes.slice(0, 10).map((item, index) => {
    const parts = [
      `标题：${item.title || '无标题'}`,
      item.desc ? `描述：${item.desc}` : undefined,
      item.author ? `作者：${item.author}` : undefined,
      item.likes !== undefined ? `点赞/互动：${item.likes}` : undefined,
    ].filter(Boolean).join('；');
    return `${index + 1}. ${parts}`;
  }).join('\n');

  return [
    '你是一名小红书内容策略师，专精于娃衣 / 穿搭 / 潮玩 / 游戏人物 / 游戏等领域的选题策划。',
    `请结合小红书热点/搜索结果，围绕以下业务方向生成 ${candidateCount} 个可直接发布的小红书选题。`,
    '',
    `辅助关键词：${keyword || '未指定'}`,
    `业务方向：${directionText}`,
    options?.externalHotContext ? `外部热点补充：\n${options.externalHotContext}` : undefined,
    '',
    '小红书参考结果：',
    noteLines || '暂无搜索结果，请基于关键词自行发散。',
    '',
    `请输出 ${candidateCount} 个候选选题，每个选题严格使用下面格式：`,
    '## 选题 N：标题',
    '- 推荐标题：',
    '- 适合人群：',
    '- 内容角度：',
    '- 开头钩子：',
    '- 正文要点：',
    '- 参考来源摘要：',
    '- 业务结合点：',
    '- 转化落点：',
    '- 小红书话题：',
    '- 适合同步到公众号吗：',
    '',
    '要求：',
    '- 目标不是生成通用标题，而是从热点/趋势出发，映射到业务领域，输出可落地、可转化的内容',
    '- 选题要有可模仿性、可转化性，适合图文形式发布',
    '- 语气像真人博主，不要像商业提案或硬广',
    '- 每个选题必须包含自然的引导咨询 / 私信 / 主页可见的转化路径',
    '- 语言自然，避免 AI 腔',
  ].join('\n');
}

export function buildXhsBusinessTopicSynthesisPrompt(input: {
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
  candidateCount?: number;
}): string {
  const candidateCount = input.candidateCount ?? 6;
  const directionText = input.businessDirections.length ? input.businessDirections.join('、') : '未指定';
  const formatNotes = (label: string, notes?: XhsNote[]) => {
    const lines = (notes ?? []).slice(0, 8).map((item, index) => {
      const parts = [
        `标题：${item.title || '无标题'}`,
        item.desc ? `描述：${item.desc}` : undefined,
        item.author ? `作者：${item.author}` : undefined,
        item.likes !== undefined ? `互动：${item.likes}` : undefined,
      ].filter(Boolean).join('；');
      return `${index + 1}. ${parts}`;
    });

    return `${label}：\n${lines.length ? lines.join('\n') : '暂无'}`;
  };

  return [
    '你是一名擅长多平台热点整合的小红书业务选题策划。',
    '目标是把微博热点、抖音热点、小红书热点、小红书搜索洞察，整合成更适合业务落地的小红书候选选题。',
    '请优先考虑小红书平台适配度、搜索收藏价值、内容真实感，以及自然的咨询转化可能性。',
    '',
    `辅助关键词：${input.keyword}`,
    `业务方向：${directionText}`,
    '',
    '微博热点上下文：',
    input.weiboContext,
    input.weiboTopicInsights ? `微博话题提炼：${input.weiboTopicInsights}` : undefined,
    '',
    '抖音热点上下文：',
    input.douyinContext,
    input.douyinTopicInsights ? `抖音话题提炼：${input.douyinTopicInsights}` : undefined,
    '',
    input.xhsHotAnalysis ? `小红书热点提炼：\n${input.xhsHotAnalysis}` : '小红书热点提炼：暂无',
    '',
    input.xhsSearchAnalysis ? `小红书搜索洞察：\n${input.xhsSearchAnalysis}` : '小红书搜索洞察：暂无',
    '',
    formatNotes('小红书热点原始结果', input.hotNotes),
    '',
    formatNotes('小红书搜索原始结果', input.searchNotes),
    '',
    `请输出 ${candidateCount} 个候选选题，每个候选严格使用下面格式：`,
    '## 选题 N：一句可直接复制到生成器的主题',
    '- 推荐标题：',
    '- 业务映射：',
    '- 适合人群：',
    '- 内容角度：',
    '- 开头钩子：',
    '- 参考来源摘要：',
    '- 转化落点：',
    '- 正文要点：3-5 条',
    '- 小红书话题：8-12 个 #标签',
    '- 适合同步到公众号吗：适合/不适合 + 一句话原因',
    '',
    '要求：',
    '- 选题必须优先适合小红书，而不是其他平台直接搬运',
    '- 业务映射要具体到产品线、服务方向、咨询场景、内容资产或社群转化',
    '- 转化落点要自然，优先使用案例咨询、私信领取资料、评论区互动、加群答疑等咨询型动作',
    '- 参考来源摘要要点明微博/抖音/小红书分别提供了什么灵感，不要编造具体数据',
    '- 语言自然，不要像商业提案，不要像投放广告',
  ].filter(Boolean).join('\n');
}

export function buildKeywordBasedTopicSynthesisPrompt(params: {
  keyword: string;
  businessDirections: string[];
  weiboKeywordContext: string;
  douyinKeywordContext: string;
  weiboTopicInsights: string;
  douyinTopicInsights: string;
  xhsHotAnalysis?: string;
  hotNotes?: XhsNote[];
}): string {
  const directionText = params.businessDirections.length ? params.businessDirections.join('、') : '未指定';
  const hotNoteLines = (params.hotNotes ?? []).slice(0, 8).map((item, index) => {
    const parts = [
      `标题：${item.title || '无标题'}`,
      item.desc ? `描述：${item.desc}` : undefined,
      item.author ? `作者：${item.author}` : undefined,
      item.likes !== undefined ? `互动：${item.likes}` : undefined,
    ].filter(Boolean).join('；');
    return `${index + 1}. ${parts}`;
  }).join('\n');

  return [
    '你是一名擅长关键词热点归纳的小红书选题策划。',
    '本次要优先使用“关键词搜索结果”而不是泛热榜，去判断真正和业务相关的内容信号。',
    '',
    `辅助关键词：${params.keyword}`,
    `业务方向：${directionText}`,
    '',
    '微博关键词搜索上下文：',
    params.weiboKeywordContext,
    '',
    `微博话题洞察：${params.weiboTopicInsights}`,
    '',
    '抖音关键词搜索上下文：',
    params.douyinKeywordContext,
    '',
    `抖音话题洞察：${params.douyinTopicInsights}`,
    '',
    params.xhsHotAnalysis ? `小红书热点补充：\n${params.xhsHotAnalysis}` : '小红书热点补充：暂无',
    '',
    `小红书热点原始参考：\n${hotNoteLines || '暂无'}`,
    '',
    '请综合这些信息时遵守以下优先级：',
    '1. 先看关键词搜索里哪些话题和表达与业务方向真实重合。',
    '2. 微博侧优先提供情绪、争议、社会化讨论角度。',
    '3. 抖音侧优先提供视觉、剧情、模板、展示方式。',
    '4. 再用小红书热点确认哪些角度更适合被写成可搜、可收藏、可转化的笔记。',
    '',
    '输出时请特别注意：',
    '- 不要把微博和抖音的热点原样搬到小红书，要改写成小红书用户愿意收藏和评论的表达。',
    '- 尽量找“微博情绪角度 + 抖音视觉角度 + 小红书转化场景”的交叉点。',
    '- 如果不同平台出现相互矛盾的信号，要优先选择更适合小红书图文承载的角度。',
  ].join('\n');
}
