export type ArticleLength = 'short' | 'medium' | 'long';

export interface GenerateRequest {
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
  message?: string;
  outputPath?: string;
  downloadUrl?: string;
  articleExcerpt?: string;
  outlineExcerpt?: string;
  generatedImages?: GeneratedImagePreview[];
  error?: string;
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
