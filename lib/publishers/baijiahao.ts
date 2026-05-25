import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const baijiahaoPublisher = createPublisher(getPublishPlatformSpec('baijiahao'));
