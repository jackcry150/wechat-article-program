import { promises as fs } from 'fs';
import path from 'path';
import { readPoolIndex } from '../lib/pool';

const indexPath = path.resolve(process.cwd(), 'pool', 'index.jsonl');

async function main(): Promise<void> {
  const [, , id, ratingRaw] = process.argv;
  const rating = Number.parseInt(ratingRaw || '', 10);

  if (!id || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    console.error('用法: npx tsx scripts/rate-result.ts <id> <rating>');
    process.exit(1);
  }

  const entries = await readPoolIndex();
  const nextEntries = entries.map((entry) => (
    entry.id === id ? { ...entry, rating } : entry
  ));

  if (!nextEntries.some((entry) => entry.id === id)) {
    console.error(`未找到结果: ${id}`);
    process.exit(1);
  }

  const content = nextEntries.map((entry) => JSON.stringify(entry)).join('\n');
  await fs.writeFile(indexPath, `${content}\n`, 'utf8');
  console.log(`已更新 ${id} 的评分为 ${rating}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
