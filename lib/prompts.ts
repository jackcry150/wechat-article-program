import { ArticleLength, GenerateRequest } from '../types';

const lengthGuide: Record<ArticleLength, string> = {
  short: '约 800-1200 字，适合快速阅读',
  medium: '约 1500-2200 字，适合常规公众号深度稿',
  long: '约 2500-3500 字，适合系统拆解型长文',
};

export function buildOutlinePrompt(params: GenerateRequest, searchContext?: string): string {
  return [
    '你是一名资深微信公众号主编。',
    '请基于下面信息先输出文章大纲，不要直接写正文。',
    `主题：${params.topic}`,
    params.style ? `风格：${params.style}` : undefined,
    params.audience ? `目标读者：${params.audience}` : undefined,
    `篇幅要求：${lengthGuide[params.length]}`,
    params.extraRequirements ? `补充要求：${params.extraRequirements}` : undefined,
    searchContext
      ? `\n以下是联网搜索到的最新参考资料，请在规划文章时适当参考，但不要直接抄录原文，保持自然：\n\n${searchContext}`
      : undefined,
    '',
    '请输出：',
    '1. 3 个可选标题',
    '2. 一个推荐标题',
    '3. 文章结构大纲（导语、3-5 个小节、结尾）',
    '4. 每个小节想表达的核心要点',
    '',
    '要求：',
    '- 适合公众号排版和阅读习惯',
    '- 语言自然，不要太 AI 腔',
    '- 段落节奏适合后续扩写',
    params.customOutlinePrompt ? `\n自定义补充提示词：\n${params.customOutlinePrompt}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildArticlePrompt(params: GenerateRequest, outline: string, searchContext?: string): string {
  return [
    '你是一名资深微信公众号写作编辑。',
    '请根据下面的大纲写成完整公众号文章，输出 Markdown。',
    '',
    `主题：${params.topic}`,
    params.style ? `风格：${params.style}` : undefined,
    params.audience ? `目标读者：${params.audience}` : undefined,
    `篇幅要求：${lengthGuide[params.length]}`,
    params.extraRequirements ? `补充要求：${params.extraRequirements}` : undefined,
    searchContext
      ? `\n以下是联网搜索到的最新参考资料，请在规划文章时适当参考，但不要直接抄录原文，保持自然：\n\n${searchContext}`
      : undefined,
    '',
    '参考大纲：',
    outline,
    '',
    '写作要求：',
    '- 第一行输出最终标题',
    '- 开头要有吸引人的钩子',
    '- 使用短段落，适合公众号阅读',
    '- 小标题清晰，利于排版',
    '- 结尾给出总结或行动建议',
    '- 不要出现“作为 AI”之类表述',
    '- 保持真实、自然、可读',
    params.customArticlePrompt ? `\n自定义补充提示词：\n${params.customArticlePrompt}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildImagePromptPlanner(articleMarkdown: string, totalImagesNeeded: number, customPrompt?: string): string {
  return [
    '你是一名擅长公众号配图策划的视觉编辑。',
    `请为下面的公众号文章生成 ${totalImagesNeeded} 条生图提示词。`,
    '第一条如果存在，应优先作为封面图；其余作为正文插图。',
    '输出必须是 JSON 数组，数组每个元素是一个对象：',
    '{"slot":"cover|inline-1|inline-2...","prompt":"详细中文生图提示词"}',
    '不要输出任何 JSON 之外的文字。',
    '',
    '提示词要求：',
    '- 适合公众号配图',
    '- 统一视觉风格',
    '- 不要包含排版文字，不要海报文案',
    '- 画面具体，适合通用文生图模型',
    customPrompt ? `\n自定义补充提示词：\n${customPrompt}` : undefined,
    '',
    '文章内容：',
    articleMarkdown.slice(0, 7000),
  ].filter(Boolean).join('\n');
}
