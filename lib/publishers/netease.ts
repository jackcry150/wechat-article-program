import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const neteasePublisher = createPublisher(getPublishPlatformSpec('netease'));
