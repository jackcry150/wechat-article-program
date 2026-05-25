import { generateStructuredText } from '../deerapi';
import { markdownToHtml } from '../files';
import { getPlatformIntelligence } from './intelligence';
import { PublishPlatformSpec } from './specs';
import { extractTitleAndBody, summarizeArticle } from './base';

interface AdaptPlatformContentInput {
  sourceTitle: string;
  sourceMarkdown: string;
  platformSpec: PublishPlatformSpec;
}

export interface AdaptedPlatformContent {
  title: string;
  summary: string;
  bodyMarkdown: string;
  bodyHtml: string;
  tags: string[];
  prompt: string;
  adaptationMode: 'ai' | 'fallback';
}

interface PlatformRewriteJson {
  title?: string;
  summary?: string;
  bodyMarkdown?: string;
  tags?: string[];
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampTitle(title: string, limit?: number): string {
  if (!limit || title.length <= limit) {
    return title;
  }
  return title.slice(0, limit).trim();
}

function repairLooseJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value) => {
      const escaped = String(value).replace(/"/g, '\\"');
      return `: "${escaped}"`;
    })
    .replace(/,\s*([}\]])/g, '$1');
}

function parseJsonObject<T>(raw: string): T {
  const cleaned = repairLooseJson(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('平台改写结果缺少 JSON 对象');
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

function buildFallbackContent(input: AdaptPlatformContentInput): AdaptedPlatformContent {
  const { sourceTitle, sourceMarkdown, platformSpec } = input;
  const { bodyMarkdown } = extractTitleAndBody(sourceMarkdown, sourceTitle);
  const summary = summarizeArticle(sourceMarkdown);

  return {
    title: clampTitle(sourceTitle, platformSpec.titleLimit),
    summary,
    bodyMarkdown,
    bodyHtml: markdownToHtml(bodyMarkdown),
    tags: platformSpec.tags,
    prompt: '',
    adaptationMode: 'fallback',
  };
}

function buildPlatformRewritePrompt(input: AdaptPlatformContentInput): string {
  const { sourceTitle, sourceMarkdown, platformSpec } = input;
  const intelligence = getPlatformIntelligence(platformSpec.platform);
  const overview = intelligence.overview.slice(0, 6).map((item) => `- ${item}`);
  const styleSamples = intelligence.styleSamples
    .slice(0, 3)
    .map(
      (sample, index) =>
        [
          `${index + 1}. [${sample.contentType}] ${sample.title}`,
          `   标题特征：${sample.titleFeatures}`,
          `   开头摘录：${sample.openingExcerpt.slice(0, 220)}`,
          `   开头总结：${sample.openingSummary}`,
          `   中段总结：${sample.middleSummary}`,
          `   结尾总结：${sample.endingSummary}`,
          `   值得学习：${sample.bestToLearn.join('；') || '无'}`,
          `   风格标签：${sample.tags.join('、') || '无'}`,
        ].join('\n'),
    );
  const policyRules = intelligence.policyRules
    .slice(0, 2)
    .map(
      (rule, index) =>
        `${index + 1}. ${rule.title}\n   规则摘要：${rule.summary}\n   写作提醒：${rule.note}`,
    );

  return [
    `你是一名熟悉${platformSpec.displayName}内容风格的资深编辑。`,
    `请把下面这篇母稿改写成适合 ${platformSpec.displayName} 发布的版本。`,
    '',
    '改写目标：',
    `- 平台：${platformSpec.displayName}`,
    `- 风格：${platformSpec.tone}`,
    ...(platformSpec.titleLimit ? [`- 标题限制：尽量不超过 ${platformSpec.titleLimit} 个字符`] : []),
    ...platformSpec.structureGuidance.map((item) => `- ${item}`),
    ...platformSpec.rewritePriorities.map((item) => `- 优先级：${item}`),
    '',
    '平台整体观察：',
    ...(overview.length ? overview : ['- 当前平台暂未录入整体风格总结。']),
    '',
    '平台样本参考：',
    ...(styleSamples.length ? styleSamples : ['- 当前平台暂未录入真实样本，按平台通用规范改写。']),
    '',
    '平台规则提醒：',
    ...(policyRules.length ? policyRules : ['- 当前平台暂未录入规则页摘要，但仍需避免违规导流、失实和低质标题。']),
    '',
    '硬性要求：',
    '- 保留原文事实、核心观点、结构主线，不要编造新事实。',
    '- 去掉明显不适合目标平台的语气和格式。',
    '- bodyMarkdown 不要包含一级标题，正文从导语或二级标题开始。',
    '- 不要照抄样本标题和句子，只学习它们的组织方式、语气和段落节奏。',
    '- 如果平台样本呈现“资讯 / 观点 / 经验复盘”差异，请选择最贴近母稿主题的一种写法。',
    '- 输出必须是 JSON 对象，不要输出解释。',
    '- JSON 键名固定为 "title"、"summary"、"bodyMarkdown"、"tags"。',
    '- tags 是字符串数组，控制在 3 到 6 个。',
    '',
    'JSON 示例：',
    '{"title":"标题","summary":"摘要","bodyMarkdown":"正文 Markdown","tags":["标签1","标签2"]}',
    '',
    `母稿标题：${sourceTitle}`,
    '',
    '母稿正文：',
    sourceMarkdown.slice(0, 14000),
  ].join('\n');
}

export async function adaptPlatformContent(input: AdaptPlatformContentInput): Promise<AdaptedPlatformContent> {
  const prompt = buildPlatformRewritePrompt(input);

  try {
    const raw = await generateStructuredText(
      prompt,
      `你负责把母稿改写成适合 ${input.platformSpec.displayName} 发布的版本，只输出合法 JSON。`,
    );
    const parsed = parseJsonObject<PlatformRewriteJson>(raw);
    const title = clampTitle(trimText(parsed.title) || input.sourceTitle, input.platformSpec.titleLimit);
    const bodyMarkdown = trimText(parsed.bodyMarkdown) || extractTitleAndBody(input.sourceMarkdown, input.sourceTitle).bodyMarkdown;
    const summary = trimText(parsed.summary) || summarizeArticle(bodyMarkdown || input.sourceMarkdown);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((item) => trimText(item)).filter(Boolean).slice(0, 6)
      : [];

    return {
      title,
      summary,
      bodyMarkdown,
      bodyHtml: markdownToHtml(bodyMarkdown),
      tags: tags.length ? tags : input.platformSpec.tags,
      prompt,
      adaptationMode: 'ai',
    };
  } catch {
    const fallback = buildFallbackContent(input);
    return {
      ...fallback,
      prompt,
    };
  }
}
