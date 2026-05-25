import { promises as fs } from 'fs';
import { PublishLogEntry, PublishPlatformRecord } from '../types';

export async function writePublishLog(
  filePath: string,
  outputId: string,
  outputDir: string,
  records: PublishPlatformRecord[],
): Promise<PublishLogEntry> {
  const payload: PublishLogEntry = {
    publishedAt: new Date().toISOString(),
    outputId,
    outputDir,
    records,
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}
