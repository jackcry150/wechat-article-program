import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const toutiaoPublisher = createPublisher(getPublishPlatformSpec('toutiao'));
