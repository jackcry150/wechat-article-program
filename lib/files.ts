import { promises as fs } from 'fs';
import * as path from 'path';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'article';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timestampString(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export async function createOutputDirectory(topic: string): Promise<string> {
  const configured = process.env.OUTPUT_DIR?.trim() || './output';
  const absoluteBase = path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
  const dirPath = path.join(absoluteBase, `${timestampString()}_${slugify(topic)}`);

  await fs.mkdir(path.join(dirPath, 'prompts'), { recursive: true });
  await fs.mkdir(path.join(dirPath, 'images'), { recursive: true });

  return dirPath;
}

export async function saveTextFile(dirPath: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(dirPath, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function saveJsonFile(dirPath: string, relativePath: string, data: unknown): Promise<void> {
  await saveTextFile(dirPath, relativePath, JSON.stringify(data, null, 2));
}

export async function saveImageFile(dirPath: string, fileName: string, bytes: Buffer): Promise<string> {
  const relativePath = path.join('images', fileName);
  const filePath = path.join(dirPath, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
  return relativePath;
}

export interface ImageMapEntry {
  slot: string;
  fileName?: string;
  prompt: string;
  error?: string;
}

/**
 * Injects image placement markers into article markdown and builds an image-map.md.
 *
 * Cover marker: inserted after the first `# ` heading line.
 * Inline markers: distributed across `##` sections, appended at each section's end.
 */
export function buildImageAnnotations(
  articleMd: string,
  entries: ImageMapEntry[],
): { annotatedMd: string; imageMapMd: string } {
  const coverEntry = entries.find((e) => e.slot === 'cover');
  const inlineEntries = entries.filter((e) => e.slot !== 'cover');

  let md = articleMd;

  // Inject cover marker after the title line
  if (coverEntry?.fileName && !coverEntry.error) {
    md = md.replace(/^(# [^\n]+)/m, `$1\n\n[封面图建议：${coverEntry.fileName}]`);
  }

  // Split at section boundaries: preamble + one segment per ## heading
  const segments = md.split(/\n(?=## )/);
  const sectionTitles = segments.slice(1).map((seg) => {
    const m = seg.match(/^## ([^\n]+)/);
    return m ? m[1].trim() : '（未知章节）';
  });
  const sectionCount = segments.length - 1;

  // Distribute inline images across sections
  const assignments: number[] = inlineEntries.map((_, i) =>
    sectionCount > 0
      ? Math.min(
          Math.floor((i * sectionCount) / Math.max(inlineEntries.length, 1)) + 1,
          segments.length - 1,
        )
      : -1,
  );

  // Inject inline markers at end of assigned sections
  const segs = [...segments];
  for (let i = 0; i < inlineEntries.length; i++) {
    const entry = inlineEntries[i];
    if (!entry.fileName || entry.error) continue;
    const target = assignments[i] >= 0 ? assignments[i] : segs.length - 1;
    segs[target] = segs[target].trimEnd() + `\n\n[插图建议：${entry.fileName}｜建议放在本节后]\n`;
  }
  md = segs.join('\n');

  // Build image-map.md table rows
  const rows: string[] = [];

  if (coverEntry) {
    const status = coverEntry.error ? `❌ ${coverEntry.error.slice(0, 40)}` : '✅ 已生成';
    const summary =
      coverEntry.prompt.length > 60 ? `${coverEntry.prompt.slice(0, 60)}…` : coverEntry.prompt;
    rows.push(
      `| \`${coverEntry.fileName ?? '封面'}\` | 封面图，置于标题下方 | — | ${summary} | ${status} |`,
    );
  }

  for (let i = 0; i < inlineEntries.length; i++) {
    const entry = inlineEntries[i];
    const idx = assignments[i];
    const sectionTitle = idx >= 1 ? sectionTitles[idx - 1] : '文章末尾';
    const position = `「${sectionTitle}」节后`;
    const status = entry.error ? `❌ ${entry.error.slice(0, 40)}` : '✅ 已生成';
    const summary =
      entry.prompt.length > 60 ? `${entry.prompt.slice(0, 60)}…` : entry.prompt;
    rows.push(
      `| \`${entry.fileName ?? '（未生成）'}\` | ${position} | ${sectionTitle} | ${summary} | ${status} |`,
    );
  }

  if (rows.length === 0) {
    rows.push('| — | — | — | 本次未生成任何配图 | — |');
  }

  const imageMapMd = [
    '# 图片放置建议',
    '',
    '> 以下为本次生成的配图清单，供手动上传微信公众号时参考。',
    '',
    '| 文件名 | 建议位置 | 相关章节 | 提示词摘要 | 状态 |',
    '| ------ | -------- | -------- | ---------- | ---- |',
    ...rows,
    '',
    `> 生成时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n');

  return { annotatedMd: md, imageMapMd };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      closeList();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      closeList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      closeList();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>微信公众号文章预览</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif; max-width: 760px; margin: 0 auto; padding: 32px 20px; line-height: 1.85; color: #1f2937; }
      h1,h2,h3 { color: #111827; line-height: 1.35; }
      h1 { font-size: 2rem; margin-bottom: 1rem; }
      h2 { margin-top: 2rem; }
      p { margin: 0 0 1rem; }
      ul { padding-left: 1.4rem; }
      blockquote { border-left: 4px solid #10b981; margin: 1rem 0; padding-left: 1rem; color: #4b5563; }
      code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 0.35rem; }
    </style>
  </head>
  <body>
    ${html.join('\n')}
  </body>
</html>`;
}
