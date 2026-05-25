import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const qiehaoPublisher = createPublisher(getPublishPlatformSpec('qiehao'));
