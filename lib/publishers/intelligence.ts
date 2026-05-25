import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { PublishPlatform } from '../../types';

export interface PlatformStyleSample {
  title: string;
  contentType: string;
  link: string;
  titleFeatures: string;
  openingExcerpt: string;
  openingSummary: string;
  middleExcerpt: string;
  middleSummary: string;
  endingExcerpt: string;
  endingSummary: string;
  languageStyle: string[];
  bestToLearn: string[];
  tags: string[];
}

export interface PlatformPolicyRule {
  title: string;
  summary: string;
  note: string;
  link: string;
}

export interface PlatformIntelligence {
  analysisFile: string | null;
  overview: string[];
  styleSamples: PlatformStyleSample[];
  policyRules: PlatformPolicyRule[];
}

const ANALYSIS_FILE_MAP: Partial<Record<PublishPlatform, string>> = {
  zhihu: '平台风格分析_知乎.md',
  toutiao: '平台风格分析_今日头条.md',
  baijiahao: '平台风格分析_百家号.md',
  csdn: '平台风格分析_CSDN.md',
  jianshu: '平台风格分析_简书.md',
  sohu: '平台风格分析_搜狐号.md',
  qiehao: '平台风格分析_腾讯新闻.md',
};

const PLATFORM_ANALYSIS_DIR = path.join(process.cwd(), 'knowledge', 'platform-analysis');
const PLATFORM_INTELLIGENCE_CACHE = new Map<PublishPlatform, PlatformIntelligence>();

function normalizeTextBlock(value: string): string {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeParagraph(value: string): string {
  return normalizeTextBlock(value).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanQuotedExcerpt(value: string): string {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/^>\s?/, '').trimEnd())
    .join('\n')
    .trim();
}

function extractField(block: string, label: string): string {
  const match = block.match(new RegExp(`\\*\\*${label}\\*\\*：(.+)`));
  return match ? match[1].trim() : '';
}

function extractSubsection(block: string, title: string, nextTitles: string[]): string {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nextPattern = nextTitles
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(`### ${escapedTitle}\\n\\n([\\s\\S]*?)(?=\\n### (?:${nextPattern})|$)`);
  const match = block.match(regex);
  return match ? match[1].trim() : '';
}

function parseListItems(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*] |\d+\./.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean);
}

function parseTags(value: string): string[] {
  const matches = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim()).filter(Boolean);
  if (matches.length > 0) {
    return matches;
  }
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOverview(content: string): string[] {
  const match = content.match(/^## .+平台风格总结[\s\S]*$/m);
  if (!match) {
    return [];
  }

  const lines = match[0]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('## '))
    .filter((line) => line !== '|------|------------------|');

  const tableRows = lines
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length >= 2 && parts[0] !== '维度');

  if (tableRows.length > 0) {
    return tableRows.map(([dimension, summary]) => `${dimension}：${summary}`);
  }

  return lines.filter((line) => !line.startsWith('>'));
}

function parseStyleSample(block: string): PlatformStyleSample {
  return {
    title: extractField(block, '标题'),
    contentType: extractField(block, '内容类型'),
    link: extractField(block, '链接'),
    titleFeatures: normalizeParagraph(
      extractSubsection(block, '标题特征', ['开头原文摘录', '开头特征总结', '中段原文摘录']),
    ),
    openingExcerpt: cleanQuotedExcerpt(
      extractSubsection(block, '开头原文摘录', ['开头特征总结', '中段原文摘录']),
    ),
    openingSummary: normalizeParagraph(extractSubsection(block, '开头特征总结', ['中段原文摘录'])),
    middleExcerpt: cleanQuotedExcerpt(
      extractSubsection(block, '中段原文摘录', ['中段特征总结', '结尾原文摘录']),
    ),
    middleSummary: normalizeParagraph(extractSubsection(block, '中段特征总结', ['结尾原文摘录'])),
    endingExcerpt: cleanQuotedExcerpt(
      extractSubsection(block, '结尾原文摘录', ['结尾特征总结', '语言风格判断']),
    ),
    endingSummary: normalizeParagraph(extractSubsection(block, '结尾特征总结', ['语言风格判断'])),
    languageStyle: parseListItems(extractSubsection(block, '语言风格判断', ['最值得学习'])),
    bestToLearn: parseListItems(extractSubsection(block, '最值得学习', ['风格标签'])),
    tags: parseTags(extractSubsection(block, '风格标签', [])),
  };
}

function parsePolicyRule(block: string): PlatformPolicyRule | null {
  const title = extractField(block, '标题');
  const link = extractField(block, '链接');
  const learningValue = normalizeParagraph(extractSubsection(block, '学习价值', []));

  if (!title || !link || !learningValue) {
    return null;
  }

  const [summarySentence, ...rest] = learningValue.split(/(?<=。)/);
  return {
    title,
    link,
    summary: (summarySentence || learningValue).trim(),
    note: (rest.join('') || learningValue).trim(),
  };
}

function parsePlatformAnalysis(content: string, analysisFile: string): PlatformIntelligence {
  const exampleBlocks = [...content.matchAll(/^## 例文 \d+\n([\s\S]*?)(?=^## (?:例文 \d+|规则页|.+平台风格总结)|\Z)/gm)].map(
    (match) => match[1].trim(),
  );
  const ruleBlockMatch = content.match(/^## 规则页\n([\s\S]*?)(?=^## .+平台风格总结|\Z)/m);
  const policyRule = ruleBlockMatch ? parsePolicyRule(ruleBlockMatch[1].trim()) : null;

  return {
    analysisFile,
    overview: parseOverview(content),
    styleSamples: exampleBlocks.map(parseStyleSample).filter((sample) => sample.title && sample.link),
    policyRules: policyRule ? [policyRule] : [],
  };
}

function loadPlatformIntelligence(platform: PublishPlatform): PlatformIntelligence {
  const analysisFile = ANALYSIS_FILE_MAP[platform];
  if (!analysisFile) {
    return {
      analysisFile: null,
      overview: [],
      styleSamples: [],
      policyRules: [],
    };
  }

  const filePath = path.join(PLATFORM_ANALYSIS_DIR, analysisFile);
  if (!existsSync(filePath)) {
    return {
      analysisFile,
      overview: [],
      styleSamples: [],
      policyRules: [],
    };
  }

  const content = readFileSync(filePath, 'utf8');
  return parsePlatformAnalysis(content, analysisFile);
}

export function getPlatformIntelligence(platform: PublishPlatform): PlatformIntelligence {
  const cached = PLATFORM_INTELLIGENCE_CACHE.get(platform);
  if (cached) {
    return cached;
  }

  const parsed = loadPlatformIntelligence(platform);
  PLATFORM_INTELLIGENCE_CACHE.set(platform, parsed);
  return parsed;
}
