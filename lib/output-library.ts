import { Dirent, promises as fs } from 'fs';
import path from 'path';
import { getOutputBaseDir } from './files';
import { OutputSummary, PublishLogEntry } from '../types';

function isSafeOutputId(value: string): boolean {
  return !!value && !value.includes('/') && !value.includes('\\') && !value.includes('..');
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function readOutputSummary(outputId: string): Promise<OutputSummary | null> {
  if (!isSafeOutputId(outputId)) {
    return null;
  }

  const outputDir = path.join(getOutputBaseDir(), outputId);
  const metadataPath = path.join(outputDir, 'metadata.json');
  const articlePath = path.join(outputDir, 'article.md');
  const articleHtmlPath = path.join(outputDir, 'article.html');
  const publishLogPath = path.join(outputDir, 'publish-log.json');

  const [metadata, publishLog] = await Promise.all([
    readJsonFile<Record<string, unknown>>(metadataPath),
    readJsonFile<PublishLogEntry>(publishLogPath),
  ]);

  if (!metadata) {
    return null;
  }

  return {
    id: outputId,
    topic: typeof metadata.topic === 'string' ? metadata.topic : outputId,
    platform: metadata.platform === 'xiaohongshu' ? 'xiaohongshu' : 'wechat',
    generatedAt: typeof metadata.generatedAt === 'string' ? metadata.generatedAt : new Date(0).toISOString(),
    outputDir,
    articlePath,
    articleHtmlPath,
    metadataPath,
    publishLogPath,
    publishLog,
  };
}

export async function listOutputSummaries(limit = 20): Promise<OutputSummary[]> {
  const baseDir = getOutputBaseDir();
  let dirents: Dirent[] = [];

  try {
    dirents = await fs.readdir(baseDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const ids = dirents
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  const summaries = await Promise.all(ids.map((id) => readOutputSummary(id)));
  return summaries.filter((item): item is OutputSummary => Boolean(item));
}

