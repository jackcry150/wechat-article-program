import { promises as fs } from 'fs';
import path from 'path';
import { extractTags } from './pool';
import { getKnowledgeBaseDir } from './files';

const knowledgeDir = getKnowledgeBaseDir();

async function readKnowledgeFile(...parts: string[]): Promise<string> {
  const filePath = path.join(knowledgeDir, ...parts);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function findRelevantLines(content: string, keywords: string[]): string[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-') || line.startsWith('|'));

  return lines.filter((line) => keywords.some((keyword) => keyword && line.includes(keyword)));
}

export async function loadKnowledgeContext(topic: string): Promise<string> {
  const [tone, angles, vocabulary, winners, patterns] = await Promise.all([
    readKnowledgeFile('brand', 'tone.md'),
    readKnowledgeFile('brand', 'angles.md'),
    readKnowledgeFile('brand', 'vocabulary.md'),
    readKnowledgeFile('topics', 'winners.md'),
    readKnowledgeFile('topics', 'patterns.md'),
  ]);

  const keywords = extractTags(topic);
  const winnerMatches = findRelevantLines(winners, keywords);
  const patternMatches = findRelevantLines(patterns, keywords);

  const sections = [
    tone ? `## 品牌调性\n${tone.trim()}` : '',
    angles ? `## 已验证角度\n${angles.trim()}` : '',
    vocabulary ? `## 品牌词库\n${vocabulary.trim()}` : '',
    winnerMatches.length ? `## 相关历史话题\n${winnerMatches.join('\n')}` : '',
    patternMatches.length ? `## 相关模式总结\n${patternMatches.join('\n')}` : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}
