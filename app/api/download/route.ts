import { NextResponse } from 'next/server';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { getOutputBaseDir } from '../../../lib/files';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dir = searchParams.get('dir');

    if (!dir) {
      return NextResponse.json({ error: 'Missing dir parameter' }, { status: 400 });
    }

    // 路径安全校验，防止路径穿越
    if (dir.includes('/') || dir.includes('\\') || dir.includes('..')) {
      return NextResponse.json({ error: 'Invalid directory name' }, { status: 400 });
    }

    const outputBase = getOutputBaseDir();
    const targetDir = path.join(outputBase, dir);

    // 校验实际路径是否在 output 目录下
    if (!targetDir.startsWith(outputBase)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    const asciiFallback = encodeURIComponent(`${dir}.zip`).replace(/%[0-9A-F]{2}/gi, '_');
    const rfc5987 = `UTF-8''${encodeURIComponent(`${dir}.zip`)}`;
    headers.set('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=${rfc5987}`);

    const stream = new ReadableStream({
      start(controller) {
        const archive = archiver('zip', {
          zlib: { level: 9 },
        });

        archive.on('data', (chunk) => controller.enqueue(chunk));
        archive.on('end', () => controller.close());
        archive.on('error', (err) => controller.error(err));

        archive.directory(targetDir, false);
        archive.finalize();
      },
    });

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error('Error generating zip:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
