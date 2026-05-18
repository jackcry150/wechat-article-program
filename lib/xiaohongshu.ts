import { spawn } from 'node:child_process';
import path from 'node:path';
export type { XhsNote, XhsQualityFilter } from './xhs-types';
export { filterLowFanHighLike, filterCurrentYear } from './xhs-types';
import type { XhsNote } from './xhs-types';

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
  | 'fitness'
  | (string & {});

export type XhsSort = 'general' | 'popular' | 'latest';
export type XhsNoteType = 'all' | 'video' | 'image';
export type XhsLoginMethod = 'browser' | 'qrcode';

export type XhsResult = {
  success: boolean;
  message?: string;
  authenticated?: boolean;
  user?: Record<string, unknown>;
  items?: XhsNote[];
  categories?: XhsCategoryOption[];
  raw?: unknown;
  error?: string;
  command?: string;
};

export type XhsCategoryOption = {
  value: string;
  label: string;
};

function dedupeNotes(notes: XhsNote[]): XhsNote[] {
  const seen = new Set<string>();

  return notes.filter((note) => {
    const key = note.id || note.url || [note.title, note.author, note.desc].filter(Boolean).join('|');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

const XHS_CATEGORY_LABELS: Record<string, string> = {
  fashion: '穿搭',
  food: '美食',
  cosmetics: '美妆',
  movie: '影视',
  career: '职场',
  love: '情感',
  home: '家居',
  gaming: '游戏',
  travel: '旅行',
  fitness: '健身',
};

const XHS_SORTS = new Set<XhsSort>(['general', 'popular', 'latest']);
const XHS_NOTE_TYPES = new Set<XhsNoteType>(['all', 'video', 'image']);

function getXhsCommand(): string {
  return process.env.XHS_CLI_COMMAND?.trim() || (process.platform === 'win32' ? 'xhs.cmd' : 'xhs');
}

function getInstallHint(): string {
  return process.platform === 'win32'
    ? '请先安装 xiaohongshu-cli：uv tool install xiaohongshu-cli，并确认 xhs.cmd 在 PATH 中。'
    : '请先安装 xiaohongshu-cli：uv tool install xiaohongshu-cli，并确认 xhs 在 PATH 中。';
}

function stringifyCommand(args: string[]): string {
  return [getXhsCommand(), ...args].join(' ');
}

function parseJsonOutput(stdout: string, stderr = ''): unknown {
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
    throw new Error(`无法解析 xhs JSON 输出：${(trimmed || stderr.trim()).slice(0, 500)}`);
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
  const author = getNestedValue(user, ['nickname', 'name', 'nick_name']) ?? getNestedValue(record, ['nickname', 'author']);
  const avatar = getNestedValue(user, ['avatar', 'image']) ?? getNestedValue(record, ['avatar']);
  const authorId = getNestedValue(user, ['user_id', 'userid', 'id']) ?? getNestedValue(record, ['user_id', 'author_id']);
  const likes = getNestedValue(interactInfo, ['liked_count', 'like_count']) ?? getNestedValue(record, ['liked_count', 'likes']);
  const collectedCount = getNestedValue(interactInfo, ['collected_count', 'favorite_count']) ?? getNestedValue(record, ['collected_count', 'fav_count']);
  const commentCount = getNestedValue(interactInfo, ['comment_count']) ?? getNestedValue(record, ['comment_count']);
  const shareCount = getNestedValue(interactInfo, ['share_count']) ?? getNestedValue(record, ['share_count']);
  const followerCount = getNestedValue(user, ['follower_count', 'followers', 'fans']) ?? getNestedValue(record, ['follower_count', 'fans_count']);
  const followingCount = getNestedValue(user, ['following_count', 'followings']) ?? getNestedValue(record, ['following_count']);
  const url = typeof id === 'string' && id ? `https://www.xiaohongshu.com/explore/${id}` : undefined;

  // Extract publish time from corner_tag_info
  let publishTime: string | undefined;
  const cornerTags = noteCard.corner_tag_info;
  if (Array.isArray(cornerTags)) {
    const timeTag = cornerTags.find(
      (t: unknown) => t && typeof t === 'object' && (t as Record<string, unknown>).type === 'publish_time',
    ) as Record<string, unknown> | undefined;
    if (timeTag && typeof timeTag.text === 'string') {
      publishTime = timeTag.text;
    }
  }

  if (!id && !title && !desc) return undefined;

  return {
    id: typeof id === 'string' ? id : undefined,
    title: typeof title === 'string' ? title : undefined,
    desc: typeof desc === 'string' ? desc : undefined,
    author: typeof author === 'string' ? author : undefined,
    avatar: typeof avatar === 'string' ? avatar : undefined,
    authorId: typeof authorId === 'string' ? authorId : undefined,
    likes: typeof likes === 'number' || typeof likes === 'string' ? likes : undefined,
    collectedCount: typeof collectedCount === 'number' || typeof collectedCount === 'string' ? collectedCount : undefined,
    commentCount: typeof commentCount === 'number' || typeof commentCount === 'string' ? commentCount : undefined,
    shareCount: typeof shareCount === 'number' || typeof shareCount === 'string' ? shareCount : undefined,
    followerCount: typeof followerCount === 'number' || typeof followerCount === 'string' ? followerCount : undefined,
    followingCount: typeof followingCount === 'number' || typeof followingCount === 'string' ? followingCount : undefined,
    publishTime,
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

function toCategoryOption(value: string): XhsCategoryOption {
  return {
    value,
    label: XHS_CATEGORY_LABELS[value] || value,
  };
}

function getFallbackCategories(): XhsCategoryOption[] {
  return Array.from(XHS_CATEGORIES).map(toCategoryOption);
}

function parseHotCategoriesFromHelp(output: string): XhsCategoryOption[] {
  const match = output.match(/--category\s+\[([^\]]+)\]/);
  if (!match?.[1]) {
    throw new Error('未在 xhs hot --help 输出中找到分类列表');
  }

  const categories = match[1]
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(toCategoryOption);

  if (!categories.length) {
    throw new Error('xhs hot --help 未返回有效分类');
  }

  return categories;
}

async function runXhs(
  args: string[],
  timeoutMs = 45000,
  options: { parseJson?: boolean } = {},
): Promise<{ raw: unknown; stdout: string; command: string }> {
  const command = getXhsCommand();
  const parseJson = options.parseJson ?? true;

  return new Promise((resolve, reject) => {
    const { ALL_PROXY, ...cleanEnv } = process.env;
    void ALL_PROXY; // strip socks proxy to avoid socksio dependency in xhs CLI
    const child = spawn(command, args, {
      env: {
        ...cleanEnv,
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
      reject(new Error(`无法启动 xhs CLI：${error.message}。${getInstallHint()}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      let raw: unknown = stdout;

      if (parseJson) {
        try {
          raw = parseJsonOutput(stdout, stderr);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          reject(new Error(stderr.trim() || stdout.trim() || detail));
          return;
        }

        const envelope = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        if (code !== 0 || envelope.ok === false) {
          const error = envelope.error && typeof envelope.error === 'object'
            ? envelope.error as Record<string, unknown>
            : {};
          const message = typeof error.message === 'string' ? error.message : stderr.trim() || stdout.trim();
          reject(new Error(message || `xhs 命令失败，退出码 ${code}`));
          return;
        }
      } else if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `xhs 命令失败，退出码 ${code}`));
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

async function enrichWithFanCounts(notes: XhsNote[]): Promise<XhsNote[]> {
  if (!notes.length) return notes;

  const authorIds = Array.from(new Set(
    notes
      .map((n) => n.authorId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ));

  if (!authorIds.length) return notes;

  try {
    const scriptPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'xhs-fan-fetcher.py');
    const fanMapStr = await new Promise<string>((resolve, reject) => {
      const child = spawn('python3', [scriptPath, ...authorIds], { env: process.env });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => { stdout += String(c); });
      child.stderr.on('data', (c) => { stderr += String(c); });
      child.on('close', (code) => {
        if (code !== 0) reject(new Error(stderr.trim() || `exit ${code}`));
        else resolve(stdout.trim());
      });
      child.on('error', reject);
    });

    const fanMap: Record<string, number | null> = JSON.parse(fanMapStr);

    return notes.map((note) => {
      if (!note.authorId || !(note.authorId in fanMap)) return note;
      const fans = fanMap[note.authorId];
      if (fans !== null && fans !== undefined) {
        return { ...note, followerCount: String(fans) };
      }
      return note;
    });
  } catch (error) {
    console.error('[xiaohongshu] enrichWithFanCounts failed:', error);
    return notes;
  }
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

function readAuthenticated(raw: unknown): boolean {
  const envelope = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const data = envelope.data && typeof envelope.data === 'object' ? envelope.data as Record<string, unknown> : {};
  return data.authenticated === true;
}

function readUser(raw: unknown): Record<string, unknown> | undefined {
  const envelope = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const data = envelope.data && typeof envelope.data === 'object' ? envelope.data as Record<string, unknown> : {};
  return data.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : undefined;
}

export async function xhsLogin(method: XhsLoginMethod = 'browser'): Promise<XhsResult> {
  try {
    if (method === 'browser') {
      const current = await runXhs(['status', '--json'], 20000);
      if (readAuthenticated(current.raw)) {
        return {
          success: true,
          message: '小红书已经登录，无需重新从浏览器导入 Cookie。',
          authenticated: true,
          user: readUser(current.raw),
          raw: current.raw,
          command: current.command,
        };
      }
    }

    const cookieSource = getCookieSource();
    const args = method === 'qrcode'
      ? ['login', '--qrcode', '--json']
      : cookieSource
        ? ['login', '--cookie-source', cookieSource, '--json']
        : ['login', '--json'];
    const result = await runXhs(args, method === 'qrcode' ? 8 * 60 * 1000 : 60000);
    return {
      success: true,
      message: method === 'qrcode'
        ? '小红书扫码登录成功，已保存登录状态'
        : `已尝试从${cookieSource || '本机浏览器'}导入小红书登录状态`,
      authenticated: true,
      raw: result.raw,
      command: result.command,
    };
  } catch (error) {
    const result = toXhsError(error);
    result.message = method === 'qrcode'
      ? '扫码登录失败或超时。首次扫码登录会下载 Camoufox 浏览器运行时；请等待弹出的登录窗口并用小红书 App 扫码确认。'
      : '没有检测到浏览器里的小红书登录态。请先在浏览器打开 xiaohongshu.com 并登录，或使用“扫码登录”。';
    const cookieSource = getCookieSource();
    result.command = stringifyCommand(
      method === 'qrcode'
        ? ['login', '--qrcode', '--json']
        : cookieSource
          ? ['login', '--cookie-source', cookieSource, '--json']
          : ['login', '--json'],
    );
    return result;
  }
}

export async function xhsHot(category: XhsCategory): Promise<XhsResult> {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    return { success: false, error: '请选择小红书热点分类' };
  }

  try {
    const result = await runXhs(['hot', '-c', normalizedCategory, '--json']);
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

export async function xhsHotMulti(categories: XhsCategory[]): Promise<XhsResult> {
  const normalizedCategories = Array.from(new Set(
    categories.map((category) => category.trim()).filter(Boolean),
  ));

  if (!normalizedCategories.length) {
    return { success: false, error: '请选择至少一个小红书热点分类' };
  }

  try {
    const results = await Promise.all(
      normalizedCategories.map((category) => runXhs(['hot', '-c', category, '--json'])),
    );
    const items = dedupeNotes(results.flatMap((result) => normalizeNotes(result.raw)));
    const enrichedItems = await enrichWithFanCounts(items);

    return {
      success: true,
      items: enrichedItems,
      raw: results.map((result) => result.raw),
      command: results.map((result) => result.command).join('\n'),
      message: `已合并 ${normalizedCategories.length} 个分类，共 ${items.length} 条去重热点`,
    };
  } catch (error) {
    return toXhsError(error);
  }
}

export async function xhsCategories(): Promise<XhsResult> {
  try {
    const result = await runXhs(['hot', '--help'], 15000, { parseJson: false });
    const categories = parseHotCategoriesFromHelp(result.stdout);

    return {
      success: true,
      categories,
      raw: result.stdout,
      command: result.command,
      message: `已从 xhs CLI 读取 ${categories.length} 个热点分类`,
    };
  } catch (error) {
    const fallback = getFallbackCategories();
    return {
      success: true,
      categories: fallback,
      raw: { fallback: true },
      error: error instanceof Error ? error.message : '读取小红书分类失败',
      message: '读取 xhs CLI 分类失败，已回退到内置分类',
      command: stringifyCommand(['hot', '--help']),
    };
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
    const items = normalizeNotes(result.raw);
    const enrichedItems = await enrichWithFanCounts(items);
    return {
      success: true,
      items: enrichedItems,
      raw: result.raw,
      command: result.command,
    };
  } catch (error) {
    return toXhsError(error);
  }
}
