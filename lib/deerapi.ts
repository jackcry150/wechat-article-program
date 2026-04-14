type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

type ImagePlan = {
  slot: string;
  prompt: string;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
};

export type GeneratedImagePayload = {
  kind: 'base64' | 'url';
  value: string;
  mimeType?: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 未配置，请先填写 .env`);
  }
  return value;
}

function getBaseUrl(): string {
  return (process.env.DEERAPI_BASE_URL?.trim() || 'https://api.deerapi.com').replace(/\/$/, '');
}

function extractFirstJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`未找到 JSON 对象：${raw.slice(0, 300)}`);
  }
  return raw.slice(start, end + 1);
}

function parsePossiblyStreamedJson<T>(raw: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('接口返回为空');
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const ssePayload = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== '[DONE]')
      .join('\n');

    if (ssePayload) {
      try {
        return JSON.parse(extractFirstJsonObject(ssePayload)) as T;
      } catch {
        return JSON.parse(ssePayload) as T;
      }
    }

    return JSON.parse(extractFirstJsonObject(trimmed)) as T;
  }
}

async function deerChat(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getRequiredEnv('DEERAPI_API_KEY')}`,
    },
    body: JSON.stringify({
      model: process.env.TEXT_MODEL?.trim() || 'gpt-4.1-mini',
      messages,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    throw new Error(`文本生成失败：HTTP ${response.status} ${await response.text()}`);
  }

  const raw = await response.text();
  const data = parsePossiblyStreamedJson<{
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  }>(raw);
  const content = data.choices?.[0]?.message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const merged = content
      .map((item) => ('text' in item ? item.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (merged) return merged;
  }

  throw new Error('文本生成返回为空');
}

export async function generateArticleContent(prompt: string, systemPrompt: string): Promise<string> {
  return deerChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]);
}

function extractJsonArray(raw: string): string {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`未找到 JSON 数组：${raw}`);
  }
  return raw.slice(start, end + 1);
}

export async function generateImagePlan(articleContent: string, count: number, plannerPrompt: string): Promise<ImagePlan[]> {
  const text = await deerChat([
    {
      role: 'system',
      content: '你只输出合法 JSON，不输出任何额外解释。',
    },
    {
      role: 'user',
      content: plannerPrompt,
    },
  ]);

  const parsed = JSON.parse(extractJsonArray(text)) as ImagePlan[];
  return parsed.slice(0, count).map((item, index) => ({
    slot: item?.slot || `inline-${index + 1}`,
    prompt: item?.prompt || '一张适合公众号文章的简洁插图，现代、干净、统一风格。',
  }));
}

export async function generateImage(prompt: string): Promise<GeneratedImagePayload> {
  const model = process.env.IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image-preview';
  const response = await fetch(`${getBaseUrl()}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getRequiredEnv('DEERAPI_API_KEY')}`,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`图片生成失败：HTTP ${response.status} ${await response.text()}`);
  }

  const raw = await response.text();
  const data = parsePossiblyStreamedJson<GeminiGenerateContentResponse>(raw);

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const inlinePart = parts.find((part) => part.inlineData?.data);
  if (inlinePart?.inlineData?.data) {
    return {
      kind: 'base64',
      value: inlinePart.inlineData.data,
      mimeType: inlinePart.inlineData.mimeType,
    };
  }

  const textParts = parts.map((part) => part.text?.trim() || '').filter(Boolean);
  const urlText = textParts.find((text) => /^https?:\/\//i.test(text));
  if (urlText) {
    return {
      kind: 'url',
      value: urlText,
    };
  }

  const markdownUrlMatch = textParts
    .join('\n')
    .match(/!?\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i) ||
    textParts.join('\n').match(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
  if (markdownUrlMatch?.[1]) {
    return {
      kind: 'url',
      value: markdownUrlMatch[1],
    };
  }

  throw new Error(`图片响应中既未找到 base64，也未找到图片 URL。原始响应：${raw.slice(0, 500)}`);
}
