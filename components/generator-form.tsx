'use client';

import { useActionState, useState, useEffect } from 'react';
import { generateArticleFromFormData } from '../app/actions/generate';
import { GenerateResult } from '../types';

const initialState: GenerateResult | null = null;

function PendingStatusCard({ isPending, elapsed }: { isPending: boolean; elapsed: number }) {
  if (!isPending) return null;
  let phase = '正在生成图片并写入本地目录';
  if (elapsed < 5) phase = '正在联网搜索最新资讯';
  else if (elapsed < 8) phase = '正在生成大纲';
  else if (elapsed < 20) phase = '正在扩写正文';
  else if (elapsed < 40) phase = '正在规划配图';
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-semibold">正在生成中，这不是没反应</p>
      <p className="mt-1 text-amber-700">{phase}（已等待 {elapsed} 秒）</p>
    </div>
  );
}

function StatusBanner({ state }: { state: GenerateResult | null }) {
  if (!state) return null;
  if (state.success) {
    return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">已生成完成，文件已写入本地目录：{state.outputPath}</div>;
  }
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">生成失败：{state.error}</div>;
}

export function GeneratorForm() {
  const [state, formAction, isPending] = useActionState(generateArticleFromFormData, initialState);
  const [elapsed, setElapsed] = useState(0);
  const images = state?.generatedImages ?? [];

  useEffect(() => {
    if (!isPending) return;
    const start = Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isPending]);
  const successfulImageCount = images.filter((item) => !item.error).length;
  const displayElapsed = isPending ? elapsed : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-emerald-600">本地 Web 软件 · MVP</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">公众号图文生成器</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">输入主题后，自动生成文章大纲、正文和配图，并保存到本地目录，最后由你手动上传公众号后台。</p>
        </div>

        <form action={formAction} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">文章主题 *</span>
            <input name="topic" required placeholder="例如：普通人怎么用 AI 做公众号副业" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">文章风格</span>
            <input name="style" placeholder="例如：干货型、口语型、故事型" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">目标读者</span>
            <input name="audience" placeholder="例如：公众号运营新手、AI 创业者" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">文章长度</span>
              <select name="length" defaultValue="medium" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                <option value="short">短文</option>
                <option value="medium">中等</option>
                <option value="long">长文</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">正文配图数量</span>
              <input name="imageCount" type="number" min={0} max={5} defaultValue={3} className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              <p className="mt-1 text-xs text-zinc-400">配图越多越慢，想快速测试可先设为 0 或 1。</p>
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            <input name="includeCover" type="checkbox" defaultChecked className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
            同时生成封面图
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">补充要求</span>
            <textarea name="extraRequirements" rows={5} placeholder="例如：不要太官话，结尾给行动建议，图片风格简洁高级" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">自定义大纲提示词（可选）</span>
            <textarea name="customOutlinePrompt" rows={3} placeholder="覆盖默认的大纲生成提示词" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">自定义正文提示词（可选）</span>
            <textarea name="customArticlePrompt" rows={3} placeholder="覆盖默认的正文生成提示词" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-800">自定义配图规划提示词（可选）</span>
            <textarea name="customImagePlannerPrompt" rows={3} placeholder="覆盖默认的配图规划提示词" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          </label>

          <button type="submit" disabled={isPending} className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">
            {isPending ? '正在生成中，请稍等…' : '开始生成'}
          </button>
        </form>
      </section>

      <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <StatusBanner state={state} />
        <PendingStatusCard isPending={isPending} elapsed={displayElapsed} />

        <div>
          <h3 className="text-lg font-semibold text-zinc-900">输出结果</h3>
          <p className="mt-1 text-sm text-zinc-600">这里展示文章预览、图片预览和本地输出目录。</p>
        </div>

        {state?.success ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">输出目录</p>
                <p className="mt-2 break-all text-sm text-zinc-800">{state.outputPath}</p>
                {state.downloadUrl && (
                  <a
                    href={state.downloadUrl}
                    className="mt-3 inline-flex items-center justify-center rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-200"
                  >
                    下载结果包
                  </a>
                )}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">图片结果</p>
                <p className="mt-2 text-sm text-zinc-800">成功 {successfulImageCount} 张 / 共 {images.length} 张</p>
              </div>
            </div>

            {state.searchUsed && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">联网搜索</p>
                <p className="mt-2 text-sm text-zinc-800">{state.searchUsed.triggered ? '✅ 已触发' : '❌ 未触发'}</p>
                {state.searchUsed.query && (
                  <p className="mt-1 text-sm text-zinc-600">查询词：{state.searchUsed.query}</p>
                )}
                {typeof state.searchUsed.resultCount === 'number' && (
                  <p className="mt-1 text-sm text-zinc-600">命中资料：{state.searchUsed.resultCount} 条</p>
                )}
              </div>
            )}

            {state.articleExcerpt && (
              <div>
                <h4 className="mb-3 text-base font-semibold text-zinc-900">文章摘要（预览）</h4>
                <pre className="max-h-[200px] overflow-auto rounded-2xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100 whitespace-pre-wrap">{state.articleExcerpt}</pre>
              </div>
            )}

            {state.outlineExcerpt && (
              <div>
                <h4 className="mb-3 text-base font-semibold text-zinc-900">大纲摘要（预览）</h4>
                <pre className="max-h-[150px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{state.outlineExcerpt}</pre>
              </div>
            )}

            <div>
              <h4 className="mb-3 text-base font-semibold text-zinc-900">图片生成状态</h4>
              <div className="grid gap-4 md:grid-cols-2">
                {images.length ? (
                  images.map((image, index) => (
                    <article key={`${image.fileName}-${index}`} className="rounded-2xl border border-zinc-200 p-4">
                      <p className="text-sm font-medium text-zinc-900">{image.fileName || `image-${index + 1}`}</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">{image.prompt}</p>
                      {!image.error ? (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">生成成功</div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">图片生成失败：{image.error}</div>
                      )}
                      {image.relativePath && <p className="mt-2 text-xs text-zinc-500">路径：{image.relativePath}</p>}
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">还没有图片结果。生成完成后会在这里显示。</div>
                )}
              </div>
            </div>

            {state.usedPrompts && (
              <div>
                <h4 className="mb-3 text-base font-semibold text-zinc-900">本次实际使用的 Prompt (预览)</h4>

                {state.usedPrompts.outlinePrompt && (
                  <div className="mb-4">
                    <p className="mb-2 text-sm font-medium text-zinc-700">大纲 Prompt</p>
                    <pre className="max-h-[100px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{state.usedPrompts.outlinePrompt}</pre>
                  </div>
                )}

                {state.usedPrompts.articlePrompt && (
                  <div className="mb-4">
                    <p className="mb-2 text-sm font-medium text-zinc-700">正文 Prompt</p>
                    <pre className="max-h-[100px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{state.usedPrompts.articlePrompt}</pre>
                  </div>
                )}

                {state.usedPrompts.imagePlannerPrompt && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-700">配图规划 Prompt</p>
                    <pre className="max-h-[100px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{state.usedPrompts.imagePlannerPrompt}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-sm leading-6 text-zinc-500">
            还没有生成结果。填写左侧表单后，系统会把文章和配图保存到本地目录，并在这里显示预览。
          </div>
        )}
      </section>
    </div>
  );
}
