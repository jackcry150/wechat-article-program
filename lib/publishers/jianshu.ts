import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const jianshuPublisher = createPublisher(getPublishPlatformSpec('jianshu'));
