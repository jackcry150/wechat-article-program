import { promises as fs } from 'fs';
import path from 'path';
import { markdownToHtml } from '../files';
import { OutputSummary, PublishPlatform } from '../../types';
import { PreparedPublishPayload } from './types';

export async function readOutputFiles(output: OutputSummary): Promise<{
  articleMd: string;
  articleHtml: string;
  metadata: Record<string, unknown>;
}> {
  const [articleMd, articleHtml, metadataRaw] = await Promise.all([
    fs.readFile(output.articlePath, 'utf8'),
    fs.readFile(output.articleHtmlPath, 'utf8'),
    fs.readFile(output.metadataPath, 'utf8'),
  ]);

  return {
    articleMd,
    articleHtml,
    metadata: JSON.parse(metadataRaw) as Record<string, unknown>,
  };
}

export function summarizeArticle(markdown: string): string {
  const plain = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/[`>*_-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return plain.length > 140 ? `${plain.slice(0, 140)}...` : plain;
}

export function buildPublishArtifactPath(outputDir: string, platform: PublishPlatform, fileName: string): string {
  return path.join(outputDir, 'publish-artifacts', platform, fileName);
}

export async function writePreparedArtifacts(
  outputDir: string,
  platform: PublishPlatform,
  payload: PreparedPublishPayload,
): Promise<string> {
  const artifactDir = path.join(outputDir, 'publish-artifacts', platform);
  await fs.mkdir(artifactDir, { recursive: true });

  let lastPath = '';
  for (const artifact of payload.artifacts) {
    const targetPath = path.join(artifactDir, artifact.fileName);
    if (typeof artifact.data === 'string') {
      await fs.writeFile(targetPath, artifact.data, 'utf8');
    } else {
      await fs.writeFile(targetPath, JSON.stringify(artifact.data, null, 2), 'utf8');
    }
    lastPath = targetPath;
  }

  return lastPath;
}

export function ensureHtmlContent(articleHtml: string, articleMd: string): string {
  return articleHtml.trim() ? articleHtml : markdownToHtml(articleMd);
}

export function extractTitleAndBody(markdown: string, fallbackTitle: string): { title: string; bodyMarkdown: string } {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return { title: fallbackTitle, bodyMarkdown: '' };
  }

  const lines = trimmed.split(/\r?\n/);
  const firstMeaningful = lines.find((line) => line.trim());
  const rawTitle = firstMeaningful?.replace(/^#\s+/, '').trim() || fallbackTitle;

  if (!firstMeaningful) {
    return { title: rawTitle, bodyMarkdown: '' };
  }

  const firstIndex = lines.findIndex((line) => line === firstMeaningful);
  const bodyLines = [...lines];
  bodyLines.splice(firstIndex, 1);
  const bodyMarkdown = bodyLines.join('\n').trim();

  return {
    title: rawTitle,
    bodyMarkdown,
  };
}
