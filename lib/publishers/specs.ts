import { PublishPlatform } from '../../types';

export type PlatformBodyFormat = 'markdown' | 'html';

export interface PublishPlatformSpec {
  platform: PublishPlatform;
  displayName: string;
  bodyFormat: PlatformBodyFormat;
  titleLimit?: number;
  tone: string;
  structureGuidance: string[];
  rewritePriorities: string[];
  tags: string[];
  reviewNotes: string[];
}

export const PUBLISH_PLATFORM_SPECS: Record<PublishPlatform, PublishPlatformSpec> = {
  csdn: {
    platform: 'csdn',
    displayName: 'CSDN',
    bodyFormat: 'markdown',
    tone: '技术博客风，强调步骤、案例、结论和可执行性，减少空泛抒情。',
    structureGuidance: [
      '标题直接，不要营销号语气。',
      '开头快速说明问题背景和收益。',
      '正文使用清晰二级/三级标题，适合 Markdown 阅读。',
      '适当补充要点列表、注意事项和总结。',
    ],
    rewritePriorities: [
      '优先把信息讲清楚，再追求情绪和包装。',
      '保留知识密度、步骤感和解释性，不要写成泛资讯稿。',
    ],
    tags: ['技术博客', 'AI生成', '待发布'],
    reviewNotes: ['优先检查代码块、列表、引用格式是否符合 CSDN 编辑器习惯。'],
  },
  zhihu: {
    platform: 'zhihu',
    displayName: '知乎',
    bodyFormat: 'markdown',
    tone: '回答型和观点型风格，强调逻辑链、判断依据、反例与边界条件。',
    structureGuidance: [
      '标题尽量像用户会搜索的问题或判断句。',
      '开头先给结论，再展开论证。',
      '正文要有观点依据、案例或经验支撑。',
      '避免公众号口播感和过度煽动标题。',
    ],
    rewritePriorities: [
      '优先像回答问题，而不是像喊口号。',
      '把核心判断放前面，再用事实和推理支撑。',
    ],
    tags: ['知乎', '观点回答', '待发布'],
    reviewNotes: ['发布前检查是否需要改成问答式标题。'],
  },
  jianshu: {
    platform: 'jianshu',
    displayName: '简书',
    bodyFormat: 'markdown',
    tone: '轻专栏风格，兼顾阅读感与信息密度，语气自然克制。',
    structureGuidance: [
      '标题避免过硬的营销词。',
      '段落要顺畅，适合连续阅读。',
      '保留故事感或观察感，但不要空泛。',
      '结尾最好有一句总结性收束。',
    ],
    rewritePriorities: [
      '读感优先，不要写成平台公告或标准资讯模板。',
      '允许保留一定情绪和叙述感，但避免鸡汤堆砌。',
    ],
    tags: ['简书', '内容创作', '待发布'],
    reviewNotes: ['发布前检查是否需要更文学化或更专栏化的标题。'],
  },
  toutiao: {
    platform: 'toutiao',
    displayName: '头条号',
    bodyFormat: 'html',
    titleLimit: 30,
    tone: '资讯解读和经验分享风格，开头要快，段落短，强调可读性。',
    structureGuidance: [
      '标题控制在平台常见长度内，避免太长。',
      '导语 2 到 3 段内说清主题和看点。',
      '正文分段短，适合信息流阅读。',
      '避免明显公众号导流语气。',
    ],
    rewritePriorities: [
      '先把冲突、结果或看点打到最前面。',
      '用短段落和快节奏推进，减少解释性赘述。',
    ],
    tags: ['头条号', '图文', '待发布'],
    reviewNotes: ['需补封面图策略与图片上传链路。'],
  },
  baijiahao: {
    platform: 'baijiahao',
    displayName: '百家号',
    bodyFormat: 'html',
    titleLimit: 30,
    tone: '泛资讯平台风格，强调导语、分节和稳健表达，避免夸张承诺。',
    structureGuidance: [
      '标题要稳健、清晰，避免口语化标题党。',
      '首段先概括主题价值。',
      '正文信息分块清楚，尽量便于审阅。',
      '避免带强烈外链导流倾向的话术。',
    ],
    rewritePriorities: [
      '稳健表达优先，避免太像自媒体喊话。',
      '可读性和可信度要比戏剧化更重要。',
    ],
    tags: ['百家号', '图文', '待发布'],
    reviewNotes: ['需补百度图片上传和平台专属内容清洗。'],
  },
  netease: {
    platform: 'netease',
    displayName: '网易号',
    bodyFormat: 'html',
    titleLimit: 30,
    tone: '媒体专栏和泛资讯混合风格，强调清楚、节奏快、观点稳。',
    structureGuidance: [
      '标题保持简洁、明确。',
      '开头迅速进入主题，不做长铺垫。',
      '正文适合富文本后台粘贴。',
      '结尾可加一句总结，不要过重营销动作。',
    ],
    rewritePriorities: [
      '用媒体专栏的清楚感，不要堆叠自嗨表达。',
      '优先让结构利于快速浏览和转载式消费。',
    ],
    tags: ['网易号', '图文', '待发布'],
    reviewNotes: ['需人工检查段落与图片位是否符合网易号后台。'],
  },
  sohu: {
    platform: 'sohu',
    displayName: '搜狐号',
    bodyFormat: 'html',
    titleLimit: 30,
    tone: '自媒体资讯稿风格，强调导语、信息点和层次清楚。',
    structureGuidance: [
      '标题尽量直接，避免双关和过度修饰。',
      '正文小节明确，便于后台编辑。',
      '语言要像成熟自媒体编辑，不像公众号软文。',
      '减少明显私域转化语句。',
    ],
    rewritePriorities: [
      '优先写成媒体化资讯稿，再考虑个性表达。',
      '让导语直接交代事件，少做空转铺垫。',
    ],
    tags: ['搜狐号', '图文', '待发布'],
    reviewNotes: ['需人工检查是否存在平台敏感导流词。'],
  },
  qiehao: {
    platform: 'qiehao',
    displayName: '企鹅号',
    bodyFormat: 'html',
    titleLimit: 30,
    tone: '泛资讯和经验类图文风格，强调清楚、简洁和平台兼容性。',
    structureGuidance: [
      '标题短而明确。',
      '正文分段短，避免公众号长段落。',
      '逻辑清楚，适合后台富文本粘贴。',
      '避免明显站外导流话术。',
    ],
    rewritePriorities: [
      '优先做成清楚、稳定、易过审的资讯或经验稿。',
      '兼顾现场感和信息密度，避免拖沓。',
    ],
    tags: ['企鹅号', '图文', '待发布'],
    reviewNotes: ['待补签名鉴权、重试和图片上传能力。'],
  },
};

export function getPublishPlatformSpec(platform: PublishPlatform): PublishPlatformSpec {
  return PUBLISH_PLATFORM_SPECS[platform];
}
