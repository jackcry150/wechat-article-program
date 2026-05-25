import { Publisher } from './types';
import { adaptPlatformContent } from './adapt';
import { extractTitleAndBody, readOutputFiles } from './base';
import { getPlatformIntelligence } from './intelligence';
import { PublishPlatformSpec } from './specs';

export function createPublisher(spec: PublishPlatformSpec): Publisher {
  return {
    platform: spec.platform,
    displayName: spec.displayName,
    async prepare({ output }) {
      const { articleMd, articleHtml, metadata } = await readOutputFiles(output);
      const fallbackTitle = typeof metadata.topic === 'string' ? metadata.topic : output.topic;
      const source = extractTitleAndBody(articleMd, fallbackTitle);
      const intelligence = getPlatformIntelligence(spec.platform);
      const adapted = await adaptPlatformContent({
        sourceTitle: source.title,
        sourceMarkdown: articleMd,
        platformSpec: spec,
      });

      const requestData: Record<string, unknown> = {
        platform: spec.platform,
        title: adapted.title,
        summary: adapted.summary,
        tags: adapted.tags,
        adaptationMode: adapted.adaptationMode,
        dryRun: true,
      };

      if (spec.bodyFormat === 'html') {
        requestData.bodyHtml = adapted.bodyHtml.trim() ? adapted.bodyHtml : articleHtml;
      } else {
        requestData.bodyMarkdown = adapted.bodyMarkdown;
      }

      return {
        title: adapted.title,
        summary:
          adapted.adaptationMode === 'ai'
            ? `${spec.displayName} 平台改写预检已完成`
            : `${spec.displayName} 平台改写失败，已回退为原稿格式化版本`,
        artifacts: [
          {
            fileName: 'adapted.md',
            data: `# ${adapted.title}\n\n${adapted.bodyMarkdown}`.trim(),
          },
          {
            fileName: 'adapted.html',
            data: adapted.bodyHtml,
          },
          {
            fileName: 'rewrite_prompt.txt',
            data: adapted.prompt,
          },
          {
            fileName: 'platform-meta.json',
            data: {
              platform: spec.platform,
              displayName: spec.displayName,
              bodyFormat: spec.bodyFormat,
              reviewNotes: spec.reviewNotes,
              adaptationMode: adapted.adaptationMode,
              analysisFile: intelligence.analysisFile,
              overview: intelligence.overview,
              styleSampleCount: intelligence.styleSamples.length,
              policyRuleCount: intelligence.policyRules.length,
              styleSamples: intelligence.styleSamples.map((sample) => ({
                title: sample.title,
                contentType: sample.contentType,
                link: sample.link,
                titleFeatures: sample.titleFeatures,
                openingSummary: sample.openingSummary,
                middleSummary: sample.middleSummary,
                endingSummary: sample.endingSummary,
                bestToLearn: sample.bestToLearn,
                tags: sample.tags,
              })),
              policyRules: intelligence.policyRules.map((rule) => ({
                title: rule.title,
                summary: rule.summary,
                note: rule.note,
                link: rule.link,
              })),
            },
          },
          {
            fileName: 'request.json',
            data: requestData,
          },
        ],
      };
    },
  };
}
