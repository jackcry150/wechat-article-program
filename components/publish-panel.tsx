'use client';

import { useActionState } from 'react';
import { publishOutputFromFormData } from '../app/actions/publish';
import { OutputSummary, PublishPlatform, PublishResult } from '../types';

const initialState: PublishResult | null = null;

const platformOptions: Array<{ key: PublishPlatform; label: string; desc: string }> = [
  { key: 'csdn', label: 'CSDN', desc: 'Markdown 技术博客风，适合先验证平台改写' },
  { key: 'zhihu', label: '知乎', desc: '回答型内容风格，强调逻辑和观点链路' },
  { key: 'jianshu', label: '简书', desc: '专栏化表达，适合轻编辑类长文' },
  { key: 'toutiao', label: '头条号', desc: '资讯/经验型 HTML 改写，需后续补图片上传' },
  { key: 'baijiahao', label: '百家号', desc: '资讯富文本改写，保留 review notes' },
  { key: 'netease', label: '网易号', desc: '媒体专栏风格的 HTML 改写版本' },
  { key: 'sohu', label: '搜狐号', desc: '自媒体资讯风格的 HTML 改写版本' },
  { key: 'qiehao', label: '企鹅号', desc: '企鹅号富文本改写，待补真实鉴权链路' },
];

export function PublishPanel({ outputs }: { outputs: OutputSummary[] }) {
  const [state, formAction, isPending] = useActionState(publishOutputFromFormData, initialState);
  const latestOutput = outputs[0];

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-sky-600">发布骨架 · 手动触发</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-900">多平台发布预检</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            当前版本会先读取已有母稿，对每个平台执行一次 AI 改写预检，再生成对应的发布 payload，并写入输出目录下的
            <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">publish-artifacts/</code>
            和
            <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">publish-log.json</code>。
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">选择输出目录</span>
            <select
              name="outputId"
              defaultValue={latestOutput?.id || ''}
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            >
              {outputs.length ? (
                outputs.map((output) => (
                  <option key={output.id} value={output.id}>
                    {output.id} · {output.topic}
                  </option>
                ))
              ) : (
                <option value="">暂无可发布输出</option>
              )}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {platformOptions.map((platform, index) => (
              <label key={platform.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="platforms"
                    value={platform.key}
                    defaultChecked={index < 4}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-semibold text-zinc-900">{platform.label}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{platform.desc}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={isPending || !outputs.length}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isPending ? '正在写入发布预检结果…' : '执行发布预检'}
          </button>
        </div>

        <aside className="space-y-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">最近输出</p>
            <p className="mt-2 text-sm text-zinc-800">{latestOutput ? latestOutput.topic : '暂无输出'}</p>
            {latestOutput && <p className="mt-1 break-all text-xs text-zinc-500">{latestOutput.outputDir}</p>}
          </div>

          {state ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${state.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {state.success ? '发布预检完成' : `发布预检失败：${state.error}`}
            </div>
          ) : null}

          {state?.publishLogPath && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">日志文件</p>
              <p className="mt-2 break-all text-xs text-zinc-700">{state.publishLogPath}</p>
            </div>
          )}

          {state?.records?.length ? (
            <div className="space-y-3">
              {state.records.map((record) => (
                <article key={record.platform} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900">{platformOptions.find((item) => item.key === record.platform)?.label || record.platform}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      record.status === 'prepared'
                        ? 'bg-emerald-100 text-emerald-700'
                        : record.status === 'failed'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-zinc-200 text-zinc-700'
                    }`}>
                      {record.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">{record.message}</p>
                  {record.requestPath && <p className="mt-2 break-all text-xs text-zinc-500">{record.requestPath}</p>}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-sm text-zinc-500">
              执行一次发布预检后，这里会显示每个平台生成的 payload 和日志位置。
            </div>
          )}
        </aside>
      </form>
    </section>
  );
}
