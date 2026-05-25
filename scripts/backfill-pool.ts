import { promises as fs } from 'fs';
import path from 'path';
import { appendPoolEntry, extractTags, PoolEntry } from '../lib/pool';
import { getOutputBaseDir, getPoolBaseDir } from '../lib/files';

const outputDir = getOutputBaseDir();
const indexPath = path.join(getPoolBaseDir(), 'index.jsonl');

function buildNotes(metadata: Record<string, unknown>): string {
  const notes = [
    typeof metadata.extraRequirements === 'string' ? metadata.extraRequirements : '',
    typeof metadata.customOutlinePrompt === 'string' ? metadata.customOutlinePrompt : '',
    typeof metadata.customArticlePrompt === 'string' ? metadata.customArticlePrompt : '',
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  return notes.join(' | ');
}

function deriveGeneratedAt(id: string): string {
  const match = id.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (!match) {
    return new Date().toISOString();
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`).toISOString();
}

async function main(): Promise<void> {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, '', 'utf8');

  const dirents = await fs.readdir(outputDir, { withFileTypes: true });
  const directories = dirents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();

  let count = 0;

  for (const id of directories) {
    const currentDir = path.join(outputDir, id);
    const metadataPath = path.join(currentDir, 'metadata.json');
    const articlePath = path.join(currentDir, 'article.md');

    try {
      await fs.access(metadataPath);
      await fs.access(articlePath);
    } catch {
      console.warn(`跳过 ${id}：缺少 metadata.json 或 article.md`);
      continue;
    }

    try {
      const [metadataRaw, article] = await Promise.all([
        fs.readFile(metadataPath, 'utf8'),
        fs.readFile(articlePath, 'utf8'),
      ]);
      const metadata = JSON.parse(metadataRaw) as Record<string, unknown>;
      const topic = typeof metadata.topic === 'string' ? metadata.topic : id;
      const noteText = buildNotes(metadata);
      const tags = [...extractTags(topic), ...extractTags(noteText)].slice(0, 8);
      const images = Array.isArray(metadata.images) ? metadata.images : [];

      const entry: PoolEntry = {
        id,
        topic,
        platform: metadata.platform === 'xiaohongshu' ? 'xiaohongshu' : 'wechat',
        generatedAt: typeof metadata.generatedAt === 'string' ? metadata.generatedAt : deriveGeneratedAt(id),
        rating: null,
        tags,
        articleLength: article.length,
        imageCount: images.length,
        promptVersions: {
          outline: 'v1',
          article: 'v1',
        },
        searchContextUsed: Boolean((metadata.searchUsed as { triggered?: boolean } | undefined)?.triggered),
        notes: noteText,
        outputDir: currentDir,
      };

      await appendPoolEntry(entry);
      count += 1;
    } catch (error) {
      console.warn(`跳过 ${id}：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  console.log(`pool 回填完成，共写入 ${count} 条记录`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
