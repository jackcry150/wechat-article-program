import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const zhihuPublisher = createPublisher(getPublishPlatformSpec('zhihu'));
