import { createPublisher } from './factory';
import { getPublishPlatformSpec } from './specs';

export const sohuPublisher = createPublisher(getPublishPlatformSpec('sohu'));
