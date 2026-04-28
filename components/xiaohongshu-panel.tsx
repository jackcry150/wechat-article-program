'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  checkXhsStatus,
  fetchXhsHot,
  loginXhs,
  searchXhs,
} from '../app/actions/xiaohongshu';
import type { XhsResult } from '../lib/xiaohongshu';

const categories = [
  ['fashion', '穿搭'],
  ['food', '美食'],
  ['cosmetics', '美妆'],
  ['movie', '影视'],
  ['career', '职场'],
  ['love', '情感'],
  ['home', '家居'],
  ['gaming', '游戏'],
  ['travel', '旅行'],
  ['fitness', '健身'],
] as const;

function ResultNotice({ result }: { result: XhsResult | null }) {
  if (!result) return null;

  if (!result.success) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {result.error || '小红书 CLI 执行失败'}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {result.message || `已获取 ${result.items?.length ?? 0} 条结果`}
    </div>
  );
}

function NoteList({ result }: { result: XhsResult | null }) {
  const items = result?.items ?? [];
  if (!result?.success || !items.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.slice(0, 12).map((item, index) => (
        <article key={item.id || `${item.title}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-sm font-semibold leading-6 text-zinc-900">
              {item.title || item.desc || `小红书笔记 ${index + 1}`}
            </h4>
            {item.likes !== undefined && (
              <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600">
                {item.likes}
              </span>
            )}
          </div>
          {item.author && <p className="mt-1 text-xs text-zinc-500">{item.author}</p>}
          {item.desc && item.title && <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-600">{item.desc}</p>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-medium text-emerald-700 hover:text-emerald-800">
              打开笔记
            </a>
          )}
        </article>
      ))}
    </div>
  );
}

export function XiaohongshuPanel() {
  const [status, setStatus] = useState<XhsResult | null>(null);
  const [loginResult, setLoginResult] = useState<XhsResult | null>(null);
  const [isStatusPending, startStatusTransition] = useTransition();
  const [isLoginPending, startLoginTransition] = useTransition();
  const [hotResult, hotAction, isHotPending] = useActionState(fetchXhsHot, null);
  const [searchResult, searchAction, isSearchPending] = useActionState(searchXhs, null);

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-rose-600">小红书热点</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">登录并搜索选题灵感</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            使用本机安装的 `xiaohongshu-cli` 拉取小红书热门和搜索结果，适合先找热点，再复制标题或关键词到文章主题里生成公众号内容。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isStatusPending}
            onClick={() => startStatusTransition(async () => setStatus(await checkXhsStatus()))}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 disabled:opacity-50"
          >
            {isStatusPending ? '检查中' : '检查登录'}
          </button>
          <button
            type="button"
            disabled={isLoginPending}
            onClick={() => startLoginTransition(async () => setLoginResult(await loginXhs()))}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {isLoginPending ? '登录中' : '导入浏览器登录'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <ResultNotice result={status} />
          {status?.success && (
            <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              登录状态：{status.authenticated ? '已登录' : '未登录'}
            </p>
          )}
          <ResultNotice result={loginResult} />
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
          QR 登录请在终端运行：<code className="rounded bg-white px-1.5 py-0.5 text-zinc-800">xhs login --qrcode</code>
          。导入浏览器登录依赖你本机浏览器里已有小红书登录态。
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <form action={hotAction} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">热点分类</span>
              <select name="category" defaultValue="fashion" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100">
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={isHotPending} className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
              {isHotPending ? '拉取中' : '拉取分类热门'}
            </button>
          </form>

          <form action={searchAction} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">关键词搜索</span>
              <input name="keyword" placeholder="例如：AI 副业" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select name="sort" defaultValue="general" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100">
                <option value="general">综合</option>
                <option value="popular">最热</option>
                <option value="latest">最新</option>
              </select>
              <select name="noteType" defaultValue="all" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100">
                <option value="all">全部</option>
                <option value="video">视频</option>
                <option value="image">图文</option>
              </select>
            </div>
            <button type="submit" disabled={isSearchPending} className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
              {isSearchPending ? '搜索中' : '搜索小红书'}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <ResultNotice result={hotResult} />
          <NoteList result={hotResult} />
          <ResultNotice result={searchResult} />
          <NoteList result={searchResult} />
        </div>
      </div>
    </section>
  );
}
