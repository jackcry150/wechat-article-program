import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { JSDOM } from 'jsdom';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type LoadedDocument = {
  filePath: string;
  displayName: string;
  text: string;
  loader: string;
};

export type LoadedMaterials = {
  combinedText?: string;
  loadedDocuments: LoadedDocument[];
  warnings: string[];
};

export type UploadedReferenceFile = {
  name: string;
  bytes: Buffer;
};

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function truncateText(input: string, maxChars = 20000): string {
  const normalized = normalizeWhitespace(input);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n\n[内容过长，已截断]`;
}

function parsePathLines(input?: string): string[] {
  if (!input?.trim()) return [];
  return Array.from(new Set(
    input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ));
}

function resolveDocumentPath(rawPath: string): string {
  return path.isAbsolute(rawPath)
    ? rawPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), rawPath);
}

async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

async function readHtmlFile(filePath: string): Promise<string> {
  const html = await fs.readFile(filePath, 'utf8');
  const dom = new JSDOM(html);
  return dom.window.document.body?.textContent || dom.window.document.documentElement.textContent || '';
}

async function readViaTextutil(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('textutil', ['-convert', 'txt', '-stdout', filePath], {
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

async function readPdfViaMdls(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('mdls', ['-name', 'kMDItemTextContent', '-raw', filePath], {
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

async function readDocument(filePath: string): Promise<LoadedDocument> {
  const absolutePath = resolveDocumentPath(filePath);
  return readDocumentFromAbsolutePath(absolutePath, path.basename(absolutePath));
}

async function readDocumentFromAbsolutePath(absolutePath: string, displayName: string): Promise<LoadedDocument> {
  const ext = path.extname(absolutePath).toLowerCase();

  let text = '';
  let loader = 'raw';

  if (['.md', '.txt', '.csv'].includes(ext)) {
    text = await readTextFile(absolutePath);
    loader = 'text';
  } else if (ext === '.json') {
    text = await readTextFile(absolutePath);
    loader = 'json';
  } else if (['.html', '.htm'].includes(ext)) {
    text = await readHtmlFile(absolutePath);
    loader = 'html';
  } else if (['.doc', '.docx', '.rtf', '.rtfd', '.odt', '.webarchive'].includes(ext)) {
    text = await readViaTextutil(absolutePath);
    loader = 'textutil';
  } else if (ext === '.pdf') {
    text = await readPdfViaMdls(absolutePath);
    loader = 'mdls';
  } else {
    try {
      text = await readViaTextutil(absolutePath);
      loader = 'textutil';
    } catch {
      text = await readTextFile(absolutePath);
      loader = 'text';
    }
  }

  return {
    filePath: absolutePath,
    displayName,
    text: truncateText(text),
    loader,
  };
}

export async function loadUploadedReferenceFiles(files: UploadedReferenceFile[]): Promise<LoadedMaterials> {
  const warnings: string[] = [];
  const loadedDocuments: LoadedDocument[] = [];
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-article-materials-'));

  try {
    for (const file of files) {
      const safeName = path.basename(file.name || 'upload.bin');
      const tempPath = path.join(tempRoot, safeName);
      try {
        await fs.writeFile(tempPath, file.bytes);
        loadedDocuments.push(await readDocumentFromAbsolutePath(tempPath, safeName));
      } catch (error) {
        warnings.push(`${safeName} 读取失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    const segments = loadedDocuments.map((doc) =>
      `## 文档：${doc.displayName}\n来源：上传文件\n读取方式：${doc.loader}\n\n${doc.text}`,
    );

    return {
      combinedText: segments.length ? segments.join('\n\n') : undefined,
      loadedDocuments,
      warnings,
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function loadReferenceMaterials(input: {
  inlineContent?: string;
  filePathsText?: string;
}): Promise<LoadedMaterials> {
  const warnings: string[] = [];
  const loadedDocuments: LoadedDocument[] = [];
  const inlineContent = normalizeWhitespace(input.inlineContent || '');
  const filePaths = parsePathLines(input.filePathsText);

  for (const rawPath of filePaths) {
    try {
      loadedDocuments.push(await readDocument(rawPath));
    } catch (error) {
      warnings.push(`${rawPath} 读取失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  const segments: string[] = [];
  if (inlineContent) {
    segments.push(`## 直接粘贴素材\n\n${truncateText(inlineContent)}`);
  }
  for (const doc of loadedDocuments) {
    segments.push(`## 文档：${doc.displayName}\n路径：${doc.filePath}\n读取方式：${doc.loader}\n\n${doc.text}`);
  }

  return {
    combinedText: segments.length ? segments.join('\n\n') : undefined,
    loadedDocuments,
    warnings,
  };
}
