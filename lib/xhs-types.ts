export type XhsNote = {
  id?: string;
  title?: string;
  desc?: string;
  author?: string;
  avatar?: string;
  authorId?: string;
  likes?: number | string;
  collectedCount?: number | string;
  commentCount?: number | string;
  shareCount?: number | string;
  followerCount?: number | string;
  followingCount?: number | string;
  /** publish time text from xhs API, e.g. "04-23", "2小时前", "10分钟前" */
  publishTime?: string;
  url?: string;
};

export type XhsQualityFilter = {
  /** 启用低粉高赞筛选 */
  enabled: boolean;
  /** 粉丝数上限（含），超过的不算低粉 */
  maxFollowers: number;
  /** 点赞数下限（含），低于的不算高赞 */
  minLikes: number;
  /** 最低互动（点赞+收藏+评论+分享）下限 */
  minEngagement: number;
};

/** 低粉高赞筛选：粉丝 ≤ maxFollowers 且 点赞 ≥ minLikes 且 总互动 ≥ minEngagement */
export function filterLowFanHighLike(notes: XhsNote[], filter: XhsQualityFilter): XhsNote[] {
  if (!filter.enabled || !notes.length) return notes;

  return notes.filter((note) => {
    const followerCount = typeof note.followerCount === 'string'
      ? Number.parseInt(note.followerCount, 10)
      : note.followerCount ?? Number.POSITIVE_INFINITY;

    const likes = typeof note.likes === 'string'
      ? Number.parseInt(note.likes, 10)
      : note.likes ?? 0;

    const engagement =
      (typeof note.likes === 'string' ? Number.parseInt(note.likes, 10) || 0 : note.likes ?? 0) +
      (typeof note.collectedCount === 'string' ? Number.parseInt(note.collectedCount, 10) || 0 : note.collectedCount ?? 0) +
      (typeof note.commentCount === 'string' ? Number.parseInt(note.commentCount, 10) || 0 : note.commentCount ?? 0) +
      (typeof note.shareCount === 'string' ? Number.parseInt(note.shareCount, 10) || 0 : note.shareCount ?? 0);

    if (!Number.isFinite(followerCount)) {
      // No follower data → keep the note (can't filter)
      return likes >= filter.minLikes && engagement >= filter.minEngagement;
    }

    return followerCount <= filter.maxFollowers
      && likes >= filter.minLikes
      && engagement >= filter.minEngagement;
  });
}

/** 过滤仅保留今年的笔记（publishTime 为 "MM-DD" 格式视为今年，相对时间如"X分钟前"也视为今年） */
export function filterCurrentYear(notes: XhsNote[]): XhsNote[] {
  const currentYear = new Date().getFullYear();

  return notes.filter((note) => {
    const pt = note.publishTime;
    if (!pt) return true; // no time data → keep

    // Relative time expressions — definitely recent
    if (/[分钟时天]前|刚刚|昨天|今天/.test(pt)) return true;

    // "MM-DD" format — treat as current year
    const mmdd = pt.match(/^(\d{1,2})-(\d{1,2})$/);
    if (mmdd) return true;

    // "YYYY-MM-DD" or "YYYY/MM/DD" — check year
    const full = pt.match(/(\d{4})/);
    if (full) {
      return Number.parseInt(full[1], 10) === currentYear;
    }

    return true; // unrecognized format → keep
  });
}
