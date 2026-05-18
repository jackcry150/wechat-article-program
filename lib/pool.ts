import { promises as fs } from 'fs';
import path from 'path';

export interface PoolEntry {
  id: string;
  topic: string;
  platform: 'wechat' | 'xiaohongshu';
  generatedAt: string;
  rating: number | null;
  tags: string[];
  articleLength: number;
  imageCount: number;
  promptVersions: {
    outline: string;
    article: string;
  };
  searchContextUsed: boolean;
  notes: string;
  outputDir: string;
}

const poolDir = path.resolve(process.cwd(), 'pool');
const indexPath = path.join(poolDir, 'index.jsonl');
const stopWords = new Set([
  '什么',
  '为什么',
  '怎么',
  '如何',
  '真的',
  '这个',
  '那个',
  '一次',
  '看懂',
  '指南',
  '入坑',
  '新手',
  '最近',
  '今年',
  '现在',
  '最新',
  '还是',
  '不是',
  '可以',
  '我们',
  '你们',
  '大家',
  '自己',
  '一个',
  '这只',
  '这种',
  '它们',
  'and',
  'the',
]);

function splitTerms(text: string): string[] {
  return text
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTag(tag: string): string {
  return tag.replace(/^#+/, '').trim();
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }

  return result;
}

export function extractTags(topic: string): string[] {
  const candidates = splitTerms(topic);
  const filtered = candidates.filter((item) => {
    if (item.length <= 1) return false;
    if (stopWords.has(item.toLowerCase())) return false;
    return true;
  });

  const tags = uniqueTags(filtered);
  if (tags.length >= 3) {
    return tags.slice(0, 8);
  }

  const fallback = topic
    .split(/[，。、“”"'':：！？!?,.\-—（）()《》【】\/\s]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !stopWords.has(item.toLowerCase()));

  return uniqueTags([...tags, ...fallback]).slice(0, 8);
}

export async function readPoolIndex(): Promise<PoolEntry[]> {
  try {
    const content = await fs.readFile(indexPath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PoolEntry);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function appendPoolEntry(entry: PoolEntry): Promise<void> {
  await fs.mkdir(poolDir, { recursive: true });
  await fs.appendFile(indexPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function searchPool(query: string): Promise<PoolEntry[]> {
  const entries = await readPoolIndex();
  const terms = uniqueTags([query, ...extractTags(query)]).map((item) => item.toLowerCase());

  return entries.filter((entry) => {
    const haystack = `${entry.topic}\n${entry.tags.join(' ')}\n${entry.notes}`.toLowerCase();
    return terms.some((term) => term && haystack.includes(term));
  });
}
