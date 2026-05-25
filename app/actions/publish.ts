'use server';

import { PublishPlatform, PublishPlatformRecord, PublishResult } from '../../types';
import { listOutputSummaries, readOutputSummary } from '../../lib/output-library';
import { getPublisher } from '../../lib/publishers';
import { writePreparedArtifacts } from '../../lib/publishers/base';
import { writePublishLog } from '../../lib/publish-log';

const PUBLISH_CONCURRENCY = 3;

export async function listRecentOutputs(limit = 20) {
  return listOutputSummaries(limit);
}

async function preparePlatformRecord(
  output: NonNullable<Awaited<ReturnType<typeof readOutputSummary>>>,
  platform: PublishPlatform,
): Promise<PublishPlatformRecord> {
  const publisher = getPublisher(platform);

  try {
    const prepared = await publisher.prepare({ output });
    const requestPath = await writePreparedArtifacts(output.outputDir, platform, prepared);

    return {
      platform,
      status: 'prepared',
      message: `${publisher.displayName} 发布预检已完成，真实 API 尚未接入`,
      requestPath,
    };
  } catch (error) {
    return {
      platform,
      status: 'failed',
      message: error instanceof Error ? error.message : '发布预检失败',
    };
  }
}

async function preparePlatformRecords(
  output: NonNullable<Awaited<ReturnType<typeof readOutputSummary>>>,
  platforms: PublishPlatform[],
): Promise<PublishPlatformRecord[]> {
  const records: PublishPlatformRecord[] = new Array(platforms.length);
  let cursor = 0;

  async function worker() {
    while (cursor < platforms.length) {
      const currentIndex = cursor;
      cursor += 1;
      records[currentIndex] = await preparePlatformRecord(output, platforms[currentIndex]);
    }
  }

  const workerCount = Math.min(PUBLISH_CONCURRENCY, platforms.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return records;
}

export async function publishOutput(
  outputId: string,
  platforms: PublishPlatform[],
): Promise<PublishResult> {
  try {
    const output = await readOutputSummary(outputId);
    if (!output) {
      return { success: false, error: '未找到对应输出目录' };
    }

    if (!platforms.length) {
      return { success: false, error: '至少选择一个发布平台' };
    }

    const records = await preparePlatformRecords(output, platforms);

    await writePublishLog(output.publishLogPath, output.id, output.outputDir, records);

    return {
      success: true,
      outputId: output.id,
      outputPath: output.outputDir,
      publishLogPath: output.publishLogPath,
      records,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '发布预检失败',
    };
  }
}

export async function publishOutputFromFormData(
  _prevState: PublishResult | null,
  formData: FormData,
): Promise<PublishResult> {
  const outputId = String(formData.get('outputId') || '').trim();
  const allowedPlatforms: PublishPlatform[] = ['csdn', 'zhihu', 'jianshu', 'toutiao', 'baijiahao', 'netease', 'sohu', 'qiehao'];
  const platforms = formData
    .getAll('platforms')
    .map((item) => String(item))
    .filter((item): item is PublishPlatform => allowedPlatforms.includes(item as PublishPlatform));

  return publishOutput(outputId, platforms);
}
