import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '微信公众号图文生成器',
  description: '本地运行的公众号图文生成 demo，自动生成文章和配图并保存到本地目录。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-zinc-100 text-zinc-900">{children}</body>
    </html>
  );
}
