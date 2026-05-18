'use server';

import path from 'path';
import {
  GenerateRequest,
  GenerateResult,
  GeneratedImagePreview,
} from '../../types';
import {
  generateArticleContent,
  generateImage,
  generateImagePlan,
  GeneratedImagePayload,
} from '../../lib/deerapi';
import {
  buildImageAnnotations,
  ImageMapEntry,
  createOutputDirectory,
  markdownToHtml,
  saveImageFile,
  saveJsonFile,
  saveTextFile,
} from '../../lib/files';
import {
  buildArticlePrompt,
  buildImagePromptPlanner,
  buildOutlinePrompt,
} from '../../lib/prompts';
import {
  appendPoolEntry,
  extractTags,
  PoolEntry,
  searchPool,
} from '../../lib/pool';
import { loadKnowledgeContext } from '../../lib/knowledge';
import {
  formatSearchResultsForPrompt,
  searchTavily,
} from '../../lib/tavily';

const SEARCH_TRIGGER_KEYWORDS = [
  '今年',
  '今年度',
  '2026',
  '近期',
  '近来',
  '最近',
  '当下',
  '目前',
  '现在',
  '趋势',
  '风向',
  '走向',
  '方向',
  '排行',
  '榜单',
  'TOP',
  '热门',
  '热点',
  '最新',
  '新出',
  '新品',
  '上新',
  '刚出',
  '流行',
  '爆款',
  '爆火',
  '火了',
  '大火',
];

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shouldTriggerSearch(request: GenerateRequest): boolean {
  const text = `${request.topic} ${request.extraRequirements || ''}`;
  const normalized = text.toLowerCase();
  return SEARCH_TRIGGER_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function guessExtension(payload: GeneratedImagePayload, responseMimeType?: string): string {
  const mime = responseMimeType || payload.mimeType || '';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('png')) return 'png';

  if (payload.kind === 'url') {
    const lower = payload.value.toLowerCase();
    if (lower.includes('.webp')) return 'webp';
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'jpg';
    if (lower.includes('.gif')) return 'gif';
    if (lower.includes('.png')) return 'png';
  }

  return 'png';
}

