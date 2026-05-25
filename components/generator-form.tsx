'use client';

import { useActionState, useEffect, useState } from 'react';
import { generateArticleFromFormData } from '../app/actions/generate';
import { ContentPlatform, GenerateResult } from '../types';

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

function TitleStatusBanner({ state }: { state: GenerateResult | null }) {
  if (!state) return null;
  if (state.success) {
    return <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">已生成 5 个标题候选。选中一个后，到下方内容生成器继续生成正文。</div>;
  }
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">标题候选生成失败：{state.error}</div>;
}

function ContentStatusBanner({ state }: { state: GenerateResult | null }) {
  if (!state) return null;
  if (state.success) {
    return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">已生成完成，文件已写入本地目录：{state.outputPath}</div>;
  }
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">内容生成失败：{state.error}</div>;
}

export function GeneratorForm() {
  const [titleState, titleFormAction, isTitlePending] = useActionState(generateArticleFromFormData, initialState);
  const [contentState, contentFormAction, isContentPending] = useActionState(generateArticleFromFormData, initialState);
  const [elapsed, setElapsed] = useState(0);
  const [platform, setPlatform] = useState<ContentPlatform>('wechat');
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('');
  const [audience, setAudience] = useState('');
  const [extraRequirements, setExtraRequirements] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [contentTopicDraft, setContentTopicDraft] = useState('');

  const titleCandidates = titleState?.titleCandidates ?? [];
  const recommendedTitle = titleState?.recommendedTitle ?? '';
  const resolvedTopic = contentTopicDraft || selectedTitle || recommendedTitle || topic;
  const images = contentState?.generatedImages ?? [];
  const successfulImageCount = images.filter((item) => !item.error).length;
  const isXhs = platform === 'xiaohongshu';

  useEffect(() => {
    if (!isContentPending) return;
    const start = Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isContentPending]);

  useEffect(() => {
    function handleFill(event: Event) {
      const detail = (event as CustomEvent<{
        platform?: ContentPlatform;
        topic?: string;
        extraRequirements?: string;
      }>).detail;
      if (!detail) return;
      if (detail.platform) setPlatform(detail.platform);
      if (detail.topic) {
        setTopic(detail.topic);
        setContentTopicDraft(detail.topic);
      }
      if (detail.extraRequirements) setExtraRequirements(detail.extraRequirements);
      window.requestAnimationFrame(() => {
        document.getElementById('title-generator-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    window.addEventListener('wechat-demo-fill-generator', handleFill);
    return () => window.removeEventListener('wechat-demo-fill-generator', handleFill);
  }, []);

  function pickTitle(candidate: string) {
    setSelectedTitle(candidate);
    setContentTopicDraft(candidate);
    window.requestAnimationFrame(() => {
      document.getElementById('content-generator-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const displayElapsed = isContentPending ? elapsed : 0;

  return (
    <div className="space-y-6">
      <section id="title-generator-form" className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-sky-600">第一步</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">生成待选标题</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">先上传素材或粘贴内容，系统生成 5 个标题候选。你点选其中一个标题后，再到下面生成正文。</p>
        </div>

        <form action={titleFormAction} className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-4">
            <input type="hidden" name="actionMode" value="suggest_titles" />

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-sm font-medium text-zinc-800">发布平台</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition ${platform === 'wechat' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-600'}`}>
                  <input type="radio" name="platform" value="wechat" checked={platform === 'wechat'} onChange={() => setPlatform('wechat')} className="sr-only" />
                  微信公众号
                </label>
                <label className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition ${platform === 'xiaohongshu' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-white text-zinc-600'}`}>
                  <input type="radio" name="platform" value="xiaohongshu" checked={platform === 'xiaohongshu'} onChange={() => setPlatform('xiaohongshu')} className="sr-only" />
                  小红书笔记
                </label>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">{isXhs ? '选题方向（可选）' : '标题方向（可选）'}</span>
              <input
                name="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={isXhs ? '例如：普通人用 AI 做副业的 5 个真实路径' : '例如：普通人怎么用 AI 做公众号副业'}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">素材文档内容</span>
              <textarea
                name="referenceMaterials"
                rows={7}
                placeholder="可直接粘贴 markdown、txt、网页正文、采访纪要、热点素材库等内容。"
                className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">上传素材文件（可多选）</span>
              <input
                name="referenceFiles"
                type="file"
                multiple
                accept=".md,.txt,.html,.htm,.json,.csv,.doc,.docx,.rtf,.rtfd,.odt,.pdf"
                className="block w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-sky-700 hover:file:bg-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">{isXhs ? '笔记风格' : '文章风格'}</span>
              <input
                name="style"
                value={style}
                onChange={(event) => setStyle(event.target.value)}
                placeholder={isXhs ? '例如：真实经验、清单型、避坑型、口语化' : '例如：干货型、口语型、故事型'}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">{isXhs ? '目标人群' : '目标读者'}</span>
              <input
                name="audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder={isXhs ? '例如：想做 AI 副业的新手、职场宝妈、内容创作者' : '例如：公众号运营新手、AI 创业者'}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">补充要求</span>
              <textarea
                name="extraRequirements"
                rows={4}
                value={extraRequirements}
                onChange={(event) => setExtraRequirements(event.target.value)}
                placeholder={isXhs ? '例如：更像真实经验分享，适合收藏' : '例如：不要太官话，标题更像真人会点开的版本'}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <button type="submit" disabled={isTitlePending} className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300">
              {isTitlePending ? '正在生成标题候选…' : '生成 5 个待选标题'}
            </button>
          </div>

          <div className="space-y-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <TitleStatusBanner state={titleState} />

            <div>
              <h3 className="text-lg font-semibold text-zinc-900">标题候选区</h3>
              <p className="mt-1 text-sm text-zinc-600">生成完成后，在这里点选一个标题，把它带入下面的内容生成器。</p>
            </div>

            {titleState?.success ? (
              <div className="space-y-5">
                {recommendedTitle ? (
                  <div className="rounded-2xl border border-sky-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-sky-700">推荐标题</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">{recommendedTitle}</p>
                  </div>
                ) : null}

                {titleCandidates.length ? (
                  <div className="space-y-2">
                    {titleCandidates.map((candidate, index) => {
                      const active = resolvedTopic === candidate;
                      return (
                        <button
                          key={`${candidate}-${index}`}
                          type="button"
                          onClick={() => pickTitle(candidate)}
                          className={`flex w-full items-start rounded-2xl border px-4 py-3 text-left text-sm transition ${active ? 'border-sky-500 bg-white text-sky-900 shadow-sm' : 'border-zinc-200 bg-white text-zinc-700 hover:border-sky-300 hover:bg-sky-50'}`}
                        >
                          <span className="mr-3 mt-0.5 text-xs font-semibold text-sky-600">{index + 1}</span>
                          <span className="flex-1">{candidate}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {titleState.sourceWarnings?.length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700">素材读取提示</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-800">
                      {titleState.sourceWarnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>- {warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {titleState.titleSuggestionsExcerpt ? (
                  <div>
                    <h4 className="mb-3 text-base font-semibold text-zinc-900">标题候选（预览）</h4>
                    <pre className="max-h-[220px] overflow-auto rounded-2xl bg-white p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{titleState.titleSuggestionsExcerpt}</pre>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-sm leading-6 text-zinc-500">
                还没有标题候选。先在左侧输入素材并点击“生成 5 个待选标题”。
              </div>
            )}
          </div>
        </form>
      </section>

      <section id="content-generator-form" className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-emerald-600">第二步</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">内容生成器</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">这里专门负责根据最终标题生成正文和配图。你可以直接手动改标题，也可以沿用上面点选的标题。</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <form action={contentFormAction} className="space-y-4">
            <input type="hidden" name="actionMode" value="generate" />
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="style" value={style} />
            <input type="hidden" name="audience" value={audience} />
            <input type="hidden" name="extraRequirements" value={extraRequirements} />
            <input type="hidden" name="preservedReferenceMaterials" value={titleState?.preservedReferenceMaterials || ''} />
            <input type="hidden" name="sourceWarningsInput" value={(titleState?.sourceWarnings || []).join('\n')} />
            <input type="hidden" name="selectedTitle" value={resolvedTopic} />

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">当前平台</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{isXhs ? '小红书笔记' : '微信公众号'}</p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-800">最终标题</span>
              <input
                name="topic"
                value={resolvedTopic}
                onChange={(event) => {
                  setContentTopicDraft(event.target.value);
                  setSelectedTitle(event.target.value);
                }}
                placeholder="从上方点选标题，或直接在这里手动输入"
                className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">{isXhs ? '笔记长度' : '文章长度'}</span>
                <select name="length" defaultValue="medium" className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                  <option value="short">{isXhs ? '短文300字' : '短文'}</option>
                  <option value="medium">{isXhs ? '中500字' : '中等'}</option>
                  <option value="long">{isXhs ? '长800字' : '长文'}</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">{isXhs ? '手机竖版配图数量' : '正文普通插图数量'}</span>
                <input name="imageCount" type="number" min={0} max={5} defaultValue={3} className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <input name="includeCover" type="checkbox" defaultChecked className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
              同时生成{isXhs ? '小红书封面图' : '封面图'}
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

            <button type="submit" disabled={isContentPending || !resolvedTopic} className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">
              {isContentPending ? '正在生成正文，请稍等…' : '开始生成正文'}
            </button>
          </form>

          <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <ContentStatusBanner state={contentState} />
            <PendingStatusCard isPending={isContentPending} elapsed={displayElapsed} />

            <div>
              <h3 className="text-lg font-semibold text-zinc-900">输出结果</h3>
              <p className="mt-1 text-sm text-zinc-600">这里展示文章预览、图片预览和本地输出目录。</p>
            </div>

            {contentState?.success ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">输出目录</p>
                    <p className="mt-2 break-all text-sm text-zinc-800">{contentState.outputPath}</p>
                    {contentState.downloadUrl ? (
                      <a href={contentState.downloadUrl} className="mt-3 inline-flex items-center justify-center rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-200">
                        下载结果包
                      </a>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">图片结果</p>
                    <p className="mt-2 text-sm text-zinc-800">成功 {successfulImageCount} 张 / 共 {images.length} 张</p>
                  </div>
                </div>

                {contentState.resolvedTopic ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">本次最终标题</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">{contentState.resolvedTopic}</p>
                  </div>
                ) : null}

                {contentState.sourceWarnings?.length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700">素材读取提示</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-800">
                      {contentState.sourceWarnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>- {warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {contentState.titleSuggestionsExcerpt ? (
                  <div>
                    <h4 className="mb-3 text-base font-semibold text-zinc-900">标题候选（预览）</h4>
                    <pre className="max-h-[180px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{contentState.titleSuggestionsExcerpt}</pre>
                  </div>
                ) : null}

                {contentState.searchUsed ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">联网搜索</p>
                    <p className="mt-2 text-sm text-zinc-800">{contentState.searchUsed.triggered ? '✅ 已触发' : '❌ 未触发'}</p>
                    {contentState.searchUsed.query ? <p className="mt-1 text-sm text-zinc-600">查询词：{contentState.searchUsed.query}</p> : null}
                    {typeof contentState.searchUsed.resultCount === 'number' ? <p className="mt-1 text-sm text-zinc-600">命中资料：{contentState.searchUsed.resultCount} 条</p> : null}
                  </div>
                ) : null}

                {contentState.articleExcerpt ? (
                  <div>
                    <h4 className="mb-3 text-base font-semibold text-zinc-900">文章摘要（预览）</h4>
                    <pre className="max-h-[200px] overflow-auto rounded-2xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100 whitespace-pre-wrap">{contentState.articleExcerpt}</pre>
                  </div>
                ) : null}

                {contentState.outlineExcerpt ? (
                  <div>
                    <h4 className="mb-3 text-base font-semibold text-zinc-900">大纲摘要（预览）</h4>
                    <pre className="max-h-[150px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{contentState.outlineExcerpt}</pre>
                  </div>
                ) : null}

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
                          {image.relativePath ? <p className="mt-2 text-xs text-zinc-500">路径：{image.relativePath}</p> : null}
                        </article>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">还没有图片结果。生成完成后会在这里显示。</div>
                    )}
                  </div>
                </div>

                {contentState.usedPrompts ? (
                  <div>
                    <h4 className="mb-3 text-base font-semibold text-zinc-900">本次实际使用的 Prompt (预览)</h4>

                    {contentState.usedPrompts.outlinePrompt ? (
                      <div className="mb-4">
                        <p className="mb-2 text-sm font-medium text-zinc-700">大纲 Prompt</p>
                        <pre className="max-h-[100px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{contentState.usedPrompts.outlinePrompt}</pre>
                      </div>
                    ) : null}

                    {contentState.usedPrompts.articlePrompt ? (
                      <div className="mb-4">
                        <p className="mb-2 text-sm font-medium text-zinc-700">正文 Prompt</p>
                        <pre className="max-h-[100px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{contentState.usedPrompts.articlePrompt}</pre>
                      </div>
                    ) : null}

                    {contentState.usedPrompts.imagePlannerPrompt ? (
                      <div>
                        <p className="mb-2 text-sm font-medium text-zinc-700">配图规划 Prompt</p>
                        <pre className="max-h-[100px] overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs leading-6 text-zinc-800 whitespace-pre-wrap">{contentState.usedPrompts.imagePlannerPrompt}</pre>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-sm leading-6 text-zinc-500">
                还没有内容结果。先在上面生成并选中标题，再在这里生成正文。
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
