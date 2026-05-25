import { PublishPlatform } from '../../types';
import { Publisher } from './types';
import { csdnPublisher } from './csdn';
import { zhihuPublisher } from './zhihu';
import { jianshuPublisher } from './jianshu';
import { toutiaoPublisher } from './toutiao';
import { baijiahaoPublisher } from './baijiahao';
import { neteasePublisher } from './netease';
import { sohuPublisher } from './sohu';
import { qiehaoPublisher } from './qiehao';

const publishers: Record<PublishPlatform, Publisher> = {
  csdn: csdnPublisher,
  zhihu: zhihuPublisher,
  jianshu: jianshuPublisher,
  toutiao: toutiaoPublisher,
  baijiahao: baijiahaoPublisher,
  netease: neteasePublisher,
  sohu: sohuPublisher,
  qiehao: qiehaoPublisher,
};

export function getPublisher(platform: PublishPlatform): Publisher {
  return publishers[platform];
}

export function getPublisherEntries(): Publisher[] {
  return Object.values(publishers);
}
