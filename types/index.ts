export type ArticleLength = 'short' | 'medium' | 'long';
export type ContentPlatform = 'wechat' | 'xiaohongshu';
export type PublishPlatform =
  | 'csdn'
  | 'zhihu'
  | 'jianshu'
  | 'toutiao'
  | 'baijiahao'
  | 'netease'
  | 'sohu'
  | 'qiehao';

export interface GenerateRequest {
  platform: ContentPlatform;
  topic: string;
  style?: string;
  audience?: string;
  length: ArticleLength;
  imageCount: number;
  includeCover: boolean;
  extraRequirements?: string;
  referenceMaterials?: string;
  referenceFilePaths?: string;
  sourceWarningsInput?: string[];
  selectedTitleLocked?: boolean;
  customOutlinePrompt?: string;
  customArticlePrompt?: string;
  customImagePlannerPrompt?: string;
}

export interface GeneratorFormValues {
  platform: ContentPlatform;
  topic: string;
  style?: string;
  audience?: string;
  length: ArticleLength;
  imageCount: number;
  includeCover: boolean;
  extraRequirements?: string;
  customOutlinePrompt?: string;
  customArticlePrompt?: string;
  customImagePlannerPrompt?: string;
}

export interface GeneratedImagePreview {
  prompt: string;
  fileName?: string;
  relativePath?: string;
  error?: string;
}

export interface GenerateResult {
  success: boolean;
  stage?: 'title-selection' | 'complete';
  message?: string;
  outputPath?: string;
  downloadUrl?: string;
  articleExcerpt?: string;
  outlineExcerpt?: string;
  generatedImages?: GeneratedImagePreview[];
  error?: string;
  resolvedTopic?: string;
  titleSuggestionsExcerpt?: string;
  titleCandidates?: string[];
  recommendedTitle?: string;
  preservedReferenceMaterials?: string;
  sourceWarnings?: string[];
  formValues?: GeneratorFormValues;
  usedPrompts?: {
    outlinePrompt?: string;
    articlePrompt?: string;
    imagePlannerPrompt?: string;
  };
  searchUsed?: {
    triggered: boolean;
    query?: string;
    resultCount?: number;
  };
}

export interface PublishPlatformRecord {
  platform: PublishPlatform;
  status: 'prepared' | 'skipped' | 'failed';
  message: string;
  requestPath?: string;
  publishedUrl?: string;
}

export interface PublishLogEntry {
  publishedAt: string;
  outputId: string;
  outputDir: string;
  records: PublishPlatformRecord[];
}

export interface OutputSummary {
  id: string;
  topic: string;
  platform: ContentPlatform;
  generatedAt: string;
  outputDir: string;
  articlePath: string;
  articleHtmlPath: string;
  metadataPath: string;
  publishLogPath: string;
  publishLog?: PublishLogEntry | null;
}

export interface PublishResult {
  success: boolean;
  outputId?: string;
  outputPath?: string;
  records?: PublishPlatformRecord[];
  publishLogPath?: string;
  error?: string;
}
