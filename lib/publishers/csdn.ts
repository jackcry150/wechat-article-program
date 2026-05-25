import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const csdnPublisher = createPublisher(getPublishPlatformSpec('csdn'));
