import { OutputSummary, PublishPlatform, PublishPlatformRecord } from '../../types';

export interface PublishPayloadArtifact {
  fileName: string;
  data: Record<string, unknown> | string;
}

export interface PreparedPublishPayload {
  title: string;
  summary: string;
  artifacts: PublishPayloadArtifact[];
}

export interface PublisherContext {
  output: OutputSummary;
}

export interface Publisher {
  platform: PublishPlatform;
  displayName: string;
  prepare(context: PublisherContext): Promise<PreparedPublishPayload>;
}

export interface FinalizedPublishRecord extends PublishPlatformRecord {
  displayName: string;
}
