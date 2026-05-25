import { GenerateRequest } from '../types';

export function buildTitleFromMaterialsPrompt(
  request: GenerateRequest,
  materials: string,
): string {
  const platformLabel = request.platform === 'xiaohongshu' ? '小红书' : '微信公众号';
  return [
    `你是一名资深${platformLabel}选题策划编辑。`,
    '请基于下面提供的素材文档，先生成标题候选，再选出一个最适合扩写成正式内容的推荐标题。',
    request.topic ? `用户给出的主题方向：${request.topic}` : '用户未提供明确主题，请完全根据素材提炼标题方向。',
    request.style ? `希望风格：${request.style}` : undefined,
    request.audience ? `目标人群：${request.audience}` : undefined,
    request.extraRequirements ? `补充要求：${request.extraRequirements}` : undefined,
    '',
    '请严格输出以下结构：',
    '1. 标题候选：列出 5 个标题',
    '2. 推荐标题：单独一行写出最终推荐标题',
    '3. 推荐理由：说明为什么这个标题最适合扩写成正式内容',
    '4. 写作角度：用 3-5 条说明正文应该怎么展开',
    '',
    '标题要求：',
    '- 标题要具体，有信息密度，不要空泛',
    '- 优先选择既能承接素材数据、又适合扩写成实用内容的标题',
    '- 如果素材里有热点数据、案例、趋势判断，请自然融入标题逻辑',
    '- 不要出现“根据文档整理”之类描述',
    '',
    '素材文档：',
    materials,
  ]
    .filter(Boolean)
    .join('\n');
}

export function extractRecommendedTitle(raw: string): string | undefined {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const exactLine = lines.find((line) => /^推荐标题[:：]/.test(line));
  if (exactLine) {
    return exactLine.replace(/^推荐标题[:：]\s*/, '').replace(/^[-*]\s*/, '').trim() || undefined;
  }

  const nearbyIndex = lines.findIndex((line) => /^推荐标题/.test(line));
  if (nearbyIndex >= 0) {
    for (let i = nearbyIndex + 1; i < Math.min(lines.length, nearbyIndex + 4); i += 1) {
      const candidate = lines[i].replace(/^[-*\d.\s、()]+/, '').trim();
      if (candidate) return candidate;
    }
  }

  const numbered = lines.find((line) => /^\d+[.)、]\s+/.test(line));
  if (numbered) {
    return numbered.replace(/^\d+[.)、]\s+/, '').trim() || undefined;
  }

  return lines[0];
}

export function extractTitleCandidates(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates: string[] = [];
  let inCandidateSection = false;

  for (const line of lines) {
    if (/^标题候选[:：]?$/.test(line) || /^1[.)、]?\s*标题候选[:：]?$/.test(line)) {
      inCandidateSection = true;
      continue;
    }

    if (inCandidateSection && /^(推荐标题|2[.)、]\s*推荐标题)/.test(line)) {
      break;
    }

    if (!inCandidateSection) {
      if (/^[-*]\s+/.test(line) || /^\d+[.)、]\s+/.test(line)) {
        const candidate = line.replace(/^[-*\d.)、\s]+/, '').trim();
        if (candidate) candidates.push(candidate);
      }
      continue;
    }

    const candidate = line.replace(/^[-*\d.)、\s]+/, '').trim();
    if (candidate) candidates.push(candidate);
  }

  return Array.from(new Set(candidates)).slice(0, 5);
}
