import { spawn } from 'node:child_process';

export type XhsCategory =
  | 'fashion'
  | 'food'
  | 'cosmetics'
  | 'movie'
  | 'career'
  | 'love'
  | 'home'
  | 'gaming'
  | 'travel'
  | 'fitness';

export type XhsSort = 'general' | 'popular' | 'latest';
export type XhsNoteType = 'all' | 'video' | 'image';

export type XhsResult = {
  success: boolean;
  message?: string;
  authenticated?: boolean;
  user?: Record<string, unknown>;
  items?: XhsNote[];
  raw?: unknown;
  error?: string;
  command?: string;
};

export type XhsNote = {
  id?: string;
  title?: string;
  desc?: string;
  author?: string;
  likes?: number | string;
  url?: string;
};

const XHS_CATEGORIES = new Set<XhsCategory>([
  'fashion',
  'food',
  'cosmetics',
  'movie',
  'career',
  'love',
  'home',
  'gaming',
  'travel',
  'fitness',
]);

const XHS_SORTS = new Set<XhsSort>(['general', 'popular', 'latest']);
const XHS_NOTE_TYPES = new Set<XhsNoteType>(['all', 'video', 'image']);

function getXhsCommand(): string {
  return process.env.XHS_CLI_COMMAND?.trim() || (process.platform === 'win32' ? 'xhs.cmd' : 'xhs');
}

function stringifyCommand(args: string[]): string {
  return [getXhsCommand(), ...args].join(' ');
}

function parseJsonOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error(`无法解析 xhs JSON 输出：${trimmed.slice(0, 500)}`);
  }
}

function getNestedValue(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined;

  for (const key of keys) {
    if (key in source) {
      return (source as Record<string, unknown>)[key];
    }
  }

  return undefined;
}

function normalizeNote(item: unknown): XhsNote | undefined {
  if (!item || typeof item !== 'object') return undefined;

  const record = item as Record<string, unknown>;
  const noteCard = record.note_card && typeof record.note_card === 'object'
    ? (record.note_card as Record<string, unknown>)
    : {};
  const user = noteCard.user && typeof noteCard.user === 'object'
    ? (noteCard.user as Record<string, unknown>)
    : {};
  const interactInfo = noteCard.interact_info && typeof noteCard.interact_info === 'object'
    ? (noteCard.interact_info as Record<string, unknown>)
    : {};

  const id = getNestedValue(record, ['id', 'note_id']) ?? getNestedValue(noteCard, ['note_id']);
  const title = getNestedValue(noteCard, ['display_title', 'title']) ?? getNestedValue(record, ['title']);
  const desc = getNestedValue(noteCard, ['desc']) ?? getNestedValue(record, ['desc']);
  const author = getNestedValue(user, ['nickname', 'name']) ?? getNestedValue(record, ['nickname', 'author']);
  const likes = getNestedValue(interactInfo, ['liked_count', 'like_count']) ?? getNestedValue(record, ['liked_count', 'likes']);
  const url = typeof id === 'string' && id ? `https://www.xiaohongshu.com/explore/${id}` : undefined;

  if (!id && !title && !desc) return undefined;

  return {
    id: typeof id === 'string' ? id : undefined,
    title: typeof title === 'string' ? title : undefined,
    desc: typeof desc === 'string' ? desc : undefined,
    author: typeof author === 'string' ? author : undefined,
    likes: typeof likes === 'number' || typeof likes === 'string' ? likes : undefined,
    url,
  };
}

function normalizeNotes(raw: unknown): XhsNote[] {
  const envelope = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const data = envelope.data ?? raw;
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const candidates = [
    payload.items,
    payload.notes,
    payload.data,
    Array.isArray(data) ? data : undefined,
  ];

  const list = candidates.find(Array.isArray) as unknown[] | undefined;
  return (list ?? []).map(normalizeNote).filter((item): item is XhsNote => Boolean(item));
}

async function runXhs(args: string[], timeoutMs = 45000): Promise<{ raw: unknown; stdout: string; command: string }> {
  const command = getXhsCommand();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        OUTPUT: 'json',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
      windowsHide: false,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`xhs 命令超时：${stringifyCommand(args)}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`无法启动 xhs CLI：${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const raw = parseJsonOutput(stdout);
      const envelope = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      if (code !== 0 || envelope.ok === false) {
        const error = envelope.error && typeof envelope.error === 'object'
          ? envelope.error as Record<string, unknown>
          : {};
        const message = typeof error.message === 'string' ? error.message : stderr.trim() || stdout.trim();
        reject(new Error(message || `xhs 命令失败，退出码 ${code}`));
        return;
      }
      resolve({ raw, stdout, command: stringifyCommand(args) });
    });
  });
}

function toXhsError(error: unknown): XhsResult {
  return {
    success: false,
    error: error instanceof Error ? error.message : '小红书 CLI 执行失败',
  };
}

export async function xhsStatus(): Promise<XhsResult> {
  try {
    const result = await runXhs(['status', '--json'], 20000);
    const envelope = result.raw && typeof result.raw === 'object' ? result.raw as Record<string, unknown> : {};
    const data = envelope.data && typeof envelope.data === 'object' ? envelope.data as Record<string, unknown> : {};
    return {
      success: true,
      authenticated: data.authenticated === true,
      user: data.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : undefined,
      raw: result.raw,
      command: result.command,
    };
  } catch (error) {
    return toXhsError(error);
  }
}

function getCookieSource(): string | undefined {
  const source = process.env.XHS_COOKIE_SOURCE?.trim();
  return source && source !== 'auto' ? source : undefined;
}

export async function xhsLogin(): Promise<XhsResult> {
  try {
    const cookieSource = getCookieSource();
    const args = cookieSource
      ? ['login', '--cookie-source', cookieSource, '--json']
      : ['login', '--json'];
    const result = await runXhs(args, 60000);
    return {
      success: true,
      message: `已尝试从${cookieSource || '本机浏览器'}导入小红书登录状态`,
      raw: result.raw,
      command: result.command,
    };
  } catch (error) {
    return toXhsError(error);
  }
}

export async function xhsHot(category: XhsCategory): Promise<XhsResult> {
  if (!XHS_CATEGORIES.has(category)) {
    return { success: false, error: '不支持的小红书热点分类' };
  }

  try {
    const result = await runXhs(['hot', '-c', category, '--json']);
    return {
      success: true,
      items: normalizeNotes(result.raw),
      raw: result.raw,
      command: result.command,
    };
  } catch (error) {
    return toXhsError(error);
  }
}

export async function xhsSearch(keyword: string, sort: XhsSort, noteType: XhsNoteType): Promise<XhsResult> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return { success: false, error: '请输入搜索关键词' };
  }
  if (!XHS_SORTS.has(sort) || !XHS_NOTE_TYPES.has(noteType)) {
    return { success: false, error: '不支持的小红书搜索参数' };
  }

  try {
    const result = await runXhs(['search', normalizedKeyword, '--sort', sort, '--type', noteType, '--json']);
    return {
      success: true,
      items: normalizeNotes(result.raw),
      raw: result.raw,
      command: result.command,
    };
  } catch (error) {
    return toXhsError(error);
  }
}