async function materializeImage(payload: GeneratedImagePayload): Promise<{ bytes: Buffer; dataUrl: string; extension: string }> {
  if (payload.kind === 'base64') {
    const extension = guessExtension(payload);
    const mimeType = payload.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return {
      bytes: Buffer.from(payload.value, 'base64'),
      dataUrl: `data:${mimeType};base64,${payload.value}`,
      extension,
    };
  }

  const response = await fetch(payload.value);
  if (!response.ok) {
    throw new Error(`下载图片失败：HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || undefined;
  const extension = guessExtension(payload, mimeType);
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    bytes: Buffer.from(arrayBuffer),
    dataUrl: `data:${mimeType || `image/${extension}`};base64,${base64}`,
    extension,
  };
}

function formatSimilarPoolContext(entries: PoolEntry[]): string | undefined {
  if (!entries.length) return undefined;

  const lines = entries.slice(0, 5).map((entry) => [
    `- 主题：${entry.topic}`,
    `  标签：${entry.tags.join('、') || '暂无'}`,
    `  评分：${entry.rating ?? '未评分'}`,
    `  备注：${entry.notes || '暂无'}`,
  ].join('\n'));

  return `## 相似历史结果\n${lines.join('\n')}`;
}

export async function generateArticle(request: GenerateRequest): Promise<GenerateResult> {
  try {
    const outputDir = await createOutputDirectory(request.topic);
    const platform = request.platform || 'wechat';
    const searchTriggered = shouldTriggerSearch(request);
    let searchContext: string | undefined;
    let searchUsed: GenerateResult['searchUsed'] = {
      triggered: searchTriggered,
    };

    if (searchTriggered) {
      try {
        const searchResponse = await searchTavily(request.topic, {
          topic: 'news',
          maxResults: 5,
        });
        searchContext = formatSearchResultsForPrompt(searchResponse);
        await saveTextFile(outputDir, 'prompts/search_context.txt', searchContext);
        searchUsed = {
          triggered: true,
          query: searchResponse.query,
          resultCount: searchResponse.results.length,
        };
      } catch (error) {
        console.warn('Tavily 搜索失败，已降级为普通生成流程：', error);
      }
    }

    const [knowledgeContext, similarResults] = await Promise.all([
      loadKnowledgeContext(request.topic),
      searchPool(request.topic),
    ]);
    const promptKnowledgeContext = [
      knowledgeContext,
      formatSimilarPoolContext(similarResults),
    ]
      .filter(Boolean)
      .join('\n\n');

    const outlineRequest = {
      ...request,
      customOutlinePrompt: request.customOutlinePrompt || request.customArticlePrompt,
    };
    const outlinePrompt = buildOutlinePrompt(
      outlineRequest,
      searchContext,
      promptKnowledgeContext || undefined,
    );
    await saveTextFile(outputDir, 'prompts/outline_prompt.txt', outlinePrompt);
    const outline = await generateArticleContent(
      outlinePrompt,
      platform === 'xiaohongshu'
        ? '你负责小红书选题策划和笔记结构设计，要兼顾搜索、收藏、评论互动和真实分享感。'
        : '你负责先做公众号选题策划和文章结构设计。',
    );
    await saveTextFile(outputDir, 'outline.md', outline);

    const articlePrompt = buildArticlePrompt(
      request,
      outline,
      searchContext,
      promptKnowledgeContext || undefined,
    );
    await saveTextFile(outputDir, 'prompts/article_prompt.txt', articlePrompt);
    const articleMd = await generateArticleContent(
      articlePrompt,
      platform === 'xiaohongshu'
        ? '你负责撰写可以直接发布的小红书笔记，要求真实、具体、可收藏、可互动，并带合适话题标签。'
        : '你负责撰写完整公众号文章，要求自然、可信、适合发布。',
    );
    await saveTextFile(outputDir, 'article.md', articleMd);

    let articleMdFinal = articleMd;
    let articleHtml = markdownToHtml(articleMdFinal);
    await saveTextFile(outputDir, 'article.html', articleHtml);

    const totalImagesNeeded = Math.max(
      0,
      Math.min(5, request.imageCount + (request.includeCover ? 1 : 0)),
    );
    const imagePreviews: GeneratedImagePreview[] = [];
    let plannerPrompt: string | undefined;

    if (totalImagesNeeded > 0) {
      plannerPrompt = buildImagePromptPlanner(articleMd, totalImagesNeeded, request.customImagePlannerPrompt, platform);
      await saveTextFile(outputDir, 'prompts/image_planner_prompt.txt', plannerPrompt);
      const plans = await generateImagePlan(articleMd, totalImagesNeeded, plannerPrompt);
      await saveJsonFile(outputDir, 'prompts/image_plan.json', plans);

      const promises = plans.map(async (plan, index) => {
        const isCover = request.includeCover && index === 0;
        const fileName = isCover ? 'cover.png' : `image_${request.includeCover ? index : index + 1}.png`;
        await saveTextFile(outputDir, `prompts/image_prompt_${index + 1}.txt`, plan.prompt);

        try {
          const generated = await generateImage(plan.prompt);
          const materialized = await materializeImage(generated);
          const resolvedFileName = fileName.replace(/\.png$/i, `.${materialized.extension}`);
          const relativePath = await saveImageFile(outputDir, resolvedFileName, materialized.bytes);
          return {
            prompt: plan.prompt,
            fileName: resolvedFileName,
            relativePath,
          };
        } catch (error) {
          return {
            prompt: plan.prompt,
            fileName,
            error: error instanceof Error ? error.message : '图片生成失败',
          };
        }
      });

      const results = await Promise.all(promises);
      imagePreviews.push(...results);

      // Inject image placement markers and build image-map.md
      const entries: ImageMapEntry[] = plans.map((plan, i) => ({
        slot: plan.slot,
        fileName: imagePreviews[i]?.fileName,
        prompt: plan.prompt,
        error: imagePreviews[i]?.error,
      }));
      const { annotatedMd, imageMapMd } = buildImageAnnotations(articleMd, entries);
      articleMdFinal = annotatedMd;
      articleHtml = markdownToHtml(articleMdFinal);
      await saveTextFile(outputDir, 'article.md', articleMdFinal);
      await saveTextFile(outputDir, 'article.html', articleHtml);
      await saveTextFile(outputDir, 'image-map.md', imageMapMd);
    }

    const metadata = {
      platform,
      topic: request.topic,
      style: request.style || null,
      audience: request.audience || null,
      length: request.length,
      imageCount: request.imageCount,
      includeCover: request.includeCover,
      extraRequirements: request.extraRequirements || null,
      customOutlinePrompt: request.customOutlinePrompt || null,
      customArticlePrompt: request.customArticlePrompt || null,
      customImagePlannerPrompt: request.customImagePlannerPrompt || null,
      generatedAt: new Date().toISOString(),
      outputDir,
      searchUsed,
      images: imagePreviews.map((item) => ({
        fileName: item.fileName,
        relativePath: item.relativePath,
        prompt: item.prompt,
        error: item.error || null,
      })),
    };
    await saveJsonFile(outputDir, 'metadata.json', metadata);

    const poolEntry: PoolEntry = {
      id: path.basename(outputDir),
      topic: request.topic,
      platform,
      generatedAt: metadata.generatedAt,
      rating: null,
      tags: [...extractTags(request.topic), ...extractTags(request.extraRequirements || '')].slice(0, 8),
      articleLength: articleMdFinal.length,
      imageCount: imagePreviews.filter((item) => item.relativePath).length,
      promptVersions: {
        outline: 'v1',
        article: 'v1',
      },
      searchContextUsed: Boolean(searchContext),
      notes: [
        request.extraRequirements,
        request.customOutlinePrompt,
        request.customArticlePrompt,
      ]
        .filter(Boolean)
        .join(' | '),
      outputDir,
    };
    await appendPoolEntry(poolEntry);

    return {
      success: true,
      message: '生成完成',
      outputPath: outputDir,
      downloadUrl: `/api/download?dir=${encodeURIComponent(path.basename(outputDir))}`,
      articleExcerpt: articleMdFinal.length > 500 ? articleMdFinal.slice(0, 500) + '...\n\n（正文已截断，请前往本地目录查看完整文件）' : articleMdFinal,
      outlineExcerpt: outline.length > 300 ? outline.slice(0, 300) + '...\n\n（大纲已截断）' : outline,
      generatedImages: imagePreviews.map(img => ({
        ...img,
        prompt: img.prompt.length > 100 ? img.prompt.slice(0, 100) + '...' : img.prompt
      })),
      searchUsed,
      usedPrompts: {
        outlinePrompt: outlinePrompt.length > 150 ? outlinePrompt.slice(0, 150) + '...' : outlinePrompt,
        articlePrompt: articlePrompt.length > 150 ? articlePrompt.slice(0, 150) + '...' : articlePrompt,
        imagePlannerPrompt: plannerPrompt ? (plannerPrompt.length > 150 ? plannerPrompt.slice(0, 150) + '...' : plannerPrompt) : undefined,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成失败',
    };
  }
}

export async function generateArticleFromFormData(
  _prevState: GenerateResult | null,
  formData: FormData,
): Promise<GenerateResult> {
  return generateArticle({
    platform: (String(formData.get('platform') || 'wechat') as GenerateRequest['platform']) || 'wechat',
    topic: String(formData.get('topic') || '').trim(),
    style: String(formData.get('style') || '').trim() || undefined,
    audience: String(formData.get('audience') || '').trim() || undefined,
    length: (String(formData.get('length') || 'medium') as GenerateRequest['length']) || 'medium',
    imageCount: Math.max(0, Math.min(5, toInt(String(formData.get('imageCount') || '3'), 3))),
    includeCover: formData.get('includeCover') === 'on',
    extraRequirements: String(formData.get('extraRequirements') || '').trim() || undefined,
    customOutlinePrompt: String(formData.get('customOutlinePrompt') || '').trim() || undefined,
    customArticlePrompt: String(formData.get('customArticlePrompt') || '').trim() || undefined,
    customImagePlannerPrompt: String(formData.get('customImagePlannerPrompt') || '').trim() || undefined,
  });
}
