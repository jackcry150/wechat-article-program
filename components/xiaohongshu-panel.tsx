'use client';

import { useState, useTransition } from 'react';
import {
  checkXhsStatus,
  loginXhs,
  refineXhsTopics,
  searchXhs,
} from '../app/actions/xiaohongshu';
import type { XhsResult } from '../lib/xiaohongshu';
import type { XhsNote, XhsQualityFilter } from '../lib/xhs-types';
import { filterLowFanHighLike, filterCurrentYear } from '../lib/xhs-types';

const DEFAULT_FILTER: XhsQualityFilter = {
  enabled: true,
  maxFollowers: 5000,
  minLikes: 500,
  minEngagement: 1000,
};

function ResultNotice({ result }: { result: XhsResult | null }) {
  if (!result) return null;
  return (
    <div className={`rounded-xl px-4 py-3 text-sm ${
      result.success
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border border-rose-200 bg-rose-50 text-rose-700'
    }`}>
      {result.message && <p className="font-medium">{result.message}</p>}
      {result.error && <p className="mt-1 whitespace-pre-wrap">{result.error}</p>}
    </div>
  );
}

function NoteCard({ note }: { note: XhsNote }) {
  const fans = note.followerCount ? Number(note.followerCount) : undefined;
  const likes = typeof note.likes === 'string' ? Number(note.likes) : note.likes;
  const collected = typeof note.collectedCount === 'string' ? Number(note.collectedCount) : note.collectedCount;
  const comments = typeof note.commentCount === 'string' ? Number(note.commentCount) : note.commentCount;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">{note.author || '未知作者'}</span>
          {fans !== undefined && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fans <= 5000 ? 'bg-rose-50 text-rose-700' : 'bg-zinc-100 text-zinc-500'}`}>
              粉丝 {fans.toLocaleString()}
            </span>
          )}
        </div>
        {note.url && (
          <a href={note.url} target="_blank" rel="noopener noreferrer" className="text-xs text-rose-600 hover:underline shrink-0">
            打开原文 ↗
          </a>
        )}
      </div>

      <h4 className="mt-2 text-sm font-medium leading-6 text-zinc-900">
        {note.title || '无标题'}
      </h4>
      {note.desc && (
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-600">
          {note.desc}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        {note.publishTime && (
          <span className="text-zinc-400">{note.publishTime}</span>
        )}
        {likes !== undefined && (
          <span>👍 {typeof likes === 'number' ? likes.toLocaleString() : likes}</span>
        )}
        {collected !== undefined && (
          <span>⭐ {typeof collected === 'number' ? collected.toLocaleString() : collected}</span>
        )}
        {comments !== undefined && (
          <span>💬 {typeof comments === 'number' ? comments.toLocaleString() : comments}</span>
        )}
      </div>
    </article>
  );
}

function FilterControls({ filter, onChange }: { filter: XhsQualityFilter; onChange: (f: XhsQualityFilter) => void }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filter.enabled}
            onChange={(e) => onChange({ ...filter, enabled: e.target.checked })}
            className="size-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
          />
          <span className="text-sm font-medium text-zinc-800">低粉高赞筛选</span>
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
          <label className="flex items-center gap-1">
            粉丝≤
            <input type="number" value={filter.maxFollowers}
              onChange={(e) => onChange({ ...filter, maxFollowers: Number(e.target.value) || 0 })}
              className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-rose-400" />
          </label>
          <label className="flex items-center gap-1">
            点赞≥
            <input type="number" value={filter.minLikes}
              onChange={(e) => onChange({ ...filter, minLikes: Number(e.target.value) || 0 })}
              className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-rose-400" />
          </label>
          <label className="flex items-center gap-1">
            互动≥
            <input type="number" value={filter.minEngagement}
              onChange={(e) => onChange({ ...filter, minEngagement: Number(e.target.value) || 0 })}
              className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-rose-400" />
          </label>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        筛选后仅保留符合条件的内容。粉丝数通过抓取用户主页获取，有 30 分钟缓存。
      </p>
    </div>
  );
}

function RefinedTopicsView({ text }: { text: string }) {
  if (!text) return null;

  // Split by ## 选题 markers
  const sections = text.split(/\n(?=##\s*选题\s*\d+)/);
  if (sections.length <= 1) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600 whitespace-pre-wrap">
        {text}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map((section, i) => {
        const titleMatch = section.match(/^##\s*选题\s*\d+\s*[：:]\s*(.+)/);
        const topicTitle = titleMatch?.[1]?.trim() || `选题 ${i + 1}`;

        const extract = (label: string) => {
          const re = new RegExp(`-\\s*${label}[：:]\\s*([\\s\\S]*?)(?=\\n-\\s*[^\\n：:]+[：:]|$)`, 'm');
          return re.exec(section)?.[1]?.trim();
        };

        return (
          <article key={i} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">选题 {i + 1}</span>
            <h4 className="mt-2 text-base font-semibold text-zinc-900">{topicTitle}</h4>
            {extract('推荐标题') && (
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                <span className="font-medium">推荐标题：</span>{extract('推荐标题')}
              </p>
            )}
            {extract('内容角度') && (
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                <span className="font-medium">内容角度：</span>{extract('内容角度')}
              </p>
            )}
            {extract('开头钩子') && (
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                <span className="font-medium">开头钩子：</span>{extract('开头钩子')}
              </p>
            )}
            {extract('转化落点') && (
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                <span className="font-medium">转化落点：</span>{extract('转化落点')}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function XiaohongshuPanel() {
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'general' | 'popular' | 'latest'>('general');
  const [filter, setFilter] = useState<XhsQualityFilter>(DEFAULT_FILTER);
  const [status, setStatus] = useState<XhsResult | null>(null);
  const [loginResult, setLoginResult] = useState<XhsResult | null>(null);
  const [searchNotes, setSearchNotes] = useState<XhsNote[] | null>(null);
  const [filteredNotes, setFilteredNotes] = useState<XhsNote[] | null>(null);
  const [refinedResult, setRefinedResult] = useState<XhsResult | null>(null);
  const [step, setStep] = useState('');
  const [isWorking, startWork] = useTransition();
  const [isStatusPending, startStatus] = useTransition();
  const [isLoginPending, startLogin] = useTransition();
  const [isQrPending, startQr] = useTransition();

  function handleSearch() {
    const kw = keyword.trim();
    if (!kw) {
      setRefinedResult({ success: false, error: '请输入搜索关键词' });
      return;
    }

    startWork(async () => {
      setSearchNotes(null);
      setFilteredNotes(null);
      setRefinedResult(null);

      setStep('正在搜索…');
      const search = await searchXhs(null, (() => {
        const fd = new FormData();
        fd.set('keyword', kw);
        fd.set('sort', sort);
        fd.set('noteType', 'all');
        return fd;
      })());

      if (!search.success || !search.items?.length) {
        setRefinedResult(search);
        setStep('');
        return;
      }

      const allNotes = search.items;
      const thisYearNotes = filterCurrentYear(allNotes);
      setSearchNotes(thisYearNotes);

      const filtered = filter.enabled
        ? filterLowFanHighLike(thisYearNotes, filter)
        : thisYearNotes;
      setFilteredNotes(filtered);

      if (!filtered.length) {
        setRefinedResult({ success: false, error: `筛选后无结果（原始 ${allNotes.length} 条，均不满足低粉高赞条件）` });
        setStep('');
        return;
      }

      setStep('正在修饰选题…');
      const refined = await refineXhsTopics(kw, filtered);
      setRefinedResult(refined);
      setStep('');
    });
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">小红书低粉高赞</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={isStatusPending}
            onClick={() => startStatus(async () => setStatus(await checkXhsStatus()))}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 disabled:opacity-50">
            {isStatusPending ? '检查中' : '检查登录'}
          </button>
          <button type="button" disabled={isLoginPending}
            onClick={() => startLogin(async () => setLoginResult(await loginXhs('browser')))}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
            {isLoginPending ? '导入中' : '导入浏览器登录'}
          </button>
          <button type="button" disabled={isQrPending}
            onClick={() => startQr(async () => setLoginResult(await loginXhs('qrcode')))}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
            {isQrPending ? '等待扫码' : '扫码登录'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ResultNotice result={status} />
        <ResultNotice result={loginResult} />
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
        <div className="flex gap-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索关键词，例如：潮玩、娃衣、游戏角色、盲盒开箱"
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'general' | 'popular' | 'latest')}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
          >
            <option value="general">综合</option>
            <option value="popular">最热</option>
            <option value="latest">最新</option>
          </select>
          <button type="button" disabled={isWorking || !keyword.trim()}
            onClick={handleSearch}
            className="inline-flex h-[48px] items-center justify-center rounded-xl bg-rose-600 px-6 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300">
            {isWorking ? '搜索中…' : '搜索'}
          </button>
        </div>

        {step && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{step}</div>
        )}

        <FilterControls filter={filter} onChange={setFilter} />
      </div>

      {searchNotes !== null && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-lg font-semibold text-zinc-900">搜索结果</h3>
            <span className="text-sm text-zinc-500">
              原始 {searchNotes.length} 条，筛选后 {filteredNotes?.length ?? 0} 条
            </span>
          </div>
          {filteredNotes && filteredNotes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredNotes.map((note, i) => (
                <NoteCard key={note.id || note.url || i} note={note} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              {searchNotes.length > 0 ? '筛选后无匹配内容，尝试放宽筛选条件' : '暂无搜索结果'}
            </div>
          )}
        </div>
      )}

      {refinedResult?.success && refinedResult.message && (
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-zinc-900">修饰选题</h3>
            <p className="mt-1 text-sm text-zinc-600">基于以上筛选后的内容，由 AI 生成的候选选题。</p>
          </div>
          <RefinedTopicsView text={refinedResult.message} />
        </div>
      )}
    </section>
  );
}
